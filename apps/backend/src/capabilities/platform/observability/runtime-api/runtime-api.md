# Observability Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on `ObservabilityRuntime`, named after the method
in kebab-case, containing an entry file of the same name that owns that method's
complete orchestration.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `close` | [`close/`](close/close.md) | mutator | Flushes the root Pino logger at shutdown. |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method.

`logger` is a field, so it takes no directory. Its `debug`, `info`, `warn`, and
`error` methods belong to the `Logger` port: they are a one-line delegation to
Pino at a chosen severity, they carry no orchestration, and giving each a
directory would document Pino rather than this capability. The port is described
in [`types/types.md`](../types/types.md) and its adapter in
[`observability.md`](../runtime-objects/observability/observability.md).

## Shared Procedures

No procedure has been promoted to `shared/`. There is one method.
