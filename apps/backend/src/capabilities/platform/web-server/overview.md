# Web Server Overview

## Description

Web Server is the Platform capability that owns the backend's HTTP adapter.

It creates the server, registers one catch-all handler that normalizes each
Fastify request into a framework-neutral `RequestEnvelope`, hands the envelope to
the job the registry holds for that method and path, and translates the job's
answer back into an HTTP response — so that no endpoint anywhere in the backend
touches a Fastify type.

It also owns what happens when there is no answer to give: the media types it
admits, the shape of every error it returns, and the rule that a fault's own
message is logged and never sent.

## Boundary

Web Server owns:

- The server instance, its lifetime, and the address it binds to.
- Translation in both directions: Fastify request to `RequestEnvelope`, job
  response to status code, headers, and body.
- Admission at the transport: `application/json` only, within the configured body
  limit and request timeout.
- The reply to a request no job is registered for, and the `HEAD`-to-`GET`
  convention that decides whether one matches.
- The single error body shape, and the guarantee that no thrown message reaches a
  caller.
- The one request-level log event each response produces:
  `http.request.completed`, `http.route.not-found`, `http.request.rejected`, or
  `http.request.failed`.

Consumers own:

- Which endpoints exist. The registry is built elsewhere and passed in.
- Every successful status code and body. A job chooses its own; the transport
  never invents one.
- Their own expected failures. A capability reporting one returns it as a
  response; only an unexpected throw becomes a transport-shaped 500.
- Configuration values. The address arrives as an argument to `listen` and the
  bounds as an argument to `createWebServer`, both already validated by the
  caller.

## File Tree

```text
web-server/
├── overview.md
├── index.ts
├── errors.ts
├── types/
├── runtime-objects/
├── runtime-api/
└── test/
```

## Dependency Ports

| Capability | Usage |
| ---------- | ----- |
| `Observability` | Records route misses, completed requests, and request faults through the injected `Logger`. |

The route table, `RouteRegistry` from [`#registry`](../../../runtime/registry.md),
is not a capability. It is passed to `registerTransport` and read on every
request; the transport never registers an endpoint itself.

## Runtime Objects

One instance per backend runtime, constructed by
[`build-runtime.ts`](../../../runtime/runtime.md) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `WebServerRuntime` | yes | The HTTP server: transport registration, binding, and shutdown. | [web-server.md](runtime-objects/web-server/web-server.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `registerTransport` | runtime method | `WebServerRuntime` | Installs admission, logging, fault shaping, and the catch-all handler that dispatches through the registry. | [register-transport.md](runtime-api/register-transport/register-transport.md) |
| `listen` | runtime method | `WebServerRuntime` | Binds the server and reports the address it is listening on. | [listen.md](runtime-api/listen/listen.md) |
| `close` | runtime method | `WebServerRuntime` | Stops accepting connections at shutdown. | [close.md](runtime-api/close/close.md) |

`TransportErrorBody` and `WebServerOptions` are the two public types the
capability's admission and fault rules add; `types.md` describes both.

`errorFields` now belongs to [Observability](../observability/overview.md), which
is where reducing a thrown value to log-safe fields belongs. It sat here while
HTTP was the only thing recording faults, which made every other capability's
instrumentation depend on the transport.

## Capability Invariants

- One backend runtime has one web server and registers the transport once.
- Endpoint jobs receive only a `RequestEnvelope`. No Fastify request or reply
  crosses this capability's boundary, and no framework routing artifact rides
  inside the envelope.
- The Fastify instance is private to the runtime object. Nothing outside this
  capability can register a route, add a hook, or reach the framework.
- **No message from a thrown value is ever sent to a caller.** A 5xx carries a
  fixed message and the `requestId`; the detail exists only in the log.
- Every error body the transport produces has the same shape, whether the fault
  came from a job, from the body parser, or from a limit.
- A request no job matches is answered with 404 naming the attempted endpoint,
  and nothing else — the registered surface is not advertised.
- `application/json` is the only media type admitted. Anything else is refused
  with 415 before a job runs.
- Every response produces exactly one log event, including responses to requests
  that never reached the route handler.
- Fastify's built-in logger stays off, so request records come only from the
  injected `Logger`.
- No bound is a framework default inherited by omission: the body limit and
  request timeout arrive from configuration at construction.
