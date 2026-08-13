# Initialization procedure

This is the live startup path for each backend process.

Every capability is reached through its own alias, which resolves to its
`index.ts`. Nothing here knows how a capability is arranged inside — that is what
the [directory template](capability-directory/capability-directory.md) buys.

- [`main.ts`](../src/main.ts)
  - awaits `buildRuntime()`
    - [`createConfiguration()`](../src/capabilities/platform/configuration/runtime-objects/configuration/constructor.ts) — `#configuration`
      - reads and freezes all YAML configuration files, resolved through
        `#config-files/*`
      - see [configuration procedure](02-configuration.md)
    - [`createObservabilityRuntime(configuration)`](../src/capabilities/platform/observability/runtime-objects/observability/constructor.ts) — `#observability`
      - validates `logging.enabled`
      - `false` → creates a disabled root Pino logger
      - `true` → validates `logging.level`, then creates the root Pino logger
      - returns the one `ObservabilityRuntime` for this backend runtime
    - validates `server.host` and `server.port`
    - [`createDatabase()`](../src/capabilities/platform/persistence/runtime-objects/database/constructor.ts) — `#persistence`
    - [`createDataManager()`](../src/capabilities/data/manager/runtime-objects/manager/constructor.ts) — `#data-manager`
    - `createRichContentRuntime(database)` — `#rich-content`
      - receives the shared Kysely/PGlite database
      - creates the capability-owned store and `rich_content` table if absent
      - creates the runtime's UUID-backed ID factory
      - returns one persisted `RichContentRuntime` for this backend runtime
    - [`createWebServer()`](../src/capabilities/platform/web-server/runtime-objects/web-server/constructor.ts) — `#web-server`
      - creates Fastify with its built-in logger disabled, and keeps the
        framework instance private to the runtime object
    - [`createRegistry()`](../src/registry/registry-constructor.ts)
      - [`registerBuiltInEndpoints()`](../src/capabilities/built-in/endpoints/register.ts) — `#built-in`
        - `GET /health` → [`health/job.ts`](../src/capabilities/built-in/endpoints/health/job.ts)
        - `POST /echo` → [`echo/job.ts`](../src/capabilities/built-in/endpoints/echo/job.ts)
      - registration lives in the capability that owns the endpoint, not in the
        registry
    - [`webServer.registerTransport(registry, logger)`](../src/capabilities/platform/web-server/runtime-api/register-transport/register-transport.ts)
      - normalizes Fastify requests into a framework-neutral envelope, finds the
        registered endpoint job, and invokes it directly
    - awaits `webServer.listen({ host, port })`
    - logs `backend.started`
    - returns `Runtime { config, database, observability, dataManager, richContent, address, close }`
  - registers graceful-shutdown handlers

## Shutdown order

`close()` stops accepting requests before releasing what in-flight requests may
still be using, and each step runs even if an earlier one throws:

1. `webServer.close()`
2. `database.close()`
3. `observability.close()`

## Failure branches

- Configuration cannot be read or translated
  - no logger exists yet
  - startup rejects and Node reports the error

- Observability construction fails
  - no usable logger exists yet
  - startup rejects and Node reports the error

- Server-key validation or anything later fails
  - logs `backend.start.failed`
  - closes the database if it was opened
  - closes the observability runtime
  - rethrows the error
