# Backend Architecture

## Layered Runtime Model

The backend source is organized to mirror runtime layers:

- `src/init`: runtime object construction and startup orchestration.
- `src/transport`: transport-facing request handlers and endpoint registration.
- `src/job-wiring`: endpoint-to-job mapping and queue wiring.
- `src/capabilities`: pure capability libraries with no transport awareness.

## Directory Aliases

Aliases are defined to avoid fragile deep relative imports:

- `#init/*`
- `#transport/*`
- `#job-wiring/*`
- `#capabilities/*`
- `#config/*`

These aliases are configured in backend `package.json` `imports` and `tsconfig.json` `paths`.

## Request-to-Job Flow

1. Transport receives `POST /requests/:requestType`.
2. Transport normalizes request data into a request envelope.
3. `JobRegistry` (job-wiring layer) maps the request type to a job factory.
4. Job factory builds a job with:
   - `execute` work function
   - `queueType` (`serial` or `concurrent`)
   - `responseMode` (`inline` or `deferred`)
5. `JobScheduler` enqueues by queue type and runs work according to queue semantics.

## Queue Execution Model

- Serial queue:
  - Runs one job at a time.
  - Preserves strict in-order execution.
- Concurrent queue:
  - Runs up to `workerPool.concurrentWorkers` jobs concurrently.
  - Additional jobs wait in queue until a worker is free.

## Response Modes

- `inline`:
  - API waits for work completion.
  - Work result becomes HTTP response payload.
- `deferred`:
  - API returns `202 Accepted` after enqueue.
  - Work function continues asynchronously.

## Job Wiring vs Capabilities

Job wiring owns endpoint registration and queue/response behavior.
Capabilities only provide reusable business functions.

Current endpoint mappings:
- `src/job-wiring/internal/registerInternalEndpointMappings.ts`

Current capability libraries:
- `src/capabilities/internal/echoCapability.ts`
- `src/capabilities/internal/auditCapability.ts`

## Configuration

Backend tuning values are sourced from `apps/backend/etc/configuration.yaml`:

- `server.host`
- `server.port`
- `workerPool.concurrentWorkers`
- `queue.serialMaxSize`
- `queue.concurrentMaxSize`
