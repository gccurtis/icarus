# 02 · Request and Job Runtime

Everything that happens in this backend happens inside a **Job**. There is no other execution
path — no direct route handlers, no ad-hoc `setInterval` work outside the one Connector sync
scheduler, and even internal continuations become Jobs.

## The single HTTP handler

[`2-transport/registerHttpTransport.ts`](../../apps/backend/src/2-transport/registerHttpTransport.ts)
registers exactly one Fastify route: `app.all("/*")`. There is no Fastify routing table.

```text
Fastify request
  → buildEnvelope()          normalise to framework-neutral RequestEnvelope
  → registry.has(envelope)   exact "METHOD /path" lookup; miss → 404 + endpoint list
  → registry.createJob()     factory produces a FRESH job, captures request data
  → scheduler.enqueue(job)   picks serial or concurrent queue
  → reply.code(statusCode).send(body)
```

The whole file is 125 lines. Three design consequences:

- **Fastify types never escape `2-transport`.** `IncomingRequest` / `RequestEnvelope` live in
  `0-utils/types/request.ts` specifically so job wiring cannot depend on Fastify.
- **Transport chooses only infrastructure status codes.** Comment in the file:
  *"Infrastructure errors choose their status here. Successful endpoint status codes and
  bodies are always chosen by the job work function."* Transport owns 404 (no mapping), 429
  (`QueueCapacityError`), and rethrows everything else to Fastify's 500. Every other code —
  200/201/202/204/400/409/410/422/501 — is chosen inside the job.
- **Path matching is exact string equality**, not pattern matching. `getEndpointKey` is
  `` `${method.toUpperCase()} ${path}` ``. There are no path parameters anywhere; IDs travel
  in query strings or POST bodies. This is why you see `POST /connector/get` rather than
  `GET /connector/:id`.

## JobRegistry

[`0-utils/jobs/registry.ts`](../../apps/backend/src/0-utils/jobs/registry.ts) — 55 lines.

Maps `"POST /documents/command"` → `JobFactory`. Key properties:

- `register()` **throws on duplicate endpoint keys**, so two capabilities cannot silently
  claim the same route.
- `createJob()` calls the factory per request, producing a fresh job object. Factories are
  registered once; jobs are never shared or reused.
- Job IDs are `"<slugified-endpoint-key>-<sequence>"`, e.g. `post-documents-command-17`.
- On a 404 the transport returns `registeredEndpoints: registry.listEndpoints()` in the body
  — a built-in route directory.

## The dual queue scheduler

[`0-utils/jobs/scheduler.ts`](../../apps/backend/src/0-utils/jobs/scheduler.ts) — 279 lines,
two plain arrays.

| | Serial queue | Concurrent queue |
| --- | --- | --- |
| Active slots | Exactly 1 | `workerPool.concurrentWorkers` (default 4) |
| Ordering | Strict FIFO, one job at a time | FIFO admission into a bounded pool |
| Capacity | `queue.serialMaxSize` (1000) | `queue.concurrentMaxSize` (1000) |
| Overflow | `QueueCapacityError` → HTTP 429 | same |

Capacity is decided **synchronously at admission**, before any promise is created. Depth
counts only *waiting* entries; an executing job has already left the array.

### Queue choice is a static property of the endpoint

Every `registry.register` call hard-codes `queueType`. The rule in practice:

- **serial** — anything that mutates canonical revisioned state or must not interleave:
  `POST /documents/command`, `POST /slides/command`, `POST /general-files/upload|update|delete`,
  `POST /connector/delete`, `PATCH /derived-output-definition`, `DELETE /derived-outputs`,
  `POST /audit`.
- **concurrent** — reads, and mutations whose store already does its own compare-and-swap:
  all queries, all Context endpoints (9 of them), all Structured Data endpoints (15),
  Connector reads, `POST /derived-output-refresh`.

Note the asymmetry that reveals the reasoning: Document/Slide commands are serial because the
service reads-then-writes across several store calls, but Structured Data mutations are
concurrent because `DataStore.update(entry, expectedRevision)` is a single CAS statement that
returns `false` on conflict. **Serialisation is used where the store cannot enforce the
invariant on its own.**

### Response modes

```ts
type ResponseMode = "inline" | "deferred";
```

- **inline** — `work()` returns a `JobResponse`; the HTTP reply waits for it. This is what
  virtually everything uses.
- **deferred** — `deferredWork()` produces the response (typically `202 Accepted`), the
  scheduler yields to the event loop so transport can flush the reply, then runs `work()`
  **while still holding the queue slot**. Failures in `work()` cannot change the already-sent
  response; they are logged as `job.deferred.failed`.

The only deferred endpoint in the tree is `POST /audit`, which exists as a worked example
(`built-in/auditCapability.ts` sleeps 250 ms). The mechanism is fully implemented and tested
regardless.

Critically, a deferred job's response is **not created at enqueue time** — the scheduler
comment says so explicitly: *"A deferred response is not created at enqueue time. It is
created only after this job reaches the front of its selected queue and starts."* So a 202
genuinely means "your work has started", not "your work is queued somewhere".

### Occupancy semantics

`serialActive` stays `true`, and a concurrent worker stays consumed, for the **entire job
lifecycle including deferred follow-up work**. Comment: *"Active counts include deferred jobs
until their follow-up work completes."* Deferred mode buys you an early HTTP response, not
extra throughput.

### Scheduler logging

The scheduler emits a fixed event vocabulary, and `runtime-wiring.test.ts` asserts the exact
data shape of `job.deferred.failed`:

`job.enqueued` · `job.started` · `job.responded` · `job.completed` · `job.failed` ·
`job.deferred.failed` · `job.queue.capacity`

Every entry carries `jobId`, `requestId` (when the job came from a request), `jobName`,
`queueType`, `responseMode`, `queueWaitMs`, and a duration.

## Internal jobs (non-HTTP work)

[`0-utils/jobs/internalRuntime.ts`](../../apps/backend/src/0-utils/jobs/internalRuntime.ts)
gives capabilities a way to schedule their own follow-up work **without knowing about the
scheduler**.

The seam has three parts:

```ts
// What the capability receives — dispatch only, no registration, no queue knowledge
interface InternalJobsRuntime<TIntent> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}

// What 4-job-wiring receives — registration only
interface InternalJobsRegistrar<TIntent> {
  register(type, factory: (intent) => InternalJobDefinition): void;
}

// Both faces of the same object
class SchedulerInternalJobsRuntime<TIntent> implements InternalJobsRuntime, InternalJobsRegistrar
```

`startBackend` creates one runtime per capability
(`SchedulerInternalJobsRuntime<DocumentInternalJobIntent>`), hands the **dispatch face** to
the capability and the **registrar face** to job wiring. So:

- The capability emits a typed intent (`{ type: "document.compact", documentId, idempotencyKey }`)
  and has no opinion on which queue runs it.
- `4-job-wiring/document/createDocumentJobs.ts` is the one place that maps intent → queue.
  Its shape is a total `switch` over the intent union, so adding an intent type is a compile
  error until wiring handles it.

Internal jobs are always `responseMode: "inline"` with a synthetic `204`, and their IDs are
prefixed `internal-`.

### Dispatch returns at admission, not completion

```ts
async dispatch(intent) {
  const admission = this.scheduler.admit(job);
  void admission.completion.catch(() => undefined);   // observed, deliberately ignored
  return admission.receipt;
}
```

`scheduler.admit()` exists specifically to support this: it splits queue admission from
completion. The doc comment gives the reason — *"This lets internal continuation dispatch
report queue admission while durable capability state remains the authority for retry and
recovery."* In other words, the in-memory queue is never the record of what still needs
doing; the SQLite attempt row is.

### Retryable admission failures

```ts
export const isRetryableInternalJobAdmissionError = (error: unknown): boolean =>
  error instanceof QueueCapacityError;
```

Capacity is the only admission failure expected to clear on its own. `DocumentService`
consumes this predicate to run an exponential-backoff retry loop (25 ms → 2 s cap) with
`timer.unref()` so pending retries never hold the process open, keyed by
`intent.idempotencyKey` so a duplicate dispatch is a no-op. Unknown intent types are *not*
retried — they are a wiring bug.

## The recurring-work exception

`ConnectorSyncScheduler` (`1-init/create/connectorSyncScheduler.ts`) is the only `setInterval`
in the backend. It runs four timers (5min / 30min / 2hr / 12hr — the `SYNC_INTERVALS` are
deliberately integer multiples of each other so cadences batch), re-reads its connector list
from the store on every tick (so connectors registered after startup join without a
composition callback), and **enqueues normal `JobDefinition`s** rather than doing work
itself. Its own header comment: *"thin interval-based scheduler that enqueues SYNC_CONNECTOR
Jobs through the JobScheduler. Does not touch providers or content directly."*

It acquires a persisted `syncing` flag via `store.setSyncing(id)` (an atomic
false→true CAS) *before* enqueueing, and `store.resetSyncing()` on start recovers flags left
set by a crashed process.

## Endpoint inventory

66 `registry.register` calls across 9 wiring files:

| Wiring file | Count |
| --- | --- |
| `structured-data/registerStructuredDataEndpoints.ts` | 15 |
| `context/registerContextEndpoints.ts` | 9 |
| `connector/registerConnectorEndpointMappings.ts` | 9 |
| `derived-outputs/registerDerivedOutputEndpoints.ts` | 6 |
| `general-files/registerGeneralFileEndpointMappings.ts` | 5 |
| `registerBuiltInEndpointMappings.ts` | 4 |
| `document/registerDocumentEndpoints.ts` | 2 |
| `slide/registerSlideEndpoints.ts` | 2 |
| `activity/registerActivityEndpoints.ts` | 2 |

Note the inverse relationship between endpoint count and capability complexity. Structured
Data exposes 15 fine-grained REST-ish routes; Document — by far the largest capability —
exposes **two**: `POST /documents/command` and `POST /documents/query`, with a
discriminated-union body. The command/query pair is the newer, preferred shape (Document,
Slide, Activity all use it); the fine-grained style in Context/Structured Data/Connector is
the earlier one.
