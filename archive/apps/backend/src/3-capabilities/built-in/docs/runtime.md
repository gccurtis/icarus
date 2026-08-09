# Built-in runtime and functions

## Construction

[`createRegistry`](../../../1-init/create/registry.ts) constructs one
`JobRegistry` and calls
[`registerEndpointMappings`](../../../4-job-wiring/internal/registerEndpointMappings.ts).
That fan-out currently calls only
[`registerBuiltInEndpointMappings`](../../../4-job-wiring/registerBuiltInEndpointMappings.ts);
feature-specific endpoint groups are registered later during backend startup.

## Capability functions

### `runHealthCapability()`

Returns `{ service: "backend", status: "ok", timestamp }`. It does not inspect
the scheduler, database, external provider, or other capability readiness.

### `runEchoCapability(input)`

Copies `method`, `path`, and `body` into a new result and adds `processedAt`.
The body is neither validated nor transformed by this function.

### `runAuditCapability(input)`

Waits 250 ms using `node:timers/promises`, then returns the optional request ID
and `auditedAt`. It has no store or logger dependency; queue-level logging is
performed by the scheduler. The return value is discarded by the deferred job.

### `runQueueStatusCapability(input)`

Returns its input object unchanged. Wiring obtains a new scheduler state and a
sorted endpoint list immediately before calling it.

## `registerBuiltInEndpointMappings(registry, scheduler)`

Registers exactly four factories. Every factory returns a fresh definition;
none reuse concrete `Job` objects. The complete method/queue mapping is in
[Flows](flows.md).

## `JobRegistry`

Public methods in [`jobs/registry.ts`](../../../0-utils/jobs/registry.ts):

- `register(endpoint, factory)` rejects duplicate normalized endpoint keys.
- `has(endpoint)` checks a normalized key.
- `createJob(request)` rejects unknown keys, invokes the factory, increments a
  process-local sequence, derives a path-based ID prefix, and copies request ID.
- `listEndpoints()` returns sorted normalized keys.

Private helpers produce `METHOD /path` keys and lowercase hyphenated job-ID
prefixes.

## `JobScheduler`

Public methods in [`jobs/scheduler.ts`](../../../0-utils/jobs/scheduler.ts):

- `enqueue(job)` admits and awaits eventual completion.
- `admit(job)` checks waiting-queue capacity synchronously, creates completion
  callbacks, queues the item, starts queue drainage, and returns immediately.
- `getState()` reports current queue/worker state.

Supporting behavior:

- `tryRunSerial` holds one serial slot for the entire job lifecycle.
- `tryRunConcurrent` starts waiting work until the configured worker ceiling.
- `execute` implements inline/deferred response semantics and structured
  `job.started`, `job.responded`, `job.completed`, and failure logs.
- `logEnqueued` logs queue depths and active counts.
- `createExecutionResult` carries response and correlation metadata.

For deferred jobs, `execute` resolves the response, yields one event-loop turn,
then runs follow-up work without releasing its queue slot. A follow-up failure
is logged as `job.deferred.failed` because the response can no longer change.

## Auxiliary runtime functions

The scheduler's `errorFields` reduces unknown errors to name/message fields. A
no-op logger permits isolated scheduler construction, while production injects
the shared structured logger. Registry ID normalization replaces non-alphanumeric
runs with one hyphen and trims edge hyphens.
