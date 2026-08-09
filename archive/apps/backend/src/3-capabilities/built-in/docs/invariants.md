# Built-in guarantees and invariants

## Guaranteed outcomes

Given a request admitted to a running process and a capability function that
does not throw:

- health returns the fixed backend/ok identity and an ISO timestamp;
- echo preserves the normalized method, exact registered path, and body value;
- queue status returns a self-consistent synchronous scheduler snapshot and
  sorted registry endpoint list;
- audit returns 202 after reaching the serial queue head and keeps that slot
  occupied through its 250 ms follow-up.

These are process-local guarantees; none survive restart.

## Registry and identity invariants

- One factory may be registered per normalized `METHOD /path` key.
- Every request produces a fresh job.
- Job IDs are unique only within one registry instance's lifetime.
- Request ID, when present, is copied to the job and execution result.
- Endpoint listing is lexically sorted.

## Queue, concurrency, and atomicity

- A job belongs to exactly one waiting queue based on `queueType`.
- At most one serial job is active.
- Concurrent active count does not exceed configured workers.
- Capacity checks and queue insertion are synchronous within one JavaScript
  event-loop turn.
- Capacity limits apply to waiting depth, not active jobs.
- A deferred job retains its selected slot after response through follow-up.
- There is no cross-process coordination or persistence; two backend processes
  have independent queues and IDs.

## Failure behavior

- Unknown or duplicate endpoint registration throws a generic `Error`.
- Full queue admission throws `QueueCapacityError` before a receipt is returned.
- Inline work failure rejects job completion and is logged as `job.failed`.
- Deferred response creation failure rejects completion.
- Deferred follow-up failure is logged as `job.deferred.failed`; it cannot alter
  the already-produced HTTP response and does not stop queue drainage.

## Security and data handling

- Echo deliberately returns its received body and therefore must not be treated
  as a secret-safe endpoint.
- Audit retains no record and does not establish compliance-grade auditing.
- Queue status exposes registered route names and live capacity state.
- This package performs no authentication or authorization; any access policy
  must be enforced by surrounding transport/deployment layers.

## Tests and observability

Scheduler logs include job ID/name, optional request ID, queue/response mode,
queue wait, duration, status, and queue depths. Tests cover admission versus
completion, capacity, serial FIFO shared with internal jobs, slot release,
structured logging, and HTTP/job correlation.

## Non-goals

- dependency readiness or liveness orchestration;
- durable jobs, results, retries, or audit records;
- a stable metrics API;
- payload validation or transformation for echo;
- distributed queue fairness;
- authentication, rate limiting, or administration.
