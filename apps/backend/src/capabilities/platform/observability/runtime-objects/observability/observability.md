# Runtime Object: `ObservabilityRuntime`

Lives at `runtime-objects/observability/observability.md`.

## Responsibility

`ObservabilityRuntime` owns the root Pino logger for one backend runtime. It
decides whether logging is enabled and at what level, exposes the stable `Logger`
port consumers are injected with, and flushes buffered output when the runtime
shuts down.

It deliberately does not own event names, the decision to record anything, log
collection, retention, metrics, tracing, or remote exporters.

## Interface

Declared in [`definition.ts`](definition.ts). `close` delegates to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry.

```ts
export interface ObservabilityRuntime {
  readonly logger: Logger;
  close(): Promise<void>;
}
```

`PinoObservabilityRuntime` is the implementing class. `PinoLogger`, in the same
file, is the adapter it exposes as `logger`: each of the four port methods hands
the event to the matching Pino level, putting any caller-supplied value under a
single `data` key so Pino keeps ownership of the record envelope.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `logger` | `Logger` | The shared port, backed by the root logger. Injected into every consumer. |
| `root` | `pino.Logger` | The root Pino logger, private to the class. Only `close` and the adapter touch it. |

## Constructor

`createObservabilityRuntime()` in [`constructor.ts`](constructor.ts).

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `configuration` | `ObservabilityConfiguration` | Supplies `logging.enabled` and, when enabled, `logging.level` |

### Construction Steps

```text
1. Read `logging.enabled`.
   || it is not a boolean
      1.a.1. Throw "Configuration key 'logging.enabled' must be a boolean".
2. || logging is enabled
      2.a.1. Read `logging.level`.
      2.a.2. || it is not debug, info, warn, or error
                2.a.2.a.1. Throw the level error.
   || logging is disabled
      2.b.1. Use Pino's "silent" level.
3. Create one root Pino logger at that level with the `icarus-backend` service binding.
4. Return the runtime object holding it, with a PinoLogger over it as `logger`.
```

Validation happens before the logger exists, so a misconfigured runtime fails
loudly at startup rather than logging silently into nothing.

## Invariants

- One root Pino logger per runtime, created here and never replaced.
- The `logger` field is the only route to it. Nothing outside this capability
  holds the Pino instance.
- The level is fixed at construction. There is no runtime level change.
- A disabled runtime is still a complete runtime object: `logger` works and
  discards, `close` flushes nothing and resolves.
