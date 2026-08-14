# Observability Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `ObservabilityRuntime` | [`observability/`](observability/observability.md) | yes | Owns the root Pino logger, the `Logger` port over it, and the shutdown flush. |

`PinoLogger`, the adapter from the `Logger` port to the root Pino logger, is not
a runtime object. It is a class in the same `definition.ts`, created by the
runtime object and reachable only through its `logger` field, so there is exactly
one adapter over exactly one root logger.

## Construction Order

`createObservabilityRuntime(configuration)` runs second in `build-runtime.ts`, directly
after configuration loads and before anything that could fail in a way worth
recording. Its `logger` is then injected into every capability constructed after
it.
