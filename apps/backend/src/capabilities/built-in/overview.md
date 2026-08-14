# Built-in Overview

Lives at the capability root as `overview.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

Built-in is the capability that answers before anything else is wired. It owns
the two endpoints a backend process must serve to be worth starting: a liveness
answer and a request reflector.

It has no runtime object, no state, and no dependency on another capability, so
its registration takes nothing but the registry. It is still registered from
[the composition root](../../runtime/runtime.md) like every other capability —
the endpoint table has one filling place, and the spine imports no capability by
name.

## Boundary

Built-in owns:

- the `GET /health` payload shape (`ApiHealth`) and its fixed `backend` / `ok`
  identity — the backend owns it because the backend produces it;
- the `POST /echo` reflection contract: which parts of a request come back, and
  in what shape.

Consumers own:

- their own expectation of the wire format. A consumer that parses `/health`
  declares its own type; Built-in does not import one.
- what they conclude from a 200. `/health` reports that this process is running
  and answering, not that its database, providers, or configuration are usable.

## File Tree

```text
built-in/
├── overview.md
├── index.ts
├── endpoints/
└── test/
```

There is no `types/`, `runtime-objects/`, `runtime-api/`, `persistence/`, or
`errors.ts`. Built-in is endpoint-jobs and nothing else: each job is its own
complete procedure, so there is no runtime method for a job to delegate to, and
no failure it can report other than throwing.

## Dependency Ports

Built-in depends on no other capability. It imports `EndpointJob` and
`RouteRegistry` from [`#registry`](../../runtime/registry.md) and
`RequestEnvelope` from the web server's request context — the transport contract
every capability's endpoints are written against, not a capability dependency.

## Runtime Objects

None. Built-in constructs nothing and holds nothing across requests.

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `GET /health` | endpoint-job | — | Reports process identity and the moment it answered. | [health.md](endpoints/health/health.md) |
| `POST /echo` | endpoint-job | — | Reflects the request method, path, and body. | [echo.md](endpoints/echo/echo.md) |

`index.ts` exports `registerBuiltInEndpoints` and the `ApiHealth` type. Nothing
else leaves the capability.

## Capability Invariants

- Every answer is computed per request. Nothing is cached, memoized, or carried
  between requests, and nothing survives restart.
- Both endpoints answer 200 or throw. Neither has an expected failure, because
  neither admits input it can reject.
- Timestamps are ISO 8601 strings from `new Date().toISOString()`, produced at
  the moment the job answers rather than when the request arrived.
- `/health` never inspects another capability. A dependency-aware readiness
  endpoint would be a different endpoint, owned by whichever capability knows
  what "ready" means.
