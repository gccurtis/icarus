# Observability runtime and functions

## Core adapter runtime

### `NoopLogger.debug/info/warn/error`

Inputs are message and optional data; output is `void`; there are no side effects. No level branch is needed at call sites.

### `FileLogger.debug/info/warn/error`

Each method delegates to private `log` with a fixed level. `log` compares the level rank to `minLevel`, constructs a timestamped `LogEntry`, conditionally adds `data`, and invokes the injected writer. Filtered calls do not timestamp, serialize or write.

There is no asynchronous work or queue. A return means the writer returned; it does not necessarily imply durable media flush beyond Node's synchronous append semantics.

## Initialization factory

[`createLogger(config)`](../../../initialization/runtimes/logger.ts) is the concrete runtime factory:

1. If disabled, return `new NoopLogger()`.
2. Read the configured directory.
3. `mkdirSync(directory, { recursive: true })`.
4. Define `writeEntry`: stringify entry, recompute daily path, `appendFileSync(path, line, "utf-8")`.
5. Construct `FileLogger` using a cast config level.

The local `dailyFileName()` uses `new Date()` and local `getFullYear/getMonth/getDate`, padding month/day. A write after local midnight automatically selects the new file without recreating the logger.

## Composition root

[`create-runtime.ts`](../../../initialization/create-runtime.ts) creates config then logger before all other runtime objects. The same instance is passed to:

- Intelligence, Context, resource registry, Knowledge, Formula, Structured Data resolver, Rich Text;
- General Files, Connector, Derived Outputs, Document and Slide;
- Connector recurring sync scheduler;
- Job Scheduler and HTTP transport.

Startup emits `Backend starting`, readiness flags, attempt recovery counts, `Backend listening`, and `backend.start.failed` for post-logger startup exceptions. [`index.ts`](../../../index.ts) only sets process exit status on rejection; it does not bypass Logger with `console`.

## Consumer catalog

The following are current direct Logger consumers and the major event groups they own:

| Consumer | Source | Events/data responsibility |
| --- | --- | --- |
| Startup | [`create-runtime.ts`](../../../initialization/create-runtime.ts) | readiness, listener, recovery, startup failure |
| HTTP transport | [`registerHttpTransport.ts`](../../../api/registerHttpTransport.ts) | route miss, completion, overload rejection, unexpected failure |
| Job Scheduler | [`scheduler.ts`](../../../workflows/scheduler.ts) | enqueue/start/respond/complete, capacity, inline/deferred failure |
| Intelligence | [`intelligence.ts`](../../intelligence/intelligence.ts) | route/provider/model latency and usage metadata |
| Formula | [`engine.ts`](../../formula/engine.ts) | parse/bind/dependency/evaluation counts/timing/errors |
| Rich Text | [`engine.ts`](../../rich-text/engine.ts) | overlay/style/apply/failed-validation timing/counts |
| Knowledge | [`knowledge.ts`](../../knowledge/knowledge.ts) | source mutation/add/remove/retrieval and listener failures |
| Context | [`context.ts`](../../../capabilities/context/context.ts) | reads, declarations, updates, resolve/compose timing |
| Structured Data | [`structured-data.ts`](../../../capabilities/structured-data/structured-data.ts) | declaration/query/mutation revisions/counts |
| Formula resolver | [`formula-name-resolver.ts`](../../../initialization/runtimes/formula-name-resolver.ts) | cache/build/issues |
| Resource registry | [`resource-reader.ts`](../../../initialization/runtimes/resource-reader.ts) | scope resolution/read denial |
| General Files | [`generalFileService.ts`](../../../capabilities/general-files/application/generalFileService.ts) | upload/update/delete and Knowledge compensation |
| Connector | [`connectorService.ts`](../../../capabilities/connector/application/connectorService.ts) | registration/sync/read/delete/reconciliation |
| Connector scheduler | [`connectorSyncScheduler.ts`](../../../initialization/runtimes/connectorSyncScheduler.ts) | timer lifecycle/discovery/enqueue failures |
| Derived Outputs | [`derived-outputs.ts`](../../../capabilities/derived-outputs/derived-outputs.ts) | definitions, refresh/tool/settlement/invalidation |
| Document | [`documentService.ts`](../../../capabilities/document/application/documentService.ts) | command/internal-stage/recovery failures |
| Slide composition seam | [`create/slide.ts`](../../../initialization/runtimes/slide.ts), [`registerSlideEndpoints.ts`](../../../api/routes/slide/registerSlideEndpoints.ts) | Injected logger and endpoint registration/unexpected-error events; the referenced Slide application service module is currently absent |
| Endpoint wiring | [`api/routes/`](../../../api/routes/) | endpoint registration and capability-specific unexpected errors |

This table documents direct imports/calls, not a guarantee that every branch emits a log.

## Transport and scheduler helpers

The transport/scheduler each define a local `errorFields(error)` helper. It records `Error.name/message`, or `UnknownError` plus `String(error)`. These helpers do not include stacks.

Transport logs:

- `http.route.not-found`: request/method/path/status/duration;
- `http.request.completed`: request/job/name/queue/method/path/status/duration;
- `http.request.rejected`: request/method/path/status/queue/duration/error for capacity;
- `http.request.failed`: request/method/path/status/duration/error then rethrows.

Scheduler logs:

- `job.enqueued`: IDs/name/queue/mode/depth/active state;
- `job.started`: identity, queue wait and mode;
- `job.responded`: deferred response timing/status;
- `job.completed`: total timing/status;
- `job.queue.capacity`, `job.failed`, `job.deferred.failed`.

Deferred failure is logged after the HTTP response and intentionally does not reject the already resolved response promise.

## Fastify and standard output

[`createApp`](../../../initialization/runtimes/app.ts) sets `Fastify({ logger: false })`, so Fastify does not create an independent stdout stream. Runtime tests guard `index.ts` and scheduler against `console.*`. This is a scoped code guard, not an automated repository-wide prohibition on every possible dependency's output.

## Side effects and performance

Enabled logging performs a synchronous filesystem append for every accepted event. This makes ordering straightforward within the single Node process but blocks the event loop for serialization and I/O. There is no rate limit, record-size bound, buffer or backpressure policy beyond whatever blocking/error behavior the filesystem provides.
