# Observability Types

Lives at `types/types.md`.

`types/` holds the logging port other capabilities depend on and the
configuration surface this capability requires from its caller. The runtime
object's own interface, `ObservabilityRuntime`, is declared with the classes
implementing it in
[`runtime-objects/observability/definition.ts`](../runtime-objects/observability/definition.ts).

## Files

| File | Holds |
| ---- | ----- |
| `logger.ts` | `Logger`, the application logging port, and `LogLevel` |
| `observability-configuration.ts` | `ObservabilityConfiguration`, the two-key configuration surface the constructor reads |

## Public Types

### Type: `Logger`

The port every capability records events through. A consumer holds one because
it was injected — it never constructs one. The four methods differ only in
severity: each takes a stable event name and an optional value recorded under
the `data` field.

```ts
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```

Calls return nothing. A caller learns neither whether the record passed the level
filter nor whether it reached stdout, which is what keeps instrumentation from
becoming control flow.

### Type: `LogLevel`

The four severities a caller can record at.

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";
```

`"silent"` is not one of them. Disabling logging is a configuration state handled
inside the constructor, not a level a caller may pass.

### Type: `ObservabilityConfiguration`

The configuration surface the constructor requires: `logging.enabled` and, when
that is true, `logging.level`. It is declared structurally rather than imported
from Configuration so this capability depends on two keys, not on a capability.

```ts
export interface ObservabilityConfiguration {
  get(key: string): unknown;
}
```
