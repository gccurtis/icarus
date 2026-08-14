# Runtime Object: `WebServerRuntime`

Lives at `runtime-objects/web-server/web-server.md`.

## Responsibility

`WebServerRuntime` owns the backend's HTTP server for one runtime lifetime. It
holds the Fastify instance privately, installs the request handling that
dispatches through the registry, binds to an address, and stops accepting
connections at shutdown.

It deliberately does not own which endpoints exist, what any of them returns,
configuration lookup, or the meaning of a request body.

## Interface

Declared in [`definition.ts`](definition.ts). Each method is a delegation to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry; this file holds no
request handling.

```ts
export interface WebServerRuntime {
  registerTransport(registry: RouteRegistry, logger: Logger): void;
  listen(address: ListenAddress): Promise<string>;
  close(): Promise<void>;
}
```

`FastifyWebServer` is the implementing class.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `app` | `FastifyInstance` | The framework instance, private to the class. It is the reason this object exists: holding it here is what keeps Fastify out of every other file in the backend. |

The registry and the logger are not fields. They are supplied to
`registerTransport` and captured by the handler closure, so a runtime that never
registers a transport holds no reference to either.

## Constructor

`createWebServer(options)` in [`constructor.ts`](constructor.ts). It takes a
[`WebServerOptions`](../../types/types.md) — the body limit and request timeout —
and creates the instance with Fastify's own logger disabled, because request
logging belongs to the injected `Logger`.

### Construction Steps

```text
1. Create the Fastify instance with `logger: false` and the given bounds.
2. Return the FastifyWebServer holding it.
```

Nothing is registered and no socket is opened here. Both are explicit method
calls, so the caller controls the order.

The line this constructor keeps is **instance bounds at construction, request
behavior at registration.** A body limit and a request timeout belong here
because Fastify enforces them before a request reaches any handler — no endpoint
job runs, so no rule `registerTransport` installs could apply. Everything that
does depend on a request arriving — admission, dispatch, logging, fault shaping —
is registered later and is not decided in this file.

Taking them as parameters rather than reading configuration keeps this capability
free of configuration lookup, and makes the values chosen: they were Fastify's
defaults, inherited by omission, until the composition root started passing
them.

## Invariants

- One instance per backend runtime.
- The Fastify instance never leaves the object.
- `registerTransport` is called once. Fastify rejects a second `/*` registration,
  so a duplicate wiring bug fails at startup rather than silently shadowing the
  first handler.
- The object is usable before `listen` and after `close`; it simply is not
  serving. Method calls do not change which registry it dispatches to.
