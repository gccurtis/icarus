# 07 · Built-in

*Verified against source at commit ef6d462, 2026-08-09.*

Built-in is four exported async functions totalling **47 lines** that back the four endpoints every
other capability's machinery is built out of: a liveness probe, a queue/route introspection probe,
a request echo, and a sleeping deferred job. It owns no state, no database, no store, no port, no
error type and no domain model. Its real job is to be the **worked example of each job mode**: three
of them show concurrent + inline at increasing degrees of wiring involvement, and `POST /audit`
shows serial + deferred — the only `responseMode: "deferred"` job anywhere in the backend.
`GET /health/queues` is, in practice, the operator's first debugging tool: it returns the live
scheduler state and the complete registered-route directory in one 200.

The archived description is
[phase-1/claude-notes/07-capability-inventory.md](../../phase-1/claude-notes/07-capability-inventory.md)
(§ "built-in"). Unusually for that file, its built-in section is accurate — four endpoints, correct
queue/mode/purpose for each, and it correctly identifies `POST /audit` as "the only deferred job".
It is superseded by this page rather than corrected by it.

---

## 1 · At a glance

| Property | Value |
| --- | --- |
| Shape | **Functions** — four loose exported `async` functions at the module root. No barrel, no `index.ts`, no class, no state |
| Endpoints | **4** — `GET /health`, `GET /health/queues`, `POST /echo`, `POST /audit` |
| Wiring file | [`4-job-wiring/registerBuiltInEndpointMappings.ts`](../../../apps/backend/src/4-job-wiring/registerBuiltInEndpointMappings.ts) (71 lines) — **the only wiring file at the root of `4-job-wiring/`**, not in a subdirectory |
| DB file | none |
| Tables | **0** |
| Revision model | none — stateless |
| Composition | Not built in `startBackend`. `createRegistry(scheduler)` calls it during registry construction (`startBackend.ts:100`) |
| Test files | **none of its own.** No test in `test/capabilities/` names any of the four functions or any of the four paths |
| Source files / lines | **4 files / 47 lines** |
| Module docs | 6 files, **417 lines**, at [`src/3-capabilities/built-in/docs/`](../../../apps/backend/src/3-capabilities/built-in/docs/) — **8.9× the size of the code** (417 ÷ 47 = 8.87) |
| Status | Complete and working. Every claim it makes about itself is true; the gaps are in coverage, not behaviour |

Per-file line counts (`wc -l`):

| File | Lines | Export |
| --- | ---: | --- |
| [`auditCapability.ts`](../../../apps/backend/src/3-capabilities/built-in/auditCapability.ts) | 16 | `runAuditCapability` |
| [`echoCapability.ts`](../../../apps/backend/src/3-capabilities/built-in/echoCapability.ts) | 14 | `runEchoCapability` |
| [`queueStatusCapability.ts`](../../../apps/backend/src/3-capabilities/built-in/queueStatusCapability.ts) | 10 | `runQueueStatusCapability` |
| [`healthCapability.ts`](../../../apps/backend/src/3-capabilities/built-in/healthCapability.ts) | 7 | `runHealthCapability` |

The `docs/` package is `README.md` (57), `concepts.md` (67), `flows.md` (76), `invariants.md` (69),
`runtime.md` (81), `types.md` (67). That ratio is not a criticism of the package — it is accurate,
and `runtime.md:8-10` is the only doc in the entire tree that describes the endpoint-registration
fan-out correctly (§5.2). It is recorded because a reader deciding where to spend attention should
know that this module is 47 lines with 417 lines of prose attached, and the next module they open
may be 6,765 lines with none (see [slides.md](slides.md)).

---

## 2 · Domain model

There is none. There are three input interfaces and one imported response type; none of them is a
domain concept, and none is persisted.

| Type | Declared | Shape |
| --- | --- | --- |
| `ApiHealth` | `packages/shared/src/index.ts` (5 lines, the entire package) | `{ service: "backend"; status: "ok"; timestamp: string }` — both `service` and `status` are **literal types with one value each**, so a health response can never say anything but `ok` |
| `EchoCapabilityInput` | `echoCapability.ts:1-5` | `{ method: string; path: string; body: unknown }` |
| `AuditCapabilityInput` | `auditCapability.ts:3-5` | `{ requestId?: string }` |
| `QueueStatusCapabilityInput` | `queueStatusCapability.ts:3-6` | `{ queues: JobSchedulerState; registeredEndpoints: string[] }` |

`JobSchedulerState` (`0-utils/jobs/types.ts:62-68`) is
`{ serialDepth, serialActive, concurrentDepth, concurrentActive, concurrentWorkers }`.

`ApiHealth` is the **only** type `packages/shared` exports and the only thing the frontend and the
backend share: `apps/frontend/src/main.ts:12` fetches `http://localhost:4000/health` and casts the
body to it.

---

## 3 · Operations — the four functions

| Function | Signature | What it does |
| --- | --- | --- |
| `runHealthCapability` | `(): Promise<ApiHealth>` | Returns `{service:"backend", status:"ok", timestamp: new Date().toISOString()}`. **No dependency check of any kind** — it does not touch a database, the scheduler, the logger, or the filesystem. A backend whose every store is corrupt still answers `ok` |
| `runQueueStatusCapability` | `(input: QueueStatusCapabilityInput): Promise<QueueStatusCapabilityInput>` | `=> input`. It returns its argument unchanged; the wiring does all the work by choosing what to pass |
| `runEchoCapability` | `(input: EchoCapabilityInput): Promise<Record<string, unknown>>` | Copies `method`, `path`, `body` and adds `processedAt`. No validation, no transformation |
| `runAuditCapability` | `(input: AuditCapabilityInput): Promise<Record<string, unknown>>` | `await sleep(250)` from `node:timers/promises`, then returns `{acceptedRequestId: input.requestId, auditedAt}`. **No store, no logger, no audit record is written anywhere.** The return value is discarded by the wiring |

That is the whole capability. `runQueueStatusCapability` being the identity function is the point:
the interesting behaviour lives in the job factory, which reads `scheduler.getState()` and
`registry.listEndpoints()` at request time rather than at registration time.

---

## 4 · Endpoints

All four are registered by
[`registerBuiltInEndpointMappings(registry, scheduler)`](../../../apps/backend/src/4-job-wiring/registerBuiltInEndpointMappings.ts).
The file opens with the rule every wiring file in the backend follows (`:12-13`):

> ```
> // Each registration maps the endpoint actually received by transport to a
> // factory that captures request data and creates a new job.
> ```

| Method | Path | Job name | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/health` | `health` | concurrent | inline | 200 + `{service, status, timestamp}`. Captures nothing from the request |
| `GET` | `/health/queues` | `queue-status` | concurrent | inline | 200 + `{queues: scheduler.getState(), registeredEndpoints: registry.listEndpoints()}` |
| `POST` | `/echo` | `echo-inline` | concurrent | inline | 200 + `{method, path, body, processedAt}`. Closes over `request.method`, `request.path`, `request.body` |
| `POST` | `/audit` | `audit-deferred` | **serial** | **deferred** | **202** + `{status:"accepted", requestId}` when the job reaches the head of the serial queue, then a 250 ms sleep that holds the serial slot |

Measured 2026-08-09 with `app.inject` against a real `createApp()` plus these four registrations
and nothing else:

```text
GET  /health        -> 200 {"service":"backend","status":"ok","timestamp":"2026-08-09T15:46:23.267Z"}
GET  /health/queues -> 200 {"queues":{"serialDepth":0,"serialActive":false,"concurrentDepth":0,
                                      "concurrentActive":1,"concurrentWorkers":4},
                            "registeredEndpoints":["GET /health","GET /health/queues",
                                                   "POST /audit","POST /echo"]}
POST /echo          -> 200 {"method":"POST","path":"/echo","body":{"a":1},
                            "processedAt":"2026-08-09T15:46:23.273Z"}
POST /audit         -> 202 {"status":"accepted","requestId":"req-4"}
```

These four are 4 of the backend's **89** registered endpoints and 4 of its **85**
`registry.register(` call sites — see [README.md](README.md) §1 for the full inventory.

### 4.1 The queue / mode grid, and what each corner demonstrates

`JobDefinition` (`0-utils/jobs/types.ts:14-34`) is a discriminated union on `responseMode`:
an `InlineJobDefinition` has `work(): Promise<JobResponse>`; a `DeferredJobDefinition` has
`deferredWork(): Promise<JobResponse>` **and** `work(): Promise<unknown>`. `queueType` is
`"serial" | "concurrent"`. Four combinations exist in the type. **Built-in exercises two of them;
the whole backend exercises three; one has never been used.**

| | inline | deferred |
| --- | --- | --- |
| **concurrent** | `GET /health`, `GET /health/queues`, `POST /echo` — plus every read endpoint in every capability | *never used anywhere in the backend* |
| **serial** | every mutating capability endpoint. **Built-in has no example of this corner** | `POST /audit` — **the only one** |

Each built-in endpoint is a distinct lesson:

| Endpoint | The lesson |
| --- | --- |
| `GET /health` | The **minimum viable job**: concurrent, inline, a factory that captures nothing and a `work()` that awaits one function |
| `GET /health/queues` | **Wiring-supplied dependencies.** The factory closes over `scheduler` and `registry`, which were passed to `registerBuiltInEndpointMappings`, and calls them *inside* `work()` — so the numbers are read when the request runs, not when the process started |
| `POST /echo` | **Request capture.** The factory receives the `RequestEnvelope` and closes over the fields the job needs. This is the pattern every capability wiring file uses |
| `POST /audit` | **Deferred response.** The only place in the tree where a response is produced before the work finishes |

### 4.2 `POST /audit` — the only deferred job in the backend

Two comments in the wiring file are the whole explanation, verbatim:

```ts
// registerBuiltInEndpointMappings.ts:56
// This response is created only after the serial queue starts this job.
```

```ts
// registerBuiltInEndpointMappings.ts:65
// The scheduler keeps the serial slot until this follow-up work completes.
```

The sequence, from `JobScheduler.execute` (`0-utils/jobs/scheduler.ts:188-251`):

1. Transport awaits `scheduler.enqueue(job)`; the job joins the serial queue.
2. When it reaches the head, `serialActive` becomes `true` (`:154`) and `execute` runs.
3. Because `responseMode === "deferred"`, `deferredWork()` runs first and its `{statusCode: 202,
   body: {status:"accepted", requestId}}` resolves the `enqueue` promise — transport sends the 202
   (`:214-215`). The scheduler logs `job.responded`.
4. `await yieldToEventLoop()` (`:224`) — *"Give transport's awaiting handler a turn to send the
   response before beginning follow-up work. The queue slot intentionally remains active."*
5. `work()` runs: `runAuditCapability` sleeps 250 ms and returns an object **that is thrown away**.
   `execute` does `await item.job.work()` and never reads the result (`:227`).
6. A throw here cannot change the response, so it is caught, logged as `job.deferred.failed`, and
   the queue is allowed to drain (`:233-242`).
7. Only then does `serialActive` go false (`:161`) and the next serial job start.

Three facts follow that an operator needs:

- **While `/audit` sleeps, every serial job in the backend is blocked.** Every mutating capability
  endpoint is serial. A 250 ms sleep is a 250 ms stall on all of them.
- **The 202 is chosen by the job, not by the scheduler or transport.** Transport only owns 404, 429
  and 500 ([02-request-and-job-runtime.md](../02-request-and-job-runtime.md) §1.2). Nothing in the
  runtime associates `deferred` with `202`; `auditCapability`'s wiring picked it.
- **There is no `AbortSignal`, no `stop()`, no `drain()` and no cancellation** anywhere in the job
  runtime. A deferred job that hangs holds its serial slot forever and shutdown does not wait for
  it.

### 4.3 `GET /health/queues` is the practical debugging entry point

The response has two halves and both are live:

**`queues`** is `scheduler.getState()` verbatim — `serialDepth`, `serialActive`,
`concurrentDepth`, `concurrentActive`, `concurrentWorkers`. Depths count **waiting** items only:
`tryRunSerial`/`tryRunConcurrent` `shift()` the item out of its array before executing it
(`scheduler.ts:149`, `:171`), so an executing job contributes to `*Active`, never to `*Depth`.
Queue capacity is likewise checked against waiting depth (`:88`), which is why a full queue and a
busy queue are different conditions.

**One live artefact worth knowing:** `concurrentActive` in the response **always includes the
queue-status job itself**, because `work()` runs while the worker slot is held. The probe above
shows `concurrentActive: 1` on an otherwise idle backend. It never reports 0.

**`registeredEndpoints`** is `registry.listEndpoints()` — `Array.from(this.factories.keys()).sort()`
(`0-utils/jobs/registry.ts:42-44`), the complete, lexically sorted list of every registered
`"<METHOD> <path>"` key. On a fully composed backend that is all **89**. There is no other way to
enumerate the API surface: there is no OpenAPI document, no route manifest file, and no
`GET /` index.

The same list is also the body of every 404
(`2-transport/registerHttpTransport.ts:62-66`), so a mistyped path returns the entire route
directory. Between the two, the running service is its own API reference.

### 4.4 What the four endpoints do **not** do

| Absent behaviour | Detail |
| --- | --- |
| Health does not check anything | No database ping, no scheduler check, no disk check, no config check. `status` is the literal `"ok"` |
| `/health/` 404s | No trailing-slash tolerance; the registry key is an exact string match |
| `HEAD /health` and `OPTIONS /health` 404 | `app.all("/*")` routes them to the handler, which then misses the keys `HEAD /health` / `OPTIONS /health`. There is no CORS preflight handling anywhere |
| No authentication, no rate limit, no CORS | `/echo` will reflect any JSON body to any caller |
| `/audit` audits nothing | No record is written and the function's return value is discarded |
| No `Retry-After` on 429 | The queue-full body is `{error, queueType}` and nothing else |

The full probe matrix is in
[02-request-and-job-runtime.md](../02-request-and-job-runtime.md) §1.1.

---

## 5 · Persistence and composition

### 5.1 Persistence

None. Built-in opens no SQLite connection, declares no table, and appears in none of the 12 `.db`
paths in `src/`. It is one of only two entries in the capability inventory with zero tables — the
other is [slides.md](slides.md), which has thirteen declared and zero created.

### 5.2 Composition — built-in is wired differently from every other capability

Every other capability is registered by an explicit call in `startBackend`
(`startBackend.ts:176-186`, eleven consecutive lines). Built-in is not: it is registered as a side
effect of constructing the registry.

```text
startBackend.ts:100   registry = createRegistry(scheduler)
  1-init/create/registry.ts:5-9        new JobRegistry(); registerEndpointMappings(registry, scheduler)
    4-job-wiring/internal/registerEndpointMappings.ts:11   registerBuiltInEndpointMappings(registry, scheduler)
      4-job-wiring/registerBuiltInEndpointMappings.ts      4 × registry.register(...)
```

`1-init/create/registry.ts` is 10 lines, with the comment
`// Build one process-wide endpoint registry, then load every job-wiring group.`
The fan-out file it calls is 12 lines and contains one call. Its comment (`:9-10`):

> ```
> // Keep initialization stable: it calls this one function while this file
> // fans out to each endpoint-registration group added under job wiring.
> ```

**That stated intent has not held.** No capability group was ever added to this file; all eleven are
registered directly from `startBackend`. The comment describes an abandoned design, and the file is
today a one-line indirection. The one document in the repository that gets this right is
built-in's own `runtime.md:8-10` — *"That fan-out currently calls only
`registerBuiltInEndpointMappings`; feature-specific endpoint groups are registered later during
backend startup."* — which is accurate and should survive whatever pass rewrites that package.

One practical consequence: because built-in is registered inside `createRegistry`, **the four
built-in endpoints exist in any composition that builds its registry that way, whether or not
`startBackend` got as far as registering anything else.** They are the endpoints that come free.

---

## 6 · Invariants

There is little to enforce, so the invariants are properties of the runtime that built-in
illustrates rather than rules built-in itself checks.

| Invariant | Where enforced |
| --- | --- |
| An endpoint key is `"<METHOD> <path>"`, uppercased method, exact match, no pattern and no path parameter | `registry.ts:46-48` |
| Registering the same key twice throws `Job already registered for endpoint '<key>'` at startup | `registry.ts:12-14` — so a duplicate built-in path would be a boot failure, not a silent shadow |
| A fresh job object is created per request; factories are shared, jobs never are | `registry.ts:5-7`, verbatim: `// Endpoint keys such as "POST /echo" resolve to factories, not shared jobs.` / `// A fresh job is created for every incoming request.` |
| A job's `id` is assigned by the registry, not the factory: `<slugified key>-<sequence>` | `registry.ts:33-39`, `:50-52` |
| A deferred job holds its queue slot until `work()` settles | `scheduler.ts:158-163` (`.finally` releases the slot), under the comment at `:156-157`: `// serialActive stays true for the entire job lifecycle, including any` / `// deferred work that runs after its HTTP response becomes available.` |
| Successful status codes are always chosen inside `work()`/`deferredWork()`; transport owns only 404/429/500 | `registerHttpTransport.ts:94-95` |
| `runQueueStatusCapability` must not mutate what it is given | it is the identity function; the guarantee is structural |

---

## 7 · Design decisions worth preserving

### 7.1 The registry maps factories, not jobs

`0-utils/jobs/registry.ts:5-7`:

> ```
> // Endpoint keys such as "POST /echo" resolve to factories, not shared jobs.
> // A fresh job is created for every incoming request.
> ```

and `:30-31`, on `createJob`:

> ```
> // Job wiring receives the normalized request here and captures whatever
> // request data its work functions need in a new concrete job.
> ```

`POST /echo` is the smallest possible demonstration of both: the factory takes `request` and closes
over three of its fields.

### 7.2 The deferred slot is held on purpose

`0-utils/jobs/scheduler.ts:156-157`:

> ```
> // serialActive stays true for the entire job lifecycle, including any
> // deferred work that runs after its HTTP response becomes available.
> ```

and `:222-223`:

> ```
> // Give transport's awaiting handler a turn to send the response before
> // beginning follow-up work. The queue slot intentionally remains active.
> ```

and `:234-236`, on why a post-response failure is swallowed:

> ```
> // The HTTP response has already been produced, so this failure cannot
> // change it. Record it through the shared logger while allowing the
> // queue to drain.
> ```

### 7.3 Transport owns three status codes and no more

`2-transport/registerHttpTransport.ts:94-95`:

> ```
> // Infrastructure errors choose their status here. Successful endpoint
> // status codes and bodies are always chosen by the job work function.
> ```

`POST /audit`'s 202 is the clearest case: nothing about `deferred` implies `202`; the endpoint
picked it.

---

## 8 · Known gaps and defects

### 8.1 There is no test of any built-in endpoint or function

Measured: a grep for the four literal paths across `src/` and `test/` returns exactly **five** hits
— the four `registry.register` calls in the wiring file, and one line in the smoke script. A grep
for the four function names across `test/` returns **nothing**.

The two suites the module's own `docs/README.md:49-55` names as its test map cover the **runtime**,
not this capability:

| Suite | What it actually asserts |
| --- | --- |
| `internal-jobs.test.ts` (7 tests) | Admission vs completion, `enqueue` semantics, capacity at admission, internal dispatch, duplicate/unknown intent rejection, shared serial FIFO, failed internal work releasing its slot — all with **synthetic** job objects constructed in the test |
| `runtime-wiring.test.ts` (8 tests) | Aliases, the `dev` script's `--conditions`, the composition-root module graph, scheduler logging and request correlation, provider-failure redaction, the `console.*` ban, sync-scheduler ordering — again with synthetic jobs |

`runtime-wiring.test.ts:56` (*"the composition root's module graph resolves"*) does load
`registerBuiltInEndpointMappings` transitively, so a broken import in built-in would fail it. It
asserts nothing about behaviour.

### 8.2 The smoke runner covers `/health` and a deliberate 404, and nothing else

`docs/README.md:56-57` says *"The HTTP smoke runner exercises these routes through the actual
service"*. It exercises **one** of them. `test/smoke/http-smoke.mjs` makes 41 requests; the ones
that touch this capability are:

| Line | Request | Asserted |
| ---: | --- | --- |
| 30-31 | `GET /health` | 200, then `health.status === "ok"` |
| 33 | `GET /smoke/missing` | 404 — a deliberately unmapped path, which exercises transport's 404 branch, not built-in |

**`GET /health/queues`, `POST /echo` and `POST /audit` have no smoke coverage at all**, which means
the only deferred job in the backend is never exercised against a running process by anything in
the repository. The deferred *mechanism* is covered by `runtime-wiring.test.ts:66-125` with a
synthetic job; `audit-deferred` itself is not.

The smoke runner is also not part of `pnpm test`. `apps/backend/package.json` declares
`"test": "tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts"`
and `"test:smoke": "node test/smoke/http-smoke.mjs"` as two separate scripts, and the root
`"test": "pnpm -r --if-present test"` runs only the first. The smoke script uses plain `node` with
no `tsx` and no `node:test`, requires an already-listening backend at
`ICARUS_SMOKE_BASE_URL` (default `http://127.0.0.1:4000`), and cleans up nothing it creates.

### 8.3 `/health` is not a health check

It reports `status: "ok"` unconditionally, from a literal type that admits no other value. It does
not touch the twelve SQLite connections, the scheduler, the logger, the config, or the retention
timer. A backend with every database corrupt, every queue full and the log sink failing returns the
same 200 as a healthy one. The frontend (`apps/frontend/src/main.ts:12`) treats it as a liveness
signal, which is the only thing it is.

`GET /health/queues` is the endpoint that actually reports state, and it is the one with no test
and no smoke coverage.

### 8.4 `POST /audit` writes no audit record

`runAuditCapability` sleeps and returns an object the scheduler discards. There is no store, no
logger call, and no side effect other than 250 ms of held serial capacity. It is a fixture that
happens to be routable. Anyone reading the endpoint list and expecting an audit trail will find
none — the closest real thing is the Activity ledger ([activity.md](activity.md)).

### 8.5 The fan-out comment describes an abandoned intent

`4-job-wiring/internal/registerEndpointMappings.ts:9-10` promises to *"fan out to each
endpoint-registration group added under job wiring"* and calls exactly one function. All eleven
capability groups are registered directly from `startBackend.ts:176-186`. Recorded in
[11-known-issues.md](../11-known-issues.md). Built-in's own `runtime.md:8-10` already documents the
practice correctly; the **source comment** is the thing that is stale.

### 8.6 The docs package overstates one thing and is otherwise exact

`README.md:56-57`'s "exercises these routes" is the single correction needed (§8.2). The 2026-08-09
survey read the other 415 lines against source and found no further contradiction: the
endpoint/queue/response table, the `JobRegistry` and `JobScheduler` method lists, the deferred
sequence diagram, and the statement that capacity limits bound waiting depth rather than active jobs
all hold. That package is not owned by this documentation set; a later pass owns `src/**/docs/`.

---

## See also

- [README.md](README.md) — the capability inventory; built-in is 4 of the 89 endpoints
- [../02-request-and-job-runtime.md](../02-request-and-job-runtime.md) — the registry, the two
  queues, the deferred sequence, the 404/429/500 split and the full status-probe matrix
- [../01-layers-and-boundaries.md](../01-layers-and-boundaries.md) — why `registerBuiltInEndpointMappings.ts`
  sits at the root of `4-job-wiring/` while every other group has a directory
- [activity.md](activity.md) — the capability that actually records what happened
- [slides.md](slides.md) — the other zero-table row in the inventory, for the opposite reason
- [../11-known-issues.md](../11-known-issues.md) — the abandoned fan-out, the missing shutdown
  drain, and the rest of the consolidated list
