# Web Server Overview

## Description

Web Server is the Platform capability that owns the backend's HTTP adapter.

It creates the server, registers one catch-all handler that normalizes each
Fastify request into a framework-neutral `RequestEnvelope`, hands the envelope to
the job the registry holds for that method and path, and translates the job's
answer back into an HTTP response — so that no endpoint anywhere in the backend
touches a Fastify type.

## Boundary

Web Server owns:

- The server instance, its lifetime, and the address it binds to.
- Translation in both directions: Fastify request to `RequestEnvelope`, job
  response to status code, headers, and body.
- The reply to a request no job is registered for.
- The three request-level log events: `http.route.not-found`,
  `http.request.completed`, `http.request.failed`.

Consumers own:

- Which endpoints exist. The registry is built elsewhere and passed in.
- Every successful status code and body. A job chooses its own; the transport
  never invents one.
- Configuration values. The host and port arrive as an argument to `listen`,
  already validated by the caller.

## File Tree

```text
web-server/
├── overview.md
├── index.ts
├── errors.ts
├── types/
├── runtime-objects/
└── runtime-api/
```

## Dependency Ports

| Capability | Usage |
| ---------- | ----- |
| `Observability` | Records route misses, completed requests, and request faults through the injected `Logger`. |

The route table, `RouteRegistry` from [`#registry`](../../../registry/registry.ts),
is not a capability. It is passed to `registerTransport` and read on every
request; the transport never registers an endpoint itself.

## Runtime Objects

One instance per backend runtime, constructed by
[`main.ts`](../../../main.ts) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `WebServerRuntime` | yes | The HTTP server: transport registration, binding, and shutdown. | [web-server.md](runtime-objects/web-server/web-server.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `registerTransport` | runtime method | `WebServerRuntime` | Installs the one catch-all handler that dispatches every request through the registry. | [register-transport.md](runtime-api/register-transport/register-transport.md) |
| `listen` | runtime method | `WebServerRuntime` | Binds the server and reports the address it is listening on. | [listen.md](runtime-api/listen/listen.md) |
| `close` | runtime method | `WebServerRuntime` | Stops accepting connections at shutdown. | [close.md](runtime-api/close/close.md) |

`errorFields`, in [`errors.ts`](errors.ts), is also public: it reduces an unknown
thrown value to log-safe `errorName` and `errorMessage` fields. The transport
uses it for request faults and `main.ts` for startup faults, so both read the
same way in the log.

## Capability Invariants

- One backend runtime has one web server and registers the transport once.
- Endpoint jobs receive only a `RequestEnvelope`. No Fastify request or reply
  crosses this capability's boundary.
- The Fastify instance is private to the runtime object. Nothing outside this
  capability can register a route, add a hook, or reach the framework.
- A job that throws is a fault, not an outcome: the transport records
  `http.request.failed` and rethrows to Fastify rather than composing a 500 body
  of its own.
- A request no job matches is answered with 404 and the list of registered
  routes, so the served surface is discoverable.
- Every request produces exactly one of the three log events.
- Fastify's built-in logger stays off, so request records come only from the
  injected `Logger`.
