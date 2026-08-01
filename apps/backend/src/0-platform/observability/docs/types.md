# Observability types

## Public types

All core types are in [`logger.ts`](../logger.ts).

### `LogLevel`

```ts
type LogLevel = "debug" | "info" | "warn" | "error";
```

An internal `LOG_LEVEL_RANK` maps those values to `0..3`. It is not exported.

### `LogEntry`

```ts
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}
```

Fields are not declared readonly. `FileLogger` creates a fresh object per accepted call and immediately hands it to its injected writer. The core does not freeze or clone `data`.

### `Logger`

```ts
interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```

Methods are synchronous and return `void`. There is no `child`, `withContext`, `flush`, `close`, `isEnabled`, metric, trace, exception or audit method.

## Implementations

### `NoopLogger`

Implements all four methods as empty functions. It is the production adapter when `logging.enabled=false` and can be used directly by tests/services that need the structural interface without output.

### `FileLogger`

Constructor:

```ts
new FileLogger(
  directory: string,
  level: LogLevel,
  writeEntry: (entry: LogEntry) => void
)
```

It stores a minimum rank and delegates accepted entries to `writeEntry`. Despite its name, `FileLogger` itself does not import filesystem APIs; the initialization factory injects the concrete append closure. The private `directory` and `level` constructor properties are retained but only the derived minimum rank affects logging.

The injected writer is an intentionally narrow seam that makes entry creation/filtering separable from file selection/serialization. It is synchronous and may throw.

## Structurally compatible consumers

[`JobSchedulerLogger`](../../../0-utils/jobs/scheduler.ts) declares only `debug`, `warn`, and `error`; a full `Logger` is structurally assignable. Scheduler also has its own internal no-op implementation for direct construction without a logger.

[`CapturingLogger`](../../../../test/helpers/testDoubles.ts) implements `Logger` by pushing `{ level, message, data? }` into an array. It deliberately omits timestamps because it records calls before any file adapter. Tests use this to assert event shape/correlation.

Other tests frequently construct `NoopLogger`, which proves consumers depend on the interface rather than concrete file output.

## Configuration type

[`BackendConfig.logging`](../../../0-utils/config/loadBackendConfig.ts) is:

```ts
{
  enabled: boolean;
  level: string;
  directory: string;
}
```

The config level is wider than `LogLevel`. `createLogger` casts it, so runtime validation does not enforce the four-value union. Directory is interpreted relative to process working directory unless absolute.

## Serialized record form

The concrete writer in [`create/logger.ts`](../../../1-init/create/logger.ts) applies normal `JSON.stringify` to `LogEntry` and appends `\n`. It does not sort keys, canonicalize nested data, apply a replacer, limit record size, redact, or recover unsupported JSON values.

JSON consequences include:

- `undefined` data property is omitted by entry construction;
- undefined/function/symbol values nested in objects follow ordinary JSON behavior;
- non-finite numbers serialize as `null`;
- circular references and `bigint` throw;
- object property insertion order is preserved by normal JavaScript serialization.

## Errors

Observability defines no error types. Filesystem/JSON errors propagate from Node. A caller can catch them, but `FileLogger` and `createLogger` do not translate them.

Callers commonly log `errorName` and `errorMessage`, but these fields are conventions. [`registerHttpTransport.ts`](../../../2-transport/registerHttpTransport.ts) and [`scheduler.ts`](../../../0-utils/jobs/scheduler.ts) each define a local `errorFields` helper rather than importing an Observability error schema.
