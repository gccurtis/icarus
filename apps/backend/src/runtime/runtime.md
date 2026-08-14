# Runtime

This directory is the backend's spine: the composition root that builds one
running backend out of capabilities, the endpoint table they register into, and
the two supporting concerns that composition needs. It is what
[`main.ts`](../main.ts) calls, and what was kept in `src/` when the tree was
reduced to a skeleton.

## Why it is not a capability

The [directory standard](../../docs/capability-directory/capability-directory.md)
governs `src/capabilities/**`. Nothing here is one, and none of it should be made
to look like one: there is no model, no persisted state, no runtime object of its
own, and no endpoint. A capability answers "what can this product do"; this
directory answers "which capabilities does this process run, and in what order".

That asymmetry is the point. Every capability knows how to build itself and which
endpoints it owns. Exactly one place knows the whole set, and it is
[`build-runtime.ts`](build-runtime.ts).

## Files

| File | Responsibility |
| ---- | -------------- |
| [`build-runtime.ts`](build-runtime.ts) | The composition root: constructs every capability, registers every endpoint, starts serving, returns the `Runtime`. |
| [`registry.ts`](registry.md) | The endpoint table capabilities register into. Documented in [`registry.md`](registry.md). |
| [`shutdown.ts`](shutdown.ts) | Releases what a backend holds, in the one safe order — on a clean stop and on a failed startup alike. |
| [`server-options.ts`](server-options.ts) | Narrows the `server.*` keys out of configuration into a `ListenAddress` and the web server's bounds. |
| [`project-options.ts`](project-options.ts) | Requires the opaque `projectId` namespace passed to project-scoped capabilities. |

`main.ts` stays outside, one level up: it is the process, not the runtime. It
awaits `buildRuntime()` and installs signal handlers, and that is all it does —
which is why a second entry point, or a test that builds a runtime without owning
the process, costs nothing.

## Startup

- [`main.ts`](../main.ts)
  - awaits [`buildRuntime()`](build-runtime.ts)
    - [`createConfiguration()`](../capabilities/platform/configuration/runtime-objects/configuration/constructor.ts) — `#configuration`
      - reads and freezes all YAML configuration files, resolved through
        `#config-files/*`
      - see [configuration procedure](../../configuration/configuration.md)
    - [`createObservabilityRuntime(configuration)`](../capabilities/platform/observability/runtime-objects/observability/constructor.ts) — `#observability`
      - validates `logging.enabled`; `false` creates a disabled root Pino logger
        and opens nothing
      - `true` validates `logging.level` and `logging.destination`, then opens
        the destination: a standard stream, or one `backend-<ISO timestamp>.log`
        per run in the configured directory
      - returns the one `ObservabilityRuntime` for this backend runtime
      - both of these are built before the `try`, because every failure below is
        reported through this logger
    - **runtime objects**, in dependency order
      - [`requiredListenAddress(config)`](server-options.ts) — validates `server.host` and `server.port`
      - [`requiredProjectId(config)`](project-options.ts) — validates the project namespace
      - [`createDatabase(logger)`](../capabilities/platform/persistence/runtime-objects/database/constructor.ts) — `#persistence`
      - [`createIdFactory()`](../capabilities/platform/id-factory/runtime-objects/id-factory/constructor.ts) — `#id-factory`
        - the one generator of collision-resistant values for this runtime; every
          capability keeps its own identity semantics, deciding *when* an ID is
          allocated and what it names
      - [`createNameManager(database, projectId, logger)`](../capabilities/data/name-manager/runtime-objects/name-manager/constructor.ts) — `#name-manager`
        - creates the project-scoped `name_manager_variables` table if absent
        - uses the shared database as the authority for every declaration
      - `createRichContentRuntime(database, ids, logger)` — `#rich-content`
        - receives the shared Kysely/PGlite database and the shared ID factory
        - creates the capability-owned store and `rich_content` table if absent
        - builds its semantic ID factory over the shared one, so content, atom,
          mark, and list prefixes stay owned by Rich Content
      - [`createWebServer(requiredWebServerOptions(config))`](../capabilities/platform/web-server/runtime-objects/web-server/constructor.ts) — `#web-server`
        - creates Fastify with its built-in logger disabled, and keeps the
          framework instance private to the runtime object
        - the body limit and request timeout are narrowed from configuration
          here, so no bound is a framework default inherited by omission
    - **endpoint registration**, in one list
      - [`createRegistry()`](registry.md) — an empty table
      - [`registerBuiltInEndpoints(registry)`](../capabilities/built-in/endpoints/register.ts) — `#built-in`
        - `GET /health` → [`health/job.ts`](../capabilities/built-in/endpoints/health/job.ts)
        - `POST /echo` → [`echo/job.ts`](../capabilities/built-in/endpoints/echo/job.ts)
    - **serving**
      - [`webServer.registerTransport(registry)`](../capabilities/platform/web-server/runtime-api/register-transport/register-transport.ts)
        - normalizes Fastify requests into a framework-neutral envelope, finds the
          registered endpoint job, and invokes it directly
      - awaits `webServer.listen(address)`
      - logs `backend.started`
    - returns `Runtime { config, database, observability, nameManager, richContent, address, close }`
  - registers graceful-shutdown handlers

Construction and registration are separate phases, and the separation is
load-bearing: a capability's endpoint jobs close over its runtime object, so it
must exist before its `register…Endpoints` is called. Keeping the two phases
apart makes that ordering visible instead of incidental.

## Shutdown

[`closeRuntime()`](shutdown.ts) stops accepting requests before releasing what
in-flight requests may still be using, and each step runs even if an earlier one
throws:

1. `webServer.close()`
2. `database.close()`
3. `observability.close()`

Logging is released last, so a failure on the way down is still recorded.

## Failure branches

- Configuration cannot be read or translated
  - no logger exists yet
  - startup rejects and Node reports the error

- Observability construction fails
  - no usable logger exists yet
  - startup rejects and Node reports the error

- Address validation or anything later fails
  - logs `backend.start.failed`
  - closes whatever was reached, through [`closeRuntime()`](shutdown.ts)
  - logs `backend.start.cleanup.failed` if that cleanup itself throws
  - rethrows the original error

The failure path uses the same ordered procedure a healthy shutdown uses, with
the members that were never constructed left absent. It previously had a shorter
sequence of its own — database, then observability — which closed neither the web
server nor anything added after it. A second shutdown sequence is a thing that
drifts out of step with the first, so there is now only one.

A failure while cleaning up is recorded and then dropped: the error that stopped
startup is the one worth propagating, and losing it behind a secondary failure
would hide why the process would not start.
