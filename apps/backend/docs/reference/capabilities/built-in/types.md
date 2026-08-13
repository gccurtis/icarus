# Built-in types

## Capability inputs and results

| Type | Fields and result | Source |
| --- | --- | --- |
| `ApiHealth` | Result with `service: "backend"`, `status: "ok"`, and ISO timestamp. Owned here, because the backend produces it. | `healthCapability.ts` |
| `EchoCapabilityInput` | `method`, `path`, and opaque `body`; result adds `processedAt`. | `echoCapability.ts` |
| `AuditCapabilityInput` | Optional `requestId`; result returns `acceptedRequestId` and `auditedAt`. | `auditCapability.ts` |
| `QueueStatusCapabilityInput` | `queues: JobSchedulerState` and sorted `registeredEndpoints`; the result is the same object. | `queueStatusCapability.ts` |

All timestamps are created with `new Date().toISOString()`. No capability input
decoder is defined here; health and queue status have no body, while echo and
audit consume values captured from the normalized request.

## Request types

`types/request.ts` defines:

- `RequestEndpoint`: method and path used for registry keys.
- `IncomingRequest`: framework-facing ID, method, URL, params, query, headers,
  and body.
- `RequestEnvelope`: normalized endpoint plus optional `requestId`, record
  params/query/headers, and opaque body; passed to every `JobFactory`.

Registry keys uppercase the method and retain the exact path, for example
`GET /health`.

## Job type family

`jobs/types.ts` is canonical:

| Type | Meaning |
| --- | --- |
| `QueueType` | `"serial" | "concurrent"`. |
| `ResponseMode` | `"inline" | "deferred"`. |
| `JobResponse` | HTTP status plus optional body and string headers. |
| `InlineJobDefinition` | Name, queue, inline mode, and `work(): Promise<JobResponse>`. |
| `DeferredJobDefinition` | Name, queue, deferred mode, response-producing `deferredWork`, and follow-up `work`. |
| `JobDefinition` | Discriminated union of inline/deferred definitions. |
| `Job` | Definition plus unique `id` and optional transport `requestId`. |
| `JobExecutionResult` | Job/request identity, name, queue, response timestamp, and `JobResponse`. |
| `JobAdmissionReceipt` | Job ID and admission timestamp. |
| `JobAdmission` | Immediate receipt plus eventual completion promise. |
| `JobFactory` | `(request: RequestEnvelope) => JobDefinition`. |

## Scheduler state and configuration

`JobSchedulerState` contains:

- `serialDepth`: waiting serial items, excluding the active item;
- `serialActive`: whether one serial job owns the slot;
- `concurrentDepth`: waiting concurrent items;
- `concurrentActive`: occupied concurrent workers;
- `concurrentWorkers`: configured worker ceiling.

`JobSchedulerConfig` supplies the worker ceiling and maximum waiting depth for
each queue. `QueueCapacityError` records which `QueueType` rejected admission.
The limits constrain waiting arrays; an already active job is not counted in
the depth limit.

## Persistence and error types

There are no Built-in persistence types or SQL tables. Capability functions do
not define domain errors. Registry duplicate/missing endpoint cases use `Error`;
scheduler capacity uses `QueueCapacityError`; unexpected work failures reject
inline execution or are logged after a deferred response.
