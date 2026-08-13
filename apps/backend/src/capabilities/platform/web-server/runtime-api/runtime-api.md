# Web Server Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on `WebServerRuntime`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration. Each entry takes the private Fastify instance as its
first argument, which is how the framework stays inside this capability while the
work stays out of `definition.ts`.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `registerTransport` | [`register-transport/`](register-transport/register-transport.md) | mutator | Installs the catch-all handler that normalizes, dispatches, and records every request. |
| `listen` | [`listen/`](listen/listen.md) | mutator | Binds the server and reports the address it is listening on. |
| `close` | [`close/`](close/close.md) | mutator | Stops accepting connections. |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method.

`registerTransport` holds the capability's behavior. `listen` and `close` are
lifecycle steps with one framework call each; they have directories because the
interface has the methods, not because there is much to say about them.

## Shared Procedures

No procedure has been promoted to `shared/`. Only `registerTransport` has
supporting work, and its envelope builder is used nowhere else.

## Common Shape

```text
1. Receive the private Fastify instance from the runtime object.
2. Perform the one framework operation the method names.
3. Return its result unchanged.
```
