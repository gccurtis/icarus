# Observability endpoint and Job flows

## No Observability endpoint or Job

Observability is injected infrastructure. It registers no route, creates no Job and owns no scheduler queue. Its methods are called synchronously inside other runtime paths.

## Startup flow

```mermaid
sequenceDiagram
  participant Main as index.ts
  participant Config as createConfig
  participant LF as createLogger
  participant Log as Logger
  participant Start as startBackend
  participant App as Fastify
  Main->>Start: startBackend()
  Start->>Config: load/validate configuration
  Config-->>Start: BackendConfig
  Start->>LF: createLogger(config)
  LF-->>Start: NoopLogger or FileLogger
  Start->>Log: Backend starting
  Start->>Start: construct/register/recover
  Start->>App: listen
  App-->>Start: bound
  Start->>Log: Backend listening
  alt post-logger failure
    Start->>Log: backend.start.failed
    Start-->>Main: reject
    Main->>Main: process.exitCode = 1
  end
```

Configuration or logger-construction failures occur before the `try` block has a usable logger and therefore are not written through this component.

## Inline HTTP Job flow

Every registered HTTP endpoint passes through [`registerHttpTransport.ts`](../../../2-transport/registerHttpTransport.ts). Endpoint-specific logging may occur inside the Job/capability between scheduler events.

```mermaid
sequenceDiagram
  participant Client
  participant HTTP as Fastify transport
  participant Registry as JobRegistry
  participant Scheduler as JobScheduler
  participant Capability
  participant Log as Logger
  Client->>HTTP: request
  HTTP->>Registry: createJob(RequestEnvelope)
  Registry-->>HTTP: Job with requestId/jobId
  HTTP->>Scheduler: enqueue(job)
  Scheduler->>Log: job.enqueued
  Scheduler->>Log: job.started
  Scheduler->>Capability: work()
  Capability->>Log: capability-specific events
  Capability-->>Scheduler: status/body
  Scheduler->>Log: job.completed
  Scheduler-->>HTTP: JobExecutionResult
  HTTP->>Log: http.request.completed
  HTTP-->>Client: response
```

For an unregistered method/path, transport logs `http.route.not-found` and returns 404 without a Job. For queue capacity, scheduler logs `job.queue.capacity`, transport logs `http.request.rejected`, and returns 429. An inline work exception produces `job.failed` then `http.request.failed`; Fastify handles the rethrown error response.

## Deferred Job flow

The built-in `POST /audit` route demonstrates deferred mode. The selected queue slot remains occupied through follow-up work.

```mermaid
sequenceDiagram
  participant HTTP
  participant Scheduler
  participant Log as Logger
  participant Deferred as deferredWork
  participant Work as follow-up work
  HTTP->>Scheduler: enqueue deferred Job
  Scheduler->>Log: job.enqueued
  Scheduler->>Log: job.started
  Scheduler->>Deferred: create response after queue start
  Deferred-->>Scheduler: 202 response
  Scheduler->>Log: job.responded
  Scheduler-->>HTTP: response-ready result
  Scheduler->>Work: after event-loop yield
  alt follow-up succeeds
    Work-->>Scheduler: complete
    Scheduler->>Log: job.completed
  else follow-up fails
    Work-->>Scheduler: error
    Scheduler->>Log: job.deferred.failed
  end
```

Because the completion promise already resolved at response-ready, deferred failure is observable only through logs and capability durable state. It cannot change the HTTP status.

## Capability mutation flow

There is no common capability middleware. Each service decides when to log around persistence/compensation. A representative resource path is:

```mermaid
flowchart LR
  Endpoint["endpoint Job"] --> Service["capability service"]
  Service --> StartEvent["operation/start debug or info"]
  Service --> Store["SQLite mutation"]
  Store --> SideEffect["Knowledge/Derived/internal dispatch"]
  SideEffect --> EndEvent["completion/revision/duration event"]
  SideEffect --> FailureEvent["error/compensation event"]
  EndEvent --> File["shared JSONL"]
  FailureEvent --> File
```

Event-to-commit ordering must be checked in the owning service; Logger supplies no transaction integration. Logs written before a later rollback remain in the file.

## Formula and Rich Text nested calls

Formula and Rich Text receive the same Logger but no request/job context. During a Structured Data evaluation or Document mutation they emit local duration/count events, while outer scheduler/transport/host events carry correlation. There is no automatic parent-child span relationship.

## JSONL write flow

```mermaid
sequenceDiagram
  participant Caller
  participant FL as FileLogger
  participant Writer as writeEntry closure
  participant FS as filesystem
  Caller->>FL: warn(message, data)
  FL->>FL: compare rank + timestamp
  FL->>Writer: LogEntry
  Writer->>Writer: JSON.stringify + newline
  Writer->>Writer: join(directory, dailyFileName())
  Writer->>FS: appendFileSync
  FS-->>Caller: synchronous return
```

Any serialization/path/filesystem error unwinds this call chain. There is no secondary sink, retry, or console fallback.

## Testing flow

Most unit tests inject [`CapturingLogger`](../../../../test/helpers/testDoubles.ts), inspect calls in memory, and avoid filesystem output. [`runtime-wiring.test.ts`](../../../../test/capabilities/runtime-wiring.test.ts) proves scheduler event shape and HTTP/Job request correlation. The production [`http-smoke.mjs`](../../../../test/smoke/http-smoke.mjs) generates requests that exercise the actual configured JSONL path when the built service is started in an isolated working directory.
