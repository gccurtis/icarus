# API: `registerTransport`

Lives at `runtime-api/register-transport/register-transport.md`.

Installs the backend's HTTP dispatch. Called once during startup, after the
registry has been built and observability exists, and before `listen`. Every HTTP
request the backend ever answers passes through the single handler this method
registers.

## Classification

- **Owner:** `WebServerRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`register-transport.ts`](register-transport.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `registry` | `RouteRegistry` | The endpoint table to dispatch through. It is read on every request, so endpoints registered after this call are served. |
| `logger` | `Logger` | Records the three request events. Captured by the handler closure for the runtime's lifetime. |

The Fastify instance is supplied by the runtime object, not by the caller.

## Output

`void`

Registration either succeeds or throws. There is no handle to unregister with:
the transport lives as long as the server.

## Failures

None defined by this capability. Fastify throws if a `/*` route is already
registered, which only happens when the method is called twice — a wiring bug
that should stop startup.

A request that fails is not a failure of this method. See Effects.

## Effects

- One Fastify `all("/*")` route is registered.
- Thereafter, each request produces exactly one log event:
  `http.route.not-found`, `http.request.completed`, or `http.request.failed`.
  Every event carries `requestId`, `method`, `path`, `statusCode`, and
  `durationMs`; the failure event adds `errorName` and `errorMessage` from
  [`errorFields`](../../errors.ts).

## Procedure Tree

```text
receive registry, logger
  1. Register one catch-all Fastify route.
  2. On each request:
     2.1. Start the duration clock.
     2.2. Normalize the Fastify request into a RequestEnvelope: pathname from the
          URL, params and query defaulted to empty, headers and body carried over.
     2.3. Look the envelope up in the registry.
        || no job is registered
           2.3.a.1. Log `http.route.not-found` at warn with statusCode 404.
           2.3.a.2. Reply 404 with the attempted 'METHOD /path' and every
                    registered route, so the surface is discoverable.
           2.3.a.3. return
     2.4. Await the job with the envelope.
        || the job throws
           2.4.a.1. Log `http.request.failed` at error with statusCode 500.
           2.4.a.2. Rethrow to Fastify, which owns the fault response.
     2.5. Apply the job's headers when it set any.
     2.6. Log `http.request.completed` at info with the job's status code.
     2.7. Reply with the job's status code and body.
```

The status code recorded for a fault is 500 because that is what Fastify sends
for an unhandled throw; the transport never selects a success code itself.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `buildEnvelope` | Converts captured Fastify request data into a `RequestEnvelope`: derives the pathname, defaults `params` and `query` to empty objects, and carries `headers` and `body` through. | [register-transport.ts](register-transport.ts) |

`buildEnvelope` sits in the entry file rather than a file of its own because it
is the one step that step 2.2 consists of; splitting it would name the same
procedure twice.
