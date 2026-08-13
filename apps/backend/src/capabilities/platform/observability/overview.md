# Observability Overview

## Description

Observability is the Platform capability that owns the backend's structured
logging runtime.

It creates one root Pino logger per backend runtime and exposes it as the
application-owned `Logger` port, so that every capability records events through
an injected interface instead of instantiating a logger of its own.

The runtime is scoped to a `buildRuntime()` call, not to the process. Separate
in-process runtimes, including tests, stay isolated.

## Boundary

Observability owns:

- The root logger: whether logging is enabled, at what level, and with which
  service binding.
- The `Logger` port's shape, and the record envelope — timestamp, severity,
  message, bindings, and the single `data` field application values land in.
- Flushing buffered output at shutdown.

Consumers own:

- Event names and the values they attach. `http.request.completed` and
  `backend.started` are the callers' vocabulary, not this capability's.
- Deciding what is worth recording. Nothing is logged automatically.

Nobody owns collection, storage, or retention: records go to stdout and the
deployment environment takes them from there.

## File Tree

```text
observability/
├── overview.md
├── index.ts
├── types/
├── runtime-objects/
└── runtime-api/
```

## Dependency Ports

Observability has no capability dependencies. It reads `logging.enabled` and
`logging.level` through the `ObservabilityConfiguration` port — a structural
interface its caller satisfies — rather than importing Configuration, so that
nothing in the startup order depends on which object supplies those two keys.

## External Libraries

| Library | Status | Usage |
| ------- | ------ | ----- |
| `pino` | implemented | Creates the root logger, filters by level, adds standard bindings, and serializes JSON records to stdout. |
| OpenTelemetry API and SDK | deferred | Tracing and metrics will be added to this runtime once an exporter and instrumentation scope are chosen. |

## Runtime Objects

One instance per backend runtime, constructed by
[`main.ts`](../../../main.ts) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `ObservabilityRuntime` | yes | Owns the root Pino logger, exposes the `Logger` port, and flushes at shutdown. | [observability.md](runtime-objects/observability/observability.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `close` | runtime method | `ObservabilityRuntime` | Flushes the root logger during shutdown. | [close.md](runtime-api/close/close.md) |

`logger` is a field, not a method. Its four recording methods — `debug`, `info`,
`warn`, `error` — belong to the `Logger` port, described in
[`types/types.md`](types/types.md).

## Capability Invariants

- One `buildRuntime()` call creates exactly one `ObservabilityRuntime` and one
  root Pino logger.
- The runtime object is passed explicitly. No module-level mutable logger exists.
- Every application log call goes through the injected `Logger` port; no caller
  outside this capability imports Pino.
- Configuration is validated before the logger exists: `logging.enabled` must be
  a boolean, and when it is `true`, `logging.level` must be one of the four
  levels. Construction throws otherwise.
- When logging is disabled the runtime object still exists and every call is a
  no-op, so callers never branch on whether logging is on.
- Shutdown flushes observability last, after the server and database have closed,
  so their closing records are not lost.
