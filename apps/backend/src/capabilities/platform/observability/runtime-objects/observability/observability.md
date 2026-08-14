# Runtime Object: `ObservabilityRuntime`

Lives at `runtime-objects/observability/observability.md`.

## Responsibility

`ObservabilityRuntime` owns the root Pino logger for one backend runtime. It
decides whether logging is enabled, at what level, and where records go, exposes
the stable `Logger` port consumers are injected with, and flushes — and closes
what it opened — when the runtime shuts down.

It deliberately does not own event names, the decision to record anything, log
retention, metrics, tracing, or remote exporters. Collection is its concern only
in the sense of choosing a destination; what happens to records after they are
written is not.

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
| `stream` | `ClosableLogStream \| undefined` | The log file this runtime opened, private to the class. Absent for a piped destination, which is what makes closing a standard stream impossible rather than merely avoided. |

## Constructor

`createObservabilityRuntime(configuration)` in [`constructor.ts`](constructor.ts).

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `configuration` | `ObservabilityConfiguration` | Supplies `logging.enabled` and, when enabled, `logging.level` and `logging.destination.*` |

### Construction Steps

```text
1. Validate the logging keys.
2. || logging is disabled
      2.a.1. Return a silent runtime, having opened nothing.
3. Open the configured destination.
4. Return the runtime over a root logger writing to it, holding the destination
   only when it is one this runtime must later close.
```

Validation happens before the logger exists, so a misconfigured runtime fails
loudly at startup rather than logging silently into nothing. Step 2 returns early
rather than falling through: a disabled runtime that opened a file would leave an
empty file per run as the only trace of logging being off.

## Invariants

- One root Pino logger per runtime, created here and never replaced.
- The `logger` field is the only route to it. Nothing outside this capability
  holds the Pino instance.
- The level and the destination are fixed at construction. Neither changes at
  runtime, and no record is redirected after the first.
- A runtime holds a closable stream only when it opened a file. A piped runtime
  cannot close file descriptor 1 or 2, because it was never given anything to
  close.
- A disabled runtime is still a complete runtime object: `logger` works and
  discards, `close` flushes nothing and resolves, and no file is created.
- One run writes one file. Nothing here rotates, prunes, or reopens.
