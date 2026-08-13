# Observability Overview

## Description

Observability provides the backend's structured logging runtime.

Each `buildRuntime()` call constructs exactly one `ObservabilityRuntime`. It
owns one root Pino logger, exposes its application-owned `Logger` port, and is
closed with the backend runtime. Other runtime objects receive that port through
dependency injection; they do not construct loggers themselves.

This is a runtime-scoped singleton, not a module-level or process-global
singleton. Separate in-process runtimes, including tests, remain isolated.

## Status

Pino structured logging is implemented. It writes JSON records to stdout, where
the deployment environment owns collection, storage, and retention.

OpenTelemetry tracing and metrics remain a future extension. They will be added
to this singleton only after its exporters and instrumentation scope are chosen.

## File Tree

- `observability/`
  - [`logger.ts`](../../../src/capabilities/platform/observability/logger.ts) — application logging port and Pino adapter
  - [`runtime.ts`](../../../src/capabilities/platform/observability/runtime.ts) — singleton lifecycle interface
  - `runtime-constructors/`
    - [`observability.ts`](../../../src/capabilities/platform/observability/runtime-constructors/observability.ts) — constructs the singleton
- [`main.ts`](../../../src/main.ts) — creates and shares it
- [`configuration/logging.yaml`](../../../configuration/logging.yaml) — logging configuration

## Dependency Ports

This capability has no direct capability dependencies.

## External Libraries

| Library | Status | Usage |
| ------- | ------ | ----- |
| `pino` | implemented | Creates the root structured logger, applies level filtering, adds standard bindings, and serializes JSON log records. |
| OpenTelemetry API and SDK packages | deferred | Will provide trace context, tracing, and metrics when their exporter and instrumentation requirements are defined. |

## Runtime Objects

| Object | Description | File |
| ------ | ----------- | ---- |
| `ObservabilityRuntime` | The single owner of the root Pino logger for one backend runtime. | [runtime.ts](../../../src/capabilities/platform/observability/runtime.ts) |
| `Logger` | Application-owned logging port injected into startup, transport, and future capabilities. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |
| `PinoLogger` | Adapter that maps the application logging port to the root Pino logger. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |

## Public API

| API | Kind | Owner / Transport | Description | File |
| --- | ---- | ----------------- | ----------- | ---- |
| `logger` | runtime field | `ObservabilityRuntime` | The shared application logging port. | [runtime.ts](../../../src/capabilities/platform/observability/runtime.ts) |
| `debug(message, data?)` | runtime method | `Logger` | Records a debug-level structured event. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |
| `info(message, data?)` | runtime method | `Logger` | Records an informational structured event. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |
| `warn(message, data?)` | runtime method | `Logger` | Records a warning structured event. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |
| `error(message, data?)` | runtime method | `Logger` | Records an error structured event. | [logger.ts](../../../src/capabilities/platform/observability/logger.ts) |
| `close()` | runtime method | `ObservabilityRuntime` | Flushes the root logger during runtime shutdown. | [runtime.ts](../../../src/capabilities/platform/observability/runtime.ts) |

## Runtime Object Details

### Runtime Object: `ObservabilityRuntime`

`ObservabilityRuntime` is constructed once by `main.ts`, immediately after
configuration loads. It owns the root Pino logger and exposes the stable
`Logger` port for the rest of the runtime.

It does not own HTTP route registration, application event naming, deployment
log collection, retention, metrics, tracing, or remote exporters.

#### Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `logger` | `Logger` | Shared port backed by the root Pino logger. |

#### Constructor Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `configuration` | `ObservabilityConfiguration` | Supplies `logging.enabled` and, when enabled, `logging.level`. |

#### Construction Steps

```text
createObservabilityRuntime(configuration)
  1. Validate `logging.enabled`.
  || logging is enabled
     1.a.1. Validate `logging.level`.
  2. Create one root Pino logger with the backend service binding.
  3. Wrap it in `PinoLogger`.
  4. Return one `ObservabilityRuntime`.
```

## API Details

### API: `Logger.debug`, `Logger.info`, `Logger.warn`, and `Logger.error`

These methods record operational events through the root Pino logger. Startup
and HTTP transport receive the same injected `Logger`; they never instantiate
Pino themselves.

#### API Classification

- **Kind:** runtime method
- **Owner:** `Logger`
- **Execution:** mutator
- **Transaction:** none

#### Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `message` | `string` | Stable event name. |
| `data` | `unknown \| undefined` | Optional event-specific value, recorded under Pino's `data` field. |

#### Output

`void`

The caller receives no log-write result.

#### Effects

- Pino filters events below its configured level.
- Retained events are serialized as JSON and written to stdout.
- Pino supplies the timestamp, severity, message, and backend service binding;
  the adapter supplies the optional `data` field.

#### Procedure Tree

```text
receive level, message, data
  1. Use the injected application logger.
  2. Delegate the event to the one root Pino logger.
  || event is below the configured level or logging is disabled
     2.a.1. Pino discards the event.
  3. Pino serializes the retained event to stdout.
  4. Return.
```

#### Supporting Functions

| Function | Purpose | File |
| -------- | ------- | ---- |
| `createObservabilityRuntime(configuration)` | Creates the root Pino logger and returns the singleton. | [observability.ts](../../../src/capabilities/platform/observability/runtime-constructors/observability.ts) |
| `buildRuntime()` | Constructs the singleton once and injects its logger into the HTTP transport. | [main.ts](../../../src/main.ts) |

### API: `ObservabilityRuntime.close`

Runtime shutdown calls this method after the server and database have closed,
allowing Pino to flush buffered output.

#### API Classification

- **Kind:** runtime method
- **Owner:** `ObservabilityRuntime`
- **Execution:** mutator
- **Transaction:** none

#### Inputs

None.

#### Output

`Promise<void>`

The promise resolves after Pino has flushed the root logger.

#### Effects

- Flushes buffered output from the root Pino logger.

#### Procedure Tree

```text
runtime.close()
  1. Close the HTTP server.
  2. Close the database.
  3. Await observability.close().
  4. Flush the root Pino logger.
  5. Return.
```

## Capability Invariants

- One `buildRuntime` call creates exactly one `ObservabilityRuntime`.
- The singleton is passed explicitly; no module-level mutable logger is used.
- All application log calls use the injected `Logger` port, not Pino directly.
- Pino is the sole root logging implementation and decides filtering and JSON
  serialization.
- Shutdown closes observability after the server and database.

## Types

### Type: `LogLevel`

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";
```

### Type: `ObservabilityRuntime`

```ts
export interface ObservabilityRuntime {
  readonly logger: Logger;
  close(): Promise<void>;
}
```

### Type: `ObservabilityConfiguration`

```ts
export interface ObservabilityConfiguration {
  get(key: string): unknown;
}
```
