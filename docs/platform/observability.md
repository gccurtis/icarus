# Platform — Icarus Observability & Logging Runtime

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281b5843cf6110d4ba1d9).

## Prerequisites
- Validated logging configuration.
- Writable log directory for the file-backed adapter.
- Initialization creates the Logger before any dependent Platform object or capability.
> **Platform authority.** Observability supplies the process-wide Logger used by initialization, Platform services, Jobs, and capability application services. The pushed implementation provides a stable `Logger` interface, a no-op adapter, and daily JSONL file logging.
## Repository placement
```plain text
apps/backend/src/0-platform/observability/logger.ts
apps/backend/src/1-init/create/logger.ts
apps/backend/etc/configuration.yaml
logs/
```
## Public interface
```typescript
interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```
`createLogger` returns `NoopLogger` when logging is disabled and `FileLogger` when enabled. The file adapter writes one JSON object per line to `backend-YYYY-MM-DD.log` and applies the configured minimum level.
## Ownership boundary
<table fit-page-width="true" header-row="true">
<tr>
<td>Concern</td>
<td>Authority</td>
</tr>
<tr>
<td>Stable logging interface, level filtering, safe structured fields, sink lifecycle, and correlation conventions</td>
<td>Observability</td>
</tr>
<tr>
<td>Accepted domain activity and compensation history</td>
<td>The owning capability and Collaboration Activity projection</td>
</tr>
<tr>
<td>Research and Agent step records</td>
<td>Research and Agents</td>
</tr>
<tr>
<td>Queue state</td>
<td>Scheduler and Job runtime</td>
</tr>
<tr>
<td>Visible error contracts</td>
<td>The owning Platform service or capability</td>
</tr>
</table>
Operational logs may be rotated according to deployment policy. Canonical recovery uses capability stores, receipts, attempts, Bases, and ChangeSets.
## Construction and injection
```plain text
configuration
  -> Logger
    -> Intelligence, Formula, Knowledge, database adapters
      -> scheduler and registry
        -> capability services
          -> job wiring
            -> Fastify listen
```
Capabilities receive the `Logger` interface. Sink paths and concrete sink classes remain in initialization. Tests use `NoopLogger` or an in-memory recording adapter.
## Correlation fields
```plain text
requestId
jobId
jobName
queueType
capability
operation
aggregateType
aggregateId
revision
runId
stageId
actorId
durationMs
status
errorCode
```
Generic logging records identities, digests, counts, durations, states, and stable error codes. Prompts, extracted text, cell values, credentials, connector tokens, provider payloads, and authored content require explicit bounded redaction before logging.
## Runtime events
- Startup configuration summary with secrets removed.
- Registered endpoint count and route registration failures.
- Job enqueue, start, response-ready, finish, failure, cancellation, and overload.
- Queue depth and concurrent active count.
- Migration start, completion, and failure.
- Provider purpose, Cast, latency, usage, and error code without content.
- Capability request identity, accepted revision, stage transition, and terminal outcome.
- Graceful shutdown start and completion.
Deferred Jobs record response-ready separately from follow-up completion.
## File record
```typescript
interface LogRecord {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}
```
Each record is independently valid JSON and ends with one newline. Fields are canonicalized before serialization so repeated structured values produce stable key ordering in tests.
## Failure behavior
Logger adapters catch sink failures, expose a bounded fallback signal on standard error, and prevent logging errors from changing a domain result or partially mutating a capability transaction. Shutdown flushes and closes the active sink.
## Invariants
- Disabled logging requires no conditional branches outside `createLogger`.
- One log record is valid JSON on one line.
- Minimum-level filtering is deterministic.
- Generic serialization never includes sensitive work content.
- Logging calls cannot change Platform or capability outputs.
- A sink failure cannot corrupt a capability transaction.
- Request, Job, stage, aggregate, and revision identities remain traceable across boundaries.
## Acceptance criteria
- Enabled logging creates the configured directory and daily JSONL file.
- Disabled logging writes nothing while callers use the same interface.
- Level filtering covers debug, info, warn, and error.
- Request and Job identities can be followed across transport, queues, and application services.
- Deferred Jobs expose response-ready and final outcome as separate events.
- Provider calls report route and usage metadata without request or response content.
- Sink failure produces a bounded fallback signal and preserves the caller result.
## Sources
- [Icarus Logger implementation](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/observability/logger.ts)
- [Icarus Logger construction](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/1-init/create/logger.ts)
- <mention-page url="../runtime/dual-queue.md"/>
