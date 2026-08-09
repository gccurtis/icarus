# 02 · Request and Job Runtime
*Verified against source at commit ef6d462, 2026-08-09.*

Every HTTP request and every capability-owned continuation in this backend runs inside a **Job**.
There are no direct Fastify route handlers. One transport file turns a request into a
framework-neutral envelope, one registry turns the envelope into a fresh Job, and one scheduler
runs that Job on one of two in-memory queues.

Three — and only three — places produce Jobs. Measured with
`grep -rn 'scheduler\.enqueue(\|\.admit(' src`:

| Producer | File | Path into the scheduler | Job id shape |
| --- | --- | --- | --- |
| HTTP transport | [`2-transport/registerHttpTransport.ts:75`](../../apps/backend/src/2-transport/registerHttpTransport.ts) | `scheduler.enqueue(job)` — awaits the response | `post-documents-command-17` |
| Internal jobs runtime | [`0-utils/jobs/internalRuntime.ts:106`](../../apps/backend/src/0-utils/jobs/internalRuntime.ts) | `scheduler.admit(job)` — returns at admission | `internal-document-compact-1` |
| Connector sync timers | [`1-init/create/connectorSyncScheduler.ts:100`](../../apps/backend/src/1-init/create/connectorSyncScheduler.ts) | `scheduler.enqueue(job)` — result discarded | `sync-<connectorId>-<Date.now()>` |

Only the first goes through `JobRegistry`. The other two mint their own ids and hand a
`JobDefinition` straight to the scheduler.

Resource retention is deliberately *not* a Job producer: `ResourceRetentionScheduler` calls narrow
capability maintenance ports directly on its own timer. See
[04-state-and-persistence.md](04-state-and-persistence.md).

---

## 1 · The transport layer is one file, 125 lines, one route

`src/2-transport/` contains exactly one TypeScript file
([`registerHttpTransport.ts`](../../apps/backend/src/2-transport/registerHttpTransport.ts), 125
lines) — the smallest layer in the backend, and the whole of layer 2 in the
236-file / 47,936-line source tree.

It registers **exactly one** Fastify route, `app.all("/*")`, at line 39. There is no Fastify
routing table anywhere in the repository, and no route in the codebase has a path parameter.

```ts
// registerHttpTransport.ts:37-38
// Fastify registration happens once during startup. Every HTTP endpoint then
// enters this same handler; endpoint-specific behavior lives in job wiring.
```

The Fastify instance is built by [`1-init/create/app.ts`](../../apps/backend/src/1-init/create/app.ts)
— six lines, and the whole file is a decision:

```ts
// Request/job telemetry is emitted through the shared application Logger in
// registerHttpTransport. Keep Fastify's separate stdout logger disabled so one
// correlated JSONL stream remains authoritative.
export const createApp = (): FastifyInstance => Fastify({ logger: false });
```

That choice has a consequence documented in §1.4: anything Fastify rejects before routing is
invisible.

### 1.1 Envelope normalisation

The handler repacks Fastify's request into `IncomingRequest`
([`0-utils/types/request.ts:10-18`](../../apps/backend/src/0-utils/types/request.ts)) and then
normalises it (`registerHttpTransport.ts:21-31`):

```ts
// Convert Fastify-shaped request data into the framework-neutral request used
// as input to the endpoint registry and its job factories.
const buildEnvelope = (request: IncomingRequest): RequestEnvelope => ({
  requestId: request.id,
  method: request.method,
  path: new URL(request.url, "http://backend.local").pathname,
  params: (request.params as Record<string, unknown> | undefined) ?? {},
  query: (request.query as Record<string, unknown> | undefined) ?? {},
  headers: request.headers,
  body: request.body
});
```

`buildEnvelope` is a module-private const — it is not exported, and there is no
`buildInternalEnvelope` anywhere in the tree. Internal work never builds a `RequestEnvelope` at
all (§6).

The reason the DTO lives in `0-utils` rather than in transport is stated in its docblock
(`request.ts:6-9`):

```ts
/**
 * Transport data captured from the framework request before it is normalized.
 * Keeping this type here prevents job wiring from depending on Fastify types.
 */
```

| Envelope field | Source | Exact behaviour |
| --- | --- | --- |
| `requestId` | Fastify `request.id` | Per-process counter: `req-1`, `req-2`, … Optional on the type; transport always supplies it |
| `method` | Fastify `request.method` | Passed through unchanged; the registry uppercases it when keying |
| `path` | `new URL(url, "http://backend.local").pathname` | Query string stripped. **Percent escapes are not decoded. Trailing slashes are not normalised.** The dummy origin exists only so `new URL` can parse a relative URL |
| `params` | Fastify `request.params` | Always exactly one key, `"*"`, holding the path minus its leading slash — the wildcard capture. Never used by any job factory |
| `query` | Fastify `request.query` | Parsed query object, `{}` when absent |
| `headers` | Fastify `request.headers` | Passed through unmodified |
| `body` | Fastify `request.body` | Whatever Fastify's content-type parser produced |

Measured with `app.inject` against a real `createApp()` + built-in registry, 2026-08-09:

| Request | Status | Why |
| --- | ---: | --- |
| `GET /health` | 200 | Key `GET /health` is registered |
| `GET /health?x=1` | 200 | Query string is stripped before keying |
| `GET /health/` | **404** | `"GET /health/" !== "GET /health"` — no trailing-slash tolerance |
| `GET /hea%6Cth` | **404** | No percent-decoding |
| `HEAD /health` | **404** | `app.all` covers HEAD, so it reaches the handler and misses the key `HEAD /health` |
| `OPTIONS /health` | **404** | Same; no CORS preflight handling exists |
| `POST /audit` | 202 | Chosen inside the job, not by transport |

### 1.2 The three status codes transport owns

```ts
// registerHttpTransport.ts:94-95
// Infrastructure errors choose their status here. Successful endpoint
// status codes and bodies are always chosen by the job work function.
```

| Condition | Code | Body | Log message / level |
| --- | ---: | --- | --- |
| `!registry.has(envelope)` (`:54-67`) | **404** | `{ error: "No job registered for endpoint '<METHOD> <path>'", registeredEndpoints: string[] }` | `http.route.not-found` · warn |
| `QueueCapacityError` from `enqueue` (`:96-111`) | **429** | `{ error: "Serial queue is full" \| "Concurrent queue is full", queueType }` | `http.request.rejected` · warn |
| Any other throw (`:113-121`) | **500** | Rethrown to Fastify; Fastify's generic error body | `http.request.failed` · error |
| Success (`:76-92`) | `execution.response.statusCode` | `execution.response.body` | `http.request.completed` · info |

Everything else a client sees — 200, 201, 202, 204, 400, 404-from-a-capability, 409, 410, 422,
501 — is chosen inside a job's `work()`. Transport never inspects a successful body.

If `execution.response.headers` is present, `reply.headers(headers)` is applied before
`reply.code(statusCode).send(body)` (`:78-80`, `:92`). Nothing in `4-job-wiring` currently returns
a `headers` field; the path is live but unused.

**The 404 body is a live route directory.** It carries `registry.listEndpoints()`, which is
`Array.from(this.factories.keys()).sort()` — the complete, lexically sorted list of all 89
registered `"<METHOD> <path>"` keys. A typo'd path returns the full API surface. Verified:

```text
GET /nope -> 404 {"error":"No job registered for endpoint 'GET /nope'",
                  "registeredEndpoints":["GET /health","GET /health/queues","POST /audit","POST /echo"]}
```

(That probe ran with only the built-in registrations wired; a fully composed backend lists all 89.)

**429 carries no `Retry-After`.** The body names the queue that overflowed and nothing else. There
is no retry hint, no backoff advice, and no header. Verified by probe:

```text
third: 429 {"error":"Serial queue is full","queueType":"serial"} | retry-after: null
```

### 1.3 Correlation

`errorFields()` (`:16-19`) reduces any thrown value to `{ errorName, errorMessage }`, falling back
to `{ errorName: "UnknownError", errorMessage: String(error) }`. Every transport log record
carries `requestId`, `method`, `path`, `statusCode`, and `durationMs`; the success record adds
`jobId`, `jobName`, and `queueType`. The scheduler's own records carry the same `requestId`
whenever the job came from a request, which is what makes an HTTP request and its job joinable in
the JSONL log. `runtime-wiring.test.ts:127-171` pins that: it asserts `job.started`'s `requestId`
equals `http.request.completed`'s.

No transport or scheduler log passes a third `options` argument, so every record in this layer is
unlabelled and therefore `detail: "shape"` by the rule in
[`0-platform/observability/logger.ts:24-27`](../../apps/backend/src/0-platform/observability/logger.ts).
The runtime layer writes no authored content. Other layers do — see
[06-platform-services.md](06-platform-services.md) and [11-known-issues.md](11-known-issues.md).

### 1.4 What never reaches the handler, and therefore never reaches any log

Fastify rejects some requests before routing. Because `createApp()` sets `logger: false`, those
responses appear in **no log sink at all** — not the JSONL file, not stdout. Measured 2026-08-09:

| Request | Status | Fastify code | Visible in `logs/backend-*.log`? |
| --- | ---: | --- | --- |
| `POST /echo`, `content-type: application/json`, body `{bad json` | **400** | `FST_ERR_CTP_INVALID_JSON_BODY` | **No** |
| `POST /echo`, `content-type: text/csv` | **415** | `FST_ERR_CTP_INVALID_MEDIA_TYPE` | **No** |

An operator debugging "the client says 400 but there is nothing in the log" is looking at this.
Fastify is 5.11.0 (declared `^5.0.0`).

---

## 2 · JobRegistry — exact-string keying, 55 lines

[`0-utils/jobs/registry.ts`](../../apps/backend/src/0-utils/jobs/registry.ts) holds a
`Map<string, JobFactory>` and an integer.

```ts
// registry.ts:5-6
// Endpoint keys such as "POST /echo" resolve to factories, not shared jobs.
// A fresh job is created for every incoming request.
```

| Member | Signature | Behaviour |
| --- | --- | --- |
| `register` | `(endpoint: RequestEndpoint, factory: JobFactory) => void` | Throws ``Error(`Job already registered for endpoint '${key}'`)`` on a duplicate key (`:12-14`) |
| `has` | `(endpoint: RequestEndpoint) => boolean` | Key lookup only |
| `createJob` | `(request: RequestEnvelope) => Job` | Throws ``Error(`No job registered for endpoint '${key}'`)`` on a miss (`:26-28`) |
| `listEndpoints` | `() => string[]` | `Array.from(this.factories.keys()).sort()` — lexical sort |

**Key derivation** (`registry.ts:46-48`):

```ts
private getEndpointKey(endpoint: RequestEndpoint): string {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}
```

The method is uppercased; **the path is used verbatim**. Matching is exact string equality. There
is no pattern matching, no path parameter, no prefix match, no trailing-slash tolerance, and no
case folding of the path. This is why the endpoint vocabulary reads `POST /connector/get` with the
id in the body rather than `GET /connector/:id`.

**Job id derivation** (`registry.ts:32-39`, `:50-52`): the factory result is spread, an id is
attached as `` `${toIdPrefix(key)}-${this.sequence}` ``, and `requestId` is copied through with a
conditional spread so the key is *absent* rather than `undefined` when there is none.
`toIdPrefix` lowercases, replaces every run of non-`[a-z0-9]` with `-`, and trims leading and
trailing hyphens: `POST /documents/command` → `post-documents-command-17`. The sequence is global
to the registry instance and starts at 1, so ids are unique within one process lifetime and carry
no meaning across restarts.

```ts
// registry.ts:30-31
// Job wiring receives the normalized request here and captures whatever
// request data its work functions need in a new concrete job.
```

`id` is **not** declared by any factory; the registry adds it. A `JobFactory` returns a bare
`JobDefinition`.

**Dead line:** `registry.ts:55` is `export type { Job, JobFactory, JobExecutionResult, QueueType };`.
Every importer of `#utils/jobs/registry.js` imports only `JobRegistry`; those four type names are
always imported from `#utils/jobs/types.js` instead. The re-export has no consumers.

### 2.1 How the registry gets populated — and the fan-out that isn't

[`1-init/create/registry.ts`](../../apps/backend/src/1-init/create/registry.ts) is ten lines:

```ts
export const createRegistry = (scheduler: JobScheduler): JobRegistry => {
  // Build one process-wide endpoint registry, then load every job-wiring group.
  const registry = new JobRegistry();
  registerEndpointMappings(registry, scheduler);
  return registry;
};
```

and [`4-job-wiring/internal/registerEndpointMappings.ts`](../../apps/backend/src/4-job-wiring/internal/registerEndpointMappings.ts)
is twelve:

```ts
export const registerEndpointMappings = (
  registry: JobRegistry,
  scheduler: JobScheduler
): void => {
  // Keep initialization stable: it calls this one function while this file
  // fans out to each endpoint-registration group added under job wiring.
  registerBuiltInEndpointMappings(registry, scheduler);
};
```

**Neither comment is true any more.** `registerEndpointMappings` calls exactly one function and
registers exactly the four built-in endpoints. All eleven capability endpoint groups are
registered directly from `startBackend.ts:176-186`, bypassing the fan-out point entirely:

```ts
registerStructuredDataEndpoints(registry, structuredData, formula, formulaResolver, logger);
registerContextEndpoints(registry, contextManager);
registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
registerGeneralFileEndpoints(registry, generalFiles, logger);
registerConnectorEndpoints(registry, connector, logger);
registerActivityEndpoints(registry, activity, logger);
registerCommentEndpoints(registry, comments, logger);
registerPersonaEndpoints(registry, personas, logger);
registerInvestigationEndpoints(registry, investigation, logger);
registerDocumentEndpoints(registry, document, logger);
registerTemplateEndpoints(registry, templates, logger);
```

This is a code-versus-comment contradiction inside the module, not a documentation drift. The
"stable initialization" intent was abandoned without either comment being updated. The one
existing page that describes it correctly is the built-in capability's own module doc
(`src/3-capabilities/built-in/docs/runtime.md:8-10`), which a later pass owns.

Note also the ordering constraint: because capability wiring runs at `startBackend.ts:176-186`
and `registerHttpTransport` runs at `:204`, the registry is fully populated before the wildcard
route exists. If a capability registration threw, `app.listen` would never be reached.

### 2.2 Registration inventory

**85 `registry.register(` call sites → 89 registered endpoints.** The gap is three `for` loops in
Investigation's wiring that each register several endpoints from one call site
(`registerInvestigationEndpoints.ts:514`, `:695`, `:730` register 2, 3 and 2 respectively — 7
endpoints from 3 sites). Any number that says the backend has 85 endpoints is counting call sites.

| Wiring file | Call sites | Endpoints |
| --- | ---: | ---: |
| `investigation/registerInvestigationEndpoints.ts` | 22 | **26** |
| `structured-data/registerStructuredDataEndpoints.ts` | 16 | 16 |
| `connector/registerConnectorEndpointMappings.ts` | 10 | 10 |
| `context/registerContextEndpoints.ts` | 10 | 10 |
| `derived-outputs/registerDerivedOutputEndpoints.ts` | 7 | 7 |
| `general-files/registerGeneralFileEndpointMappings.ts` | 6 | 6 |
| `registerBuiltInEndpointMappings.ts` | 4 | 4 |
| `activity/registerActivityEndpoints.ts` | 2 | 2 |
| `comments/registerCommentEndpoints.ts` | 2 | 2 |
| `document/registerDocumentEndpoints.ts` | 2 | 2 |
| `persona/registerPersonaEndpoints.ts` | 2 | 2 |
| `templates/registerTemplateEndpoints.ts` | 2 | 2 |
| **Total** | **85** | **89** |

By method: **58 POST, 18 GET, 7 DELETE, 6 PATCH**. Slides registers nothing — it is built and
typechecked but has no wiring at all, so no HTTP request can reach it
([07-capabilities/slides.md](07-capabilities/slides.md)).

`4-job-wiring/` holds 16 TypeScript files. Twelve of them call `registry.register`; the other four
contain zero calls: `internal/registerEndpointMappings.ts` (which delegates, §2.1),
`document/createDocumentJobs.ts` and `document/registerDocumentInternalJobs.ts` (internal jobs,
§6.2), and `document/documentJobPayloads.ts` (5 lines, a pure re-export). Of the twelve that do
register, three use the `register<X>EndpointMappings.ts` suffix (connector, general-files,
built-in) and nine use `register<X>Endpoints.ts` — see
[08-conventions.md](08-conventions.md).

---

## 3 · The Job contract

[`0-utils/jobs/types.ts`](../../apps/backend/src/0-utils/jobs/types.ts) is 70 lines and declares
the entire contract. `JobDefinition` is a **discriminated union on `responseMode`**:

```ts
export type QueueType = "serial" | "concurrent";
export type ResponseMode = "inline" | "deferred";

/** Everything transport needs in order to send the response chosen by a job. */
export interface JobResponse {
  statusCode: number;
  body?: unknown;
  headers?: Record<string, string>;
}

interface BaseJobDefinition {          // not exported
  name: string;
  queueType: QueueType;
}

/** Waits for all work to finish, then returns the response. */
export interface InlineJobDefinition extends BaseJobDefinition {
  responseMode: "inline";
  work: () => Promise<JobResponse>;
}

/**
 * Returns a response when dequeued, then keeps its queue slot while work runs.
 */
export interface DeferredJobDefinition extends BaseJobDefinition {
  responseMode: "deferred";
  deferredWork: () => Promise<JobResponse>;
  work: () => Promise<unknown>;
}

export type JobDefinition = InlineJobDefinition | DeferredJobDefinition;
export type Job = JobDefinition & {
  id: string;
  /** Transport correlation ID when the job originated from a request. */
  requestId?: string;
};
export type JobFactory = (request: RequestEnvelope) => JobDefinition;
```

| Mode | Methods | Who produces the HTTP response | Return value of `work()` |
| --- | --- | --- | --- |
| `inline` | `work()` | `work()` | `JobResponse` — sent to the client |
| `deferred` | `deferredWork()` **and** `work()` | `deferredWork()` | `Promise<unknown>` — **discarded** |

**The archived sketch of this type was wrong.** The superseded design page at
`../phase-1/runtime/repository-boundaries.md` (lines 138-145) declares

```ts
interface JobDefinition<TResponse = unknown> {
  id: string;
  queueType: "serial" | "concurrent";
  responseMode: "inline" | "deferred";
  execute(signal?: AbortSignal): Promise<TResponse>;
}
```

There is no `execute` method, no `AbortSignal`, and no generic parameter anywhere in the job
runtime (`grep -rn 'AbortSignal' src/0-utils src/2-transport` → nothing), and `id` is attached by
`JobRegistry.createJob`, not declared by the factory. Cancellation is discussed in §4.7: it does
not exist.

The remaining types:

```ts
export interface JobExecutionResult {
  jobId: string; requestId?: string; jobName: string; queueType: QueueType;
  respondedAt: string;          // new Date().toISOString()
  response: JobResponse;
}

/** A Job has entered its selected in-memory queue. */
export interface JobAdmissionReceipt { jobId: string; acceptedAt: string; }

/** Queue admission is immediate; execution completes independently. */
export interface JobAdmission {
  receipt: JobAdmissionReceipt;
  completion: Promise<JobExecutionResult>;
}

export interface JobSchedulerState {
  serialDepth: number; serialActive: boolean;
  concurrentDepth: number; concurrentActive: number; concurrentWorkers: number;
}
```

`ResponseMode` (`types.ts:5`) and `JobAdmissionReceipt` (`types.ts:51`) have zero references
outside `0-utils/`; both are satisfied structurally at their use sites.

---

## 4 · JobScheduler — two arrays, 279 lines

[`0-utils/jobs/scheduler.ts`](../../apps/backend/src/0-utils/jobs/scheduler.ts). Constructed once,
in [`1-init/create/scheduler.ts`](../../apps/backend/src/1-init/create/scheduler.ts):

```ts
// Constructing this object creates the serial and concurrent in-memory
// queues. Configuration determines queue capacity and concurrent workers.
new JobScheduler({
  concurrentWorkers: config.workerPool.concurrentWorkers,
  serialQueueMaxSize: config.queue.serialMaxSize,
  concurrentQueueMaxSize: config.queue.concurrentMaxSize
}, logger);
```

| Config field | YAML key | Shipped value | `DEFAULT_CONFIG` |
| --- | --- | ---: | ---: |
| `concurrentWorkers` | `workerPool.concurrentWorkers` | 4 | 4 |
| `serialQueueMaxSize` | `queue.serialMaxSize` | 1000 | 1000 |
| `concurrentQueueMaxSize` | `queue.concurrentMaxSize` | 1000 | 1000 |

None of these can be `0`: `parseNumber` requires `Number.isFinite(v) && v >= 1`, so
`queue.serialMaxSize: 0` is a startup error rather than a way to disable the queue. Non-integers
pass (`1.5` loads). See [09-configuration.md](09-configuration.md).

The scheduler logs through a three-method structural port declared in its own file — no `info`
method, and deliberately not the platform `Logger` type:

```ts
export interface JobSchedulerLogger {
  debug(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```

The platform `Logger` satisfies it structurally (its methods take an extra optional third
argument, which is compatible), which is how `0-utils` avoids importing `0-platform/observability`.
`JobSchedulerLogger` itself has zero references outside `0-utils/`. A private `NOOP_LOGGER`
(`:24-28`) is the constructor default, so a scheduler can be built in isolation — which is what
`internal-jobs.test.ts` does at six of its seven construction sites (the seventh, `:234`, passes a
capturing logger precisely because it asserts on `job.failed`).

### 4.1 The two public entry points

| Method | Signature | Behaviour |
| --- | --- | --- |
| `enqueue` | `async (job: Job) => Promise<JobExecutionResult>` | `return this.admit(job).completion` — resolves when the **response** is produced, not when deferred follow-up work ends |
| `admit` | `(job: Job) => JobAdmission` | Synchronous capacity check, then enqueue; returns `{ receipt, completion }` |
| `getState` | `() => JobSchedulerState` | Live snapshot of both queues |

Because `enqueue` is `async`, a `QueueCapacityError` thrown synchronously inside `admit` surfaces
as a **rejected promise** from `enqueue` and as a **synchronous throw** from `admit`.

`admit`'s docstring (`scheduler.ts:73-79`) is the design statement for the whole internal-jobs
seam:

```ts
/**
 * Admit a Job without coupling the caller to its eventual completion.
 *
 * Capacity is decided synchronously. This lets internal continuation
 * dispatch report queue admission while durable capability state remains
 * the authority for retry and recovery.
 */
```

### 4.2 Capacity bounds waiting depth, not work in flight

`scheduler.ts:81-102`:

```ts
if (queue.length >= queueMaxSize) {
  this.logger.warn("job.queue.capacity", { jobId, jobName, queueType, queueDepth: queue.length, queueMaxSize });
  throw new QueueCapacityError(
    job.queueType,
    job.queueType === "serial" ? "Serial queue is full" : "Concurrent queue is full"
  );
}
```

The bound is on `queue.length` — **the waiting array only**. An executing job has already been
`shift()`ed out and is not counted. So the true in-flight ceiling is
`queueMaxSize + activeSlots`: `serialMaxSize + 1` for serial, `concurrentMaxSize +
concurrentWorkers` for concurrent.

Verified 2026-08-09 with `serialQueueMaxSize: 1` and three blocking requests through the real
transport:

```text
state after 1: {"serialDepth":0,"serialActive":true, …}    ← executing, depth 0
state after 2: {"serialDepth":1,"serialActive":true, …}    ← waiting, depth 1
third:         429 {"error":"Serial queue is full","queueType":"serial"}
```

Two other properties fall out of the code:

- The check runs **before** any promise is created, so no receipt is ever handed out for a
  rejected job.
- `admit` calls `tryRunSerial()` / `tryRunConcurrent()` synchronously after `push`, so an idle
  queue drains back to depth 0 within the same event-loop turn.
- `logEnqueued` runs **between** the `push` and the drain attempt (`scheduler.ts:117-123`), so
  `job.enqueued` always counts the job being enqueued: a single request against an idle backend
  logs `serialDepth: 1`, and `GET /health/queues` a moment later reports `serialDepth: 0`. The two
  numbers are measured at different points and are not comparable.

`internal-jobs.test.ts:83-125` ("capacity failure is reported at admission time") pins the
behaviour at the scheduler level: one active + one queued + `concurrentQueueMaxSize: 1` ⇒ the
third `admit` throws `QueueCapacityError` with `queueType === "concurrent"`.

### 4.3 Serial semantics — one boolean-guarded slot

```ts
// scheduler.ts:144-164
if (this.serialActive) return;
const item = this.serialQueue.shift();
if (!item) return;
this.serialActive = true;

// serialActive stays true for the entire job lifecycle, including any
// deferred work that runs after its HTTP response becomes available.
void this.execute(item)
  .catch(item.reject)
  .finally(() => {
    this.serialActive = false;
    this.tryRunSerial();
  });
```

`serialActive` is a **boolean, not a count**. The serial pool size is hardcoded 1 and is not
configurable. Ordering is strict FIFO, the slot is held for the entire lifecycle including
deferred follow-up work, and a failure still releases the slot via `.finally` and immediately
advances the queue.

### 4.4 Concurrent semantics — `concurrentWorkers` logical slots

```ts
// scheduler.ts:166-186
while (
  this.concurrentActive < this.config.concurrentWorkers &&
  this.concurrentQueue.length > 0
) {
  const item = this.concurrentQueue.shift();
  if (!item) return;
  this.concurrentActive += 1;

  // Each executing job occupies one worker until all of its work ends.
  void this.execute(item)
    .catch(item.reject)
    .finally(() => {
      this.concurrentActive -= 1;
      this.tryRunConcurrent();
    });
}
```

A "worker" is a **logical scheduler slot**, not a thread, worker_thread, or process. Node runs
every promise on one event loop; `concurrentWorkers: 4` means "at most four jobs may be
mid-`await` at once", nothing more. The drain loop starts as many jobs as slots allow in a single
turn, and each completion decrements exactly once and re-drains.

The two comments at `scheduler.ts:54` and `:58` state the invariant:

```ts
// These arrays are the two in-memory queues. A job lives in exactly one.
// Active counts include deferred jobs until their follow-up work completes.
```

`GET /health/queues` returns `scheduler.getState()` under a `queues` key, unmodified —
`runQueueStatusCapability` is a ten-line function whose body is `input`. Note that the reading job
is itself a concurrent job, so the snapshot always includes itself: a live probe against an
otherwise idle backend returns `"concurrentActive":1`.

### 4.5 `execute()` — inline versus deferred, precisely

`scheduler.ts:188-251`. A common field set is assembled once:
`{ jobId, requestId?, jobName, queueType, responseMode, queueWaitMs }`, where
`queueWaitMs = Math.round(startedAt - item.enqueuedAt)` and `enqueuedAt` is a `performance.now()`
stamp taken at admission.

**inline** (`:201-210`)

1. `await work()` → `JobResponse`
2. `item.resolve(...)` — this unblocks transport
3. log `job.completed` with `statusCode` and `durationMs`

**deferred** (`:212-242`)

1. `await deferredWork()` → `JobResponse`
2. `item.resolve(...)` — transport can now send the response
3. log `job.responded` with `statusCode` and `responseDurationMs`
4. `await yieldToEventLoop()` — `setImmediate` from `node:timers/promises` (imported under that
   alias at `:9`)
5. `await work()` inside its own `try`; success logs `job.completed` (carrying the
   already-sent `statusCode`), failure logs `job.deferred.failed` and is **swallowed**
6. only then is the queue slot released

The three comments in that block:

```ts
// scheduler.ts:212-213
// A deferred response is not created at enqueue time. It is created only
// after this job reaches the front of its selected queue and starts.

// scheduler.ts:222-223
// Give transport's awaiting handler a turn to send the response before
// beginning follow-up work. The queue slot intentionally remains active.

// scheduler.ts:234-236
// The HTTP response has already been produced, so this failure cannot
// change it. Record it through the shared logger while allowing the
// queue to drain.
```

If `deferredWork()` itself throws, `item.resolve` is never called: the outer `catch` logs
`job.failed` and **rethrows**, `.catch(item.reject)` rejects `completion`, and transport turns it
into a 500.

**The scheduler imposes no status code on either mode.** `202` is a convention chosen inside the
one deferred endpoint's `deferredWork` (`registerBuiltInEndpointMappings.ts:58`); internal jobs use
a synthetic `204` chosen by `SchedulerInternalJobsRuntime`. Whatever a job returns is what
transport sends. Any statement that "deferred means the API returns 202 after enqueue" is wrong on
both halves: the status is the endpoint's choice, and the response is produced when the job reaches
the head of its queue, not at enqueue.

### 4.6 The scheduler's complete log vocabulary

Seven messages, all from `scheduler.ts`, all through the injected `JobSchedulerLogger`:

| Message | Level | Emitted where | Fields beyond the common set |
| --- | --- | --- | --- |
| `job.queue.capacity` | warn | `admit`, immediately before throwing | `queueDepth`, `queueMaxSize` (and **no** `responseMode` / `queueWaitMs`) |
| `job.enqueued` | debug | `logEnqueued` after `push` | `serialDepth`, `concurrentDepth`, `serialActive`, `concurrentActive` |
| `job.started` | debug | `execute` entry | — |
| `job.responded` | debug | deferred only, after `deferredWork` | `statusCode`, `responseDurationMs` |
| `job.completed` | debug | both modes, after `work` | `statusCode`, `durationMs` |
| `job.failed` | error | outer catch (rethrows) | `durationMs`, `errorName`, `errorMessage` |
| `job.deferred.failed` | error | deferred follow-up catch (swallows) | `durationMs`, `errorName`, `errorMessage` |

`runtime-wiring.test.ts:114-124` asserts the **exact** `job.deferred.failed` payload with
`deepEqual`, so the field set is pinned, not incidental.
`runtime-wiring.test.ts:202-210` reads `src/index.ts` and `src/0-utils/jobs/scheduler.ts` as text
and asserts `doesNotMatch(source, /console\.(?:debug|info|log|warn|error)\s*\(/)` — the scheduler
is one of exactly **two** files under that enforced ban. Nothing checks the other 234 source files.

### 4.7 What the scheduler does not do

- **No cancellation.** No `AbortSignal`, no timeout, no `cancel()`. A job that hangs holds its slot
  forever, and for the serial queue that means the entire serial queue stops permanently. There is
  no operator lever.
- **No priority, no fairness, no starvation control.** FIFO only, per queue.
- **No durability.** Both queues are plain in-memory arrays. A restart loses everything queued;
  recovery is a capability concern, handled by durable attempt rows — see
  [05-async-attempt-pipeline.md](05-async-attempt-pipeline.md).
- **No `stop()` or `drain()`.** Shutdown (`startBackend.ts:220-227`) stops the connector-sync
  timers, awaits the retention sweep, closes Fastify, flushes the logger and calls
  `process.exit(0)`. `app.close()` waits for in-flight HTTP requests, but a **deferred** job's
  follow-up `work()` — which by construction runs after the response was sent — is not awaited.
- **No cross-process coordination.** Two backend processes have independent queues, counters, and
  id sequences.
- **No back-pressure signal other than 429**, and that 429 carries no `Retry-After`.

---

## 5 · Which endpoints go on which queue

Queue type is fixed per endpoint at registration; nothing recomputes it per request. Measured
across all 89 registrations 2026-08-09 (`registry.register` sites plus the three Investigation
loops, each expanded):

| Capability | Endpoints | Serial | Concurrent |
| --- | ---: | ---: | ---: |
| investigation | 26 | 18 | 8 |
| structured-data | 16 | 1 | 15 |
| connector | 10 | 2 | 8 |
| context | 10 | 1 | 9 |
| derived-outputs | 7 | 3 | 4 |
| general-files | 6 | 4 | 2 |
| built-in | 4 | 1 | 3 |
| activity | 2 | 0 | 2 |
| comments | 2 | 1 | 1 |
| document | 2 | 1 | 1 |
| persona | 2 | 1 | 1 |
| templates | 2 | 1 | 1 |
| **Total** | **89** | **34** | **55** |

The rule the codebase states for itself is in the Templates wiring
(`4-job-wiring/templates/registerTemplateEndpoints.ts:88-95`), and it is the clearest statement of
the convention anywhere in the tree:

```ts
// Serial: this endpoint mutates, and the service reads-then-writes across
// several store calls that no single statement can make atomic.
// Claim-then-execute has the same shape: two concurrent retries of one
// requestId would both see a pending claim and both drive the adapter.
//
// This is the same reason Document commands are serial, and it is
// what the house rule means by serialising where the store cannot enforce
// the invariant on its own.
```

Persona says the same thing more briefly (`registerPersonaEndpoints.ts:70-71`): *"Serial: create,
update, and delete each read-then-write across the store and the Context port, which the store
cannot guard on its own."*

**The rule is not applied uniformly, and the exceptions are worth knowing before reading a queue
column as "serial means write":**

| Endpoint | Queue | Note |
| --- | --- | --- |
| `POST /contexts`, `PATCH /contexts/entries`, `DELETE /contexts` | concurrent | Context puts only `POST /contexts/purge` on the serial queue; its create/update/delete paths run concurrently |
| `POST /structured-data`, the four `PATCH` routes, `POST /structured-data/rows`, `DELETE /structured-data/rows` | concurrent | Structured Data puts only `POST /structured-data/purge` on the serial queue — 1 of 16 |
| `POST /connector/register`, `POST /connector/refresh` | concurrent | Only `delete` and `purge` are serial |
| `POST /findings/propose` | concurrent | Creates a Finding |
| `POST /findings/accept` | concurrent | Deliberate: acceptance is retried against the claim text rather than a revision CAS |
| `POST /findings/unaccept`, `POST /findings/reject` | serial | Same loop, different queue — the array carries `queueType` per element (`registerInvestigationEndpoints.ts:695`) |
| `POST /activity/command` | concurrent | Reaches no mutation at all: it returns **501** unconditionally (`registerActivityEndpoints.ts:149-167`) |

The Finding split is the one exception with a written rationale, in the runtime rather than the
wiring (`investigation/application/investigationRuntime.ts:973-974`):

```ts
// A serial edit may win while Knowledge is ingesting. Claim comparison
// makes acceptance retry the new claim without a public revision/CAS type.
```

### 5.1 The four built-in endpoints

`4-job-wiring/registerBuiltInEndpointMappings.ts` (71 lines) is the only wiring file reachable
through `createRegistry`, and the only place a deferred job exists.

| Endpoint | `name` | Queue | Mode | Response |
| --- | --- | --- | --- | --- |
| `GET /health` | `health` | concurrent | inline | 200 + `{service, status, timestamp}` |
| `GET /health/queues` | `queue-status` | concurrent | inline | 200 + `{queues: scheduler.getState(), registeredEndpoints: registry.listEndpoints()}` |
| `POST /echo` | `echo-inline` | concurrent | inline | 200 + `{method, path, body, processedAt}` |
| `POST /audit` | `audit-deferred` | **serial** | **deferred** | **202** + `{status:"accepted", requestId}`, then a 250 ms sleep |

```ts
// registerBuiltInEndpointMappings.ts:12-13
// Each registration maps the endpoint actually received by transport to a
// factory that captures request data and creates a new job.

// registerBuiltInEndpointMappings.ts:56
// This response is created only after the serial queue starts this job.

// registerBuiltInEndpointMappings.ts:65
// The scheduler keeps the serial slot until this follow-up work completes.
```

`POST /audit` is the **only** `responseMode: "deferred"` job in the entire backend — one match for
`responseMode: "deferred"` in `src/4-job-wiring/`. Its follow-up work is
`runAuditCapability`, which sleeps 250 ms and returns a timestamp object that nothing reads
(`3-capabilities/built-in/auditCapability.ts`, 16 lines). While it sleeps, the whole serial queue
is blocked. The four built-in capability functions total 47 lines.

---

## 6 · Internal jobs — non-HTTP work on the same two queues

[`0-utils/jobs/internalRuntime.ts`](../../apps/backend/src/0-utils/jobs/internalRuntime.ts), 114
lines. One class, `SchedulerInternalJobsRuntime<TIntent>`, presenting **two faces** of the same
object:

```ts
/** The dispatch-only face injected into a capability. */
export interface InternalJobsRuntime<TIntent extends InternalJobIntent> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}

export interface InternalJobsRegistrar<TIntent extends InternalJobIntent> {
  register<TType extends TIntent["type"]>(
    type: TType,
    factory: (intent: Extract<TIntent, { type: TType }>) => InternalJobDefinition
  ): void;
}
```

The composition root builds one instance and hands each face to a different consumer:

```ts
// startBackend.ts:101
const documentJobs = new SchedulerInternalJobsRuntime<DocumentInternalJobIntent>(scheduler);
// :102-111  documentJobs passed into createDocumentInstance   → dispatch face
// :112      registerDocumentInternalJobs(documentJobs, document) → registrar face
```

A capability therefore never sees `register`, and job wiring never sees `dispatch`. The capability
cannot choose a queue; wiring can.

```ts
/** Internal work has no transport response; queue choice remains in wiring. */
export interface InternalJobDefinition {
  readonly name: string;
  readonly queueType: QueueType;
  readonly work: () => Promise<unknown>;
}
```

`InternalJobDefinition` has **no `responseMode` and no `deferredWork`**. Internal work is always
inline as far as the scheduler is concerned.

### 6.1 `dispatch()` — forced inline, synthetic 204, returns at admission

```ts
// internalRuntime.ts:85-113
const factory = this.factories.get(intent.type);
if (!factory) throw new Error(`No internal Job registered for intent '${intent.type}'`);

const definition = factory(intent);
this.sequence += 1;
const schedulerDefinition: JobDefinition = {
  name: definition.name,
  queueType: definition.queueType,
  responseMode: "inline",
  work: async () => {
    await definition.work();
    return { statusCode: 204 };
  }
};
const job: Job = { ...schedulerDefinition, id: `internal-${toIdPrefix(intent.type)}-${this.sequence}` };
const admission = this.scheduler.admit(job);

// Scheduler logging records eventual execution failures. Observe the
// promise here because dispatch deliberately returns after admission.
void admission.completion.catch(() => undefined);

return admission.receipt;
```

Facts that matter:

- **The `204` is synthetic and nobody ever reads it.** It exists because `JobDefinition` requires
  a `JobResponse`; `dispatch` returns `admission.receipt` and throws the completion away. The only
  trace of it is `statusCode: 204` in the `job.completed` log record.
- **`dispatch` returns at admission, not completion.** That is the point of `admit` existing at
  all, and the reason is in `admit`'s own docstring (§4.1): *"durable capability state remains the
  authority for retry and recovery."* The durable attempt row, not the queue, is the retry
  authority. See [05-async-attempt-pipeline.md](05-async-attempt-pipeline.md).
- **`QueueCapacityError` propagates out of `dispatch`** as a rejection, because `dispatch` is
  `async` and `admit` throws synchronously. `isRetryableInternalJobAdmissionError` exists so the
  caller can classify it without knowing what a queue is:

  ```ts
  // internalRuntime.ts:20-24
  /**
   * Capacity is the one admission failure that is expected to clear without a
   * configuration change. Capabilities can use this predicate without knowing
   * which scheduler or queue owns the intent.
   */
  ```

- `register` throws ``Error(`Internal Job already registered for intent '${type}'`)`` on a
  duplicate; `dispatch` throws ``Error(`No internal Job registered for intent '${type}'`)`` on an
  unknown type. Both are pinned by `internal-jobs.test.ts:166-188`.
- Ids are `internal-<slugified-intent-type>-<sequence>`, e.g. `internal-document-compact-1`. The
  sequence is **per runtime instance**. Only one instance exists today, so there is no collision;
  a second capability runtime registering an identically named intent type would mint the same id.
  Latent, not currently live.
- `toIdPrefix` (`internalRuntime.ts:58-59`) is a **verbatim duplicate** of
  `JobRegistry.toIdPrefix` (`registry.ts:50-52`) — the same four-line function exists twice.
- **Internal and HTTP jobs share the same two queues.** `internal-jobs.test.ts:190` is named
  *"internal and request Jobs share the serial FIFO"* and proves the interleaving is one global
  FIFO per queue. A saturated serial queue therefore delays Document settlement work and
  `POST /documents/command` alike.

### 6.2 The complete internal-intent inventory: seven, all Document

`4-job-wiring/document/registerDocumentInternalJobs.ts` (22 lines) registers a literal list, and
`createDocumentJobs.ts` (52 lines) is a total `switch` with no `default` — adding an intent type is
a compile error until wiring handles it.

| Intent type | Job name | Queue | Capability call |
| --- | --- | --- | --- |
| `document.compact` | `documents.compact` | **serial** | `document.compact(intent.documentId)` |
| `document.prompt.create.compute` | `documents.prompt.create.compute` | concurrent | `document.computePromptCreation(intent.attemptId)` |
| `document.prompt.create.settle` | `documents.prompt.create.settle` | **serial** | `document.settlePromptCreation(intent.attemptId)` |
| `document.prompt.refresh.compute` | `documents.prompt.refresh.compute` | concurrent | `document.computePromptRefresh(intent.attemptId)` |
| `document.prompt.refresh.settle` | `documents.prompt.refresh.settle` | **serial** | `document.settlePromptRefresh(intent.attemptId)` |
| `document.formula.evaluate.compute` | `documents.formula.evaluate.compute` | concurrent | `document.computeFormulaEvaluation(intent.attemptId)` |
| `document.formula.evaluate.settle` | `documents.formula.evaluate.settle` | **serial** | `document.settleFormulaEvaluation(intent.attemptId)` |

The pattern is uniform: **compute is concurrent, settle and compact are serial.** Document is the
only capability with an internal-jobs runtime; no other capability constructs one.

### 6.3 The one consumer of the retryable predicate

`3-capabilities/document/application/documentService.ts` imports it at `:8` and uses it in the
dispatch failure path. Constants at `:145-147`:

```ts
const STAGE_RETRY_DELAYS_MS = [10, 50] as const;
const DISPATCH_RETRY_INITIAL_DELAY_MS = 25;
const DISPATCH_RETRY_MAX_DELAY_MS = 2_000;
```

`dispatch` (`:2146-2152`) is guarded by `pendingDispatches.has(intent.idempotencyKey)`, so a
duplicate dispatch for the same key is a no-op. `handleDispatchFailure` (`:2155-2172`) logs
`document.internal-job.dispatch-pending` with `{intentType, …, retryCount, retryable, errorName,
errorMessage}` and then:

```ts
if (!retryable) return;
this.scheduleDispatchRetry(intent, retryCount + 1);
```

`retryable` is exactly `error instanceof QueueCapacityError`. Anything else — most importantly an
unregistered intent type, which is a wiring bug — is logged once and never retried.

`scheduleDispatchRetry` (`:2173`) uses exponential backoff from **25 ms to a 2 s cap** with
the exponent capped at 16, and `timer.unref()`s so pending retries never hold the process open.
Success logs `document.internal-job.dispatch-recovered`. **There is no retry limit** — against a
permanently full queue this retries at 2 s intervals forever, which is the intended reading of
`admit`'s docstring: the attempt row survives, so retrying is safe and giving up is not.

---

## 7 · The third producer: connector sync timers

[`1-init/create/connectorSyncScheduler.ts`](../../apps/backend/src/1-init/create/connectorSyncScheduler.ts)
(117 lines) is the only timer-driven Job producer.

```ts
// ConnectorSyncScheduler — thin interval-based scheduler that enqueues
// SYNC_CONNECTOR Jobs through the JobScheduler. Does not touch providers
// or content directly.
```

`start()` creates **one `setInterval` per key of `SYNC_INTERVALS`**
(`3-capabilities/connector/domain/model.ts:21-26`): `5min`, `30min`, `2hr`, `12hr` — so **four
timers run whenever the scheduler is started, even with zero registered connectors.** Unlike the
retention timer (`0-utils/persistence/resourceRetentionScheduler.ts:66`), they are **not**
`unref()`ed, so they keep the event loop alive on their own.

Each tick calls `refreshEntries()` (a fresh `store.listSyncableEntries()` read, which is what keeps
the scheduler current without a composition-layer callback) and then enqueues one job per due
connector:

```ts
const job: JobDefinition = { name: "connector.sync.scheduled", queueType: "concurrent",
                             responseMode: "inline", work: async () => { … } };
this.scheduler.enqueue({ ...job, id: `sync-${connectorId}-${Date.now()}` }).catch((error) => {
  this.store.clearSyncing(connectorId);
  this.logger.error("connector.sync.scheduler.enqueue-failed", { … });
});
```

Notes:

- It **bypasses `JobRegistry` entirely** and mints its own ids from a timestamp, so two syncs of
  the same connector in the same millisecond would collide. `setSyncing` prevents that in practice.
- `work()` catches its own errors and returns `{statusCode: 500}`, so in practice the `.catch` on
  `enqueue` fires only for `QueueCapacityError` — that is the path that clears the `syncing` flag.
- `startBackend.ts:210-214` starts it only after `app.listen` resolves, with the reason stated:
  *"Start recurring work only after the transport has bound successfully. Otherwise a listen
  failure would leave interval timers keeping the failed startup process alive."*
  `runtime-wiring.test.ts:212` enforces that ordering by reading `startBackend.ts` as text.
- `register()` / `unregister()` are **dead in production** — nothing in `1-init`, `2-transport` or
  `4-job-wiring` calls them, so their `connector.sync.scheduler.registered` /
  `.unregistered` log messages are unreachable.
- `stop()` clears the timers. It does not wait for a sync job already on the concurrent queue.

---

## 8 · Who chooses the response

| Concern | Owner | Where |
| --- | --- | --- |
| 404 for an unmapped route | transport | `registerHttpTransport.ts:54-67` |
| 429 for queue overflow | transport | `registerHttpTransport.ts:96-111` |
| 500 for an unhandled throw | transport → Fastify | `registerHttpTransport.ts:113-121` |
| 400 / 415 for a bad content type | Fastify, before the handler | never logged (§1.4) |
| Every success code and body | the job's `work()` / `deferredWork()` | `4-job-wiring/**` |
| Every capability error → status mapping | the capability's wiring file | `4-job-wiring/**`, see [03-capability-anatomy.md](03-capability-anatomy.md) |
| Serial vs concurrent | the wiring file, fixed at registration | `4-job-wiring/**` |
| Inline vs deferred | the wiring file, fixed at registration | one endpoint uses deferred |
| Queue capacity and worker count | configuration | `workerPool`, `queue` in `etc/configuration.yaml` |

---

## 9 · Operational reality

What an operator actually meets, collected in one place.

| Symptom | Cause | Where |
| --- | --- | --- |
| `429` with `{error, queueType}` and no `Retry-After` | Waiting depth hit `queue.*MaxSize`; an executing job is not counted | §4.2 |
| `404` whose body lists every endpoint | Deliberate — the 404 body is a route directory | §1.2 |
| `404` on `GET /health/` or `HEAD /health` | Exact-string keying, no trailing-slash tolerance, `app.all` covers HEAD | §1.1 |
| `400 FST_ERR_CTP_INVALID_JSON_BODY` / `415 FST_ERR_CTP_INVALID_MEDIA_TYPE` with **nothing in the log** | Fastify rejects before routing and `createApp()` sets `logger: false` | §1.4 |
| The serial queue stops forever | A serial job hung; there is no timeout, no cancellation, no drain | §4.7 |
| Queued work vanishes on restart | Both queues are in-memory arrays; durability lives in capability attempt rows | §4.7 |
| A misconfigured backend exits 1 with no output anywhere | `createConfig()` / `createLogger()` are at `startBackend.ts:48-49`, **outside** the `try` that begins at `:51`; `src/index.ts:12-14` swallows the error and `console.*` is banned by test | [11-known-issues.md](11-known-issues.md) |
| `-wal` / `-shm` files left behind | Shutdown never closes a SQLite handle | [11-known-issues.md](11-known-issues.md) |
| A deferred job's follow-up work is cut off at shutdown | `app.close()` awaits HTTP requests; the scheduler has no drain | §4.7 |

---

## 10 · Where this is tested

| File | Top-level tests | What it covers here |
| --- | ---: | --- |
| `test/capabilities/internal-jobs.test.ts` | 7 | Admission vs completion, capacity at admission, dispatch-returns-on-admission, duplicate/unknown intents, shared serial FIFO, failed internal work releasing its slot |
| `test/capabilities/runtime-wiring.test.ts` | 8 | Scheduler log vocabulary with an exact `deepEqual` on `job.deferred.failed`, HTTP↔job `requestId` correlation through a real `createApp()` + `registerHttpTransport`, the `console.*` ban, the composition-root module graph, sync-after-listen ordering |

Neither file touches a database; both construct `JobScheduler` directly. The suite as a whole is
**444 tests, 444 pass, 0 fail** (measured 2026-08-09) — see
[10-verified-status.md](10-verified-status.md).

Not covered by any test: the 404 body's contents, the 429 body's contents, trailing-slash and
`HEAD` behaviour, and the Fastify-level 400/415 responses. The facts in §1.1, §1.2 and §1.4 were
established for this page by direct `app.inject` probes against the real transport, not by an
existing assertion.

---

## Related pages

- [01-layers-and-boundaries.md](01-layers-and-boundaries.md) — why `2-transport` may not know a
  capability, and the alias map that enforces it
- [03-capability-anatomy.md](03-capability-anatomy.md) — what a `4-job-wiring` file does between
  the envelope and the service
- [05-async-attempt-pipeline.md](05-async-attempt-pipeline.md) — the durable attempt rows that make
  dispatch-at-admission safe
- [06-platform-services.md](06-platform-services.md) — the `Logger` these records go through
- [07-capabilities/built-in.md](07-capabilities/built-in.md) — the four built-in endpoints in full
- [09-configuration.md](09-configuration.md) — `workerPool`, `queue`, and the loader's sharp edges
- [11-known-issues.md](11-known-issues.md) — the defects referenced above, collected
- Superseded design pages: `../phase-1/runtime/dual-queue.md` and
  `../phase-1/runtime/repository-boundaries.md`. Both are archive; the second's `JobDefinition`
  sketch is wrong (§3).
