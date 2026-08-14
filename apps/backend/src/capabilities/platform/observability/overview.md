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

- The root logger: whether logging is enabled, at what level, with which service
  binding, and where records are written.
- The `Logger` port's shape, and the record envelope — timestamp, severity,
  message, bindings, and the single `data` field application values land in.
- The log file's name, when records go to a file.
- Flushing buffered output at shutdown, and closing a file it opened.

Consumers own:

- Event names and the values they attach. `http.request.completed` and
  `backend.started` are the callers' vocabulary, not this capability's.
- Deciding what is worth recording. Nothing is logged automatically.

Nobody owns retention. A piped destination hands every record to whatever runs the
process; a file destination writes one file per run and never rotates or prunes.
Deleting old files is a deployment decision, which the file name is chosen to make
easy to automate.

## File Tree

```text
observability/
├── overview.md
├── index.ts
├── types/
├── runtime-objects/
├── runtime-api/
└── test/
```

## Dependency Ports

Observability has no capability dependencies. It reads its keys through the
`ObservabilityConfiguration` port — a structural interface its caller satisfies —
rather than importing Configuration, so that nothing in the startup order depends
on which object supplies them.

Its keys live in
[`configuration/observability.yaml`](../../../../configuration/observability.yaml)
— named for the capability rather than for logging, because tracing and metrics
configuration will join `logging` there when an exporter is chosen.

## External Libraries

| Library | Status | Usage |
| ------- | ------ | ----- |
| `pino` | implemented | Creates the root logger, filters by level, adds standard bindings, serializes JSON records, and provides the buffered destination they are written to. |
| OpenTelemetry API and SDK | deferred | Tracing and metrics will be added to this runtime once an exporter and instrumentation scope are chosen. |

## Runtime Objects

One instance per backend runtime, constructed by
[`build-runtime.ts`](../../../runtime/runtime.md) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `ObservabilityRuntime` | yes | Owns the root Pino logger, exposes the `Logger` port, and flushes at shutdown. | [observability.md](runtime-objects/observability/observability.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `close` | runtime method | `ObservabilityRuntime` | Flushes the root logger during shutdown, and closes the log file if this runtime opened one. | [close.md](runtime-api/close/close.md) |

`logger` is a field, not a method. Its four recording methods — `debug`, `info`,
`warn`, `error` — belong to the `Logger` port, described in
[`types/types.md`](types/types.md).

`errorFields`, in [`errors.ts`](errors.ts), is also public: it reduces an unknown
thrown value to log-safe `errorName` and `errorMessage` fields, so every
capability's fault records read the same way.

## Capability Invariants

- One `buildRuntime()` call creates exactly one `ObservabilityRuntime` and one
  root Pino logger.
- The runtime object is passed explicitly. No module-level mutable logger exists.
- Every application log call goes through the injected `Logger` port; no caller
  outside this capability imports Pino.
- Configuration is validated before the logger exists: `logging.enabled` must be
  a boolean, and when it is `true`, `logging.level` must be one of the four levels
  and `logging.destination` must name a kind with the keys that kind uses.
  Construction throws otherwise.
- When logging is disabled the runtime object still exists and every call is a
  no-op, so callers never branch on whether logging is on. A disabled runtime
  opens nothing, so a run that records nothing leaves no empty file behind.
- A runtime closes only what it opened. A file destination is ended at shutdown;
  a piped destination is flushed and never closed, because file descriptors 1
  and 2 belong to the process.
- One run writes one log file. The name is
  `backend-<ISO timestamp>.log`, fixed-width, so sorting the directory orders it
  by time.
- Shutdown flushes observability last, after the server and database have closed,
  so their closing records are not lost.
