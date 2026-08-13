# Web Server Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `WebServerRuntime` | [`web-server/`](web-server/web-server.md) | yes | Owns the Fastify instance: transport registration, binding, and shutdown. |

The capability exports one object and no loose functions, so the framework
instance has exactly one holder. `FastifyWebServer` is the implementing class;
`createWebServer()` returns it as `WebServerRuntime`, and callers never see the
Fastify type.

## Construction Order

`createWebServer()` requires nothing, but the order of its methods is fixed:
`registerTransport(registry, logger)` runs once, after the registry and
observability exist, and `listen(address)` runs after that with a host and port
the caller has validated. Binding before registering would serve a window of
requests with no handler installed.
