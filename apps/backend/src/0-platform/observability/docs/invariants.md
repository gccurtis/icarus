# Observability guarantees and invariants

## Outcome guarantees

For a valid declared level, JSON-serializable data and writable filesystem:

| Input/precondition | Guaranteed current outcome |
| --- | --- |
| Logging disabled | Every injected method returns without output |
| Event rank below configured minimum | No entry or writer call |
| Accepted event | Fresh ISO timestamp, exact level/message, data included iff not `undefined` |
| Enabled accepted event | One synchronous append call containing one JSON object plus newline |
| Date changes between writes | Next event selects a newly named local-date file |
| Deferred follow-up throws | `job.deferred.failed` is emitted and queue drains without changing response |
| Successful HTTP Job | Transport completion event includes request ID and execution Job ID/name/queue |

Noop and File implementations satisfy the same structural interface, so callers do not branch on `enabled`.

## Level filtering

With `debug | info | warn | error`, filtering is deterministic and inclusive. An `info` minimum writes info/warn/error but not debug. Filtering happens before timestamp construction and serialization.

The configuration parser accepts any nonempty string, while the factory casts to `LogLevel`. An unknown configured value yields an undefined minimum rank and currently causes the `<` comparison to be false for all declared levels, effectively allowing all events. Valid-level enforcement is not an Observability guarantee today.

## Record and file invariants

- The factory appends `\n`, so each successful call occupies one JSONL line.
- Each line is independently valid JSON if normal `JSON.stringify` succeeds.
- Top-level key insertion order is timestamp, level, message, then optional data.
- Directory creation is recursive and happens once during construction.
- Filename is recomputed on every accepted write.

Current non-guarantees:

- canonical/sorted nested field order;
- schema stability for `data` or message names;
- maximum record/file size;
- retention, compression or deletion of old files;
- cross-process locking/order;
- a filename date that matches the UTC timestamp date in all time zones;
- durability after process/power failure beyond synchronous Node append return;
- exactly-once semantic event delivery if caller retries an operation.

## Concurrency and performance

Node executes each logging call synchronously, so within one event loop the writer finishes before that call returns. Asynchronous tasks interleave according to normal JavaScript scheduling; there is no sequence number. Multiple processes can target the same file with no application lock.

Synchronous stringify/append blocks request and Job execution. There is no buffer, worker, sampling, rate limit, backpressure signal or batch. `NoopLogger` avoids those costs when disabled.

## Correlation invariants

The concrete transport/registry/scheduler path preserves Fastify request ID into `RequestEnvelope`, `Job.requestId`, scheduler lifecycle events and `http.request.completed`. Runtime tests assert that join.

Correlation is not globally enforced:

- capabilities may not receive Job ID;
- Logger has no ambient/child context;
- internal Jobs may have capability-generated request IDs rather than an HTTP ID;
- event `data` is untyped and can omit or misname fields.

Consumers should treat request/job/resource/revision fields as event-specific conventions.

## Failure behavior

The adapters do not catch failures. The following propagate synchronously and can alter domain/startup control flow:

- directory creation/path permission errors;
- `JSON.stringify` failures such as circular references or `bigint`;
- append/open/disk errors;
- an injected custom writer throwing.

There is no fallback signal, retry, health state, flush or close. This differs from the target assertions in the older platform reference. `NoopLogger` itself cannot fail from message/data content because it never serializes them.

Because capability code often logs inside operational paths, a sink failure can occur before or after a database mutation. Logger is not transaction-aware and cannot roll back its already-written line.

## Information security

Observability performs no redaction, allowlisting, truncation or secret detection. `data` is serialized verbatim under ordinary JSON rules. Callers are responsible for excluding prompts, source text, credentials, provider payloads, connector secrets and other authored/private content.

Current positive practices are caller-specific, not adapter guarantees:

- Formula/Rich Text log counts and kinds rather than source/value content;
- OpenRouter errors drain but omit provider response bodies before they reach diagnostics;
- transport/scheduler error helpers omit stacks but include error messages;
- startup logs provider/model identifiers but not the configured API key.

File permissions inherit process umask/filesystem defaults. The logger does not set restrictive modes. Log-directory paths are trusted configuration.

## Determinism and observability limits

Level decisions and record shape are deterministic for valid configuration, but timestamps, filesystem paths by date and asynchronous event ordering are naturally time-dependent. The sink does not promise stable serialized bytes for semantically equal objects with different insertion order.

Logs are not metrics or traces: duration values are manually measured/rounded by callers, event coverage varies, and there is no aggregation, sampling metadata, span status or clock abstraction.

## Tests proving current behavior

[`runtime-wiring.test.ts`](../../../../test/capabilities/runtime-wiring.test.ts) verifies:

- scheduler enqueue/start/respond/deferred-failure events and queue timing fields;
- request ID propagation from HTTP through Job logs and completion Job ID;
- provider response body redaction before errors;
- startup/scheduler do not call `console.*` in the guarded source files;
- recurring Connector scheduling begins only after listener bind.

[`CapturingLogger`](../../../../test/helpers/testDoubles.ts) is used throughout capability tests to inspect events without files. [`http-smoke.mjs`](../../../../test/smoke/http-smoke.mjs) supplies end-to-end traffic used to inspect actual JSONL output. There is currently no focused test in this directory for `FileLogger` threshold matrix, daily rollover, filesystem failure, circular data, or invalid configured level.

## Explicit non-goals/current omissions

- No Observability endpoint, Job, SQL table or canonical audit log.
- No metrics, traces/spans, profiling, dashboards or remote export.
- No child/context logger or automatic correlation enrichment.
- No sink lifecycle, flush/close, buffer, retry or fallback.
- No enforced event schemas, redaction or size limits.
- No rotation beyond choosing a daily filename.
- No guarantee that logging failure is isolated from a domain operation.
