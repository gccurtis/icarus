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
| `log-destination.ts` | `LogDestination`, where records go, and `ClosableLogStream`, what shutdown may close |
| `observability-configuration.ts` | `ObservabilityConfiguration`, the configuration surface the constructor reads |

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

### Type: `LogDestination`

Where the root logger writes, as read from `logging.destination`.

```ts
export type LogDestination =
  | { readonly kind: "piped"; readonly stream: "stdout" | "stderr" }
  | { readonly kind: "file"; readonly directory: string };
```

It is a union rather than one nullable `directory` because the two cases differ
in what this backend is responsible for: piped means the process retains nothing
and whatever runs it owns collection, while file means this process creates the
file and closes it at shutdown.

### Type: `ClosableLogStream`

What shutdown needs from a stream this runtime opened — declared structurally,
like `ObservabilityConfiguration` below, so Pino's stream type is not named in
`types/`.

Only a file destination produces one, and that absence is load-bearing: a piped
runtime holds nothing closable, so shutdown *cannot* end file descriptor 1 or 2
even by mistake. The rule is enforced by what the constructor hands over rather
than by a check at close time.

### Type: `ObservabilityConfiguration`

The configuration surface the constructor requires: `logging.enabled`, and when
that is true, `logging.level` and `logging.destination.*`. It is declared
structurally rather than imported from Configuration so this capability depends
on a few keys, not on a capability.

```ts
export interface ObservabilityConfiguration {
  get(key: string): unknown;
}
```
