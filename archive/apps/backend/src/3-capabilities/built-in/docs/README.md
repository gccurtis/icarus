# Built-in capability

## Status and authority

The Built-in capability is implemented and registered during creation of the
process-wide endpoint registry. It provides four small operational endpoints:
health, queue inspection, request echo, and a deferred serial audit example.
Its functions do not own durable state. Current time, the `JobScheduler`, and
the `JobRegistry` are authoritative for the values they return.

This package documents current code. It does not treat the endpoints as a
general administration, authentication, or audit-log subsystem.

## Start here

- [Concepts](concepts.md) explains the boundary and architecture.
- [Types](types.md) maps the request, job, response, and queue-state types.
- [Runtime](runtime.md) documents every capability function and its supporting
  registry/scheduler objects.
- [Flows](flows.md) maps every endpoint to its job and function call chain.
- [Invariants](invariants.md) lists the guarantees, limits, and non-goals.

## Source map

| Concern | Current source |
| --- | --- |
| Health function | [`healthCapability.ts`](../healthCapability.ts) |
| Echo function | [`echoCapability.ts`](../echoCapability.ts) |
| Audit function | [`auditCapability.ts`](../auditCapability.ts) |
| Queue-status function | [`queueStatusCapability.ts`](../queueStatusCapability.ts) |
| Endpoint-to-job mapping | [`registerBuiltInEndpointMappings.ts`](../../../4-job-wiring/registerBuiltInEndpointMappings.ts) |
| Built-in registration fan-out | [`registerEndpointMappings.ts`](../../../4-job-wiring/internal/registerEndpointMappings.ts) |
| Registry factory | [`create/registry.ts`](../../../1-init/create/registry.ts) |
| Job definitions and state | [`jobs/types.ts`](../../../0-utils/jobs/types.ts) |
| Endpoint registry | [`jobs/registry.ts`](../../../0-utils/jobs/registry.ts) |
| Queue scheduler | [`jobs/scheduler.ts`](../../../0-utils/jobs/scheduler.ts) |
| HTTP transport | [`registerHttpTransport.ts`](../../../2-transport/registerHttpTransport.ts) |

## Dependency map

The pure capability functions depend only on their input, the clock, and—for
`runAuditCapability`—a 250 ms timer. Job wiring depends on the shared registry
and scheduler. The HTTP transport creates a normalized request envelope,
creates a fresh registered job, and awaits the scheduler's response.

The capability has no SQLite tables, background recovery, internal job intent
runtime, Formula, Knowledge, Intelligence, or resource dependencies.

## Test map

Queue admission, serial FIFO, capacity handling, logging, and request/job
correlation are covered by
[`internal-jobs.test.ts`](../../../../test/capabilities/internal-jobs.test.ts)
and
[`runtime-wiring.test.ts`](../../../../test/capabilities/runtime-wiring.test.ts).
The HTTP smoke runner exercises these routes through the actual service in
[`http-smoke.mjs`](../../../../test/smoke/http-smoke.mjs).
