# Initialization procedure

This is the live startup path for each backend process.

Every capability is reached through its own alias, which resolves to its
`index.ts`. Nothing here knows how a capability is arranged inside — that is what
the [directory template](../docs/capability-directory/capability-directory.md) buys.

- [`main.ts`](main.ts)
  - awaits `buildRuntime()`
    - [`createConfiguration()`](capabilities/platform/configuration/runtime-objects/configuration/constructor.ts) — `#configuration`
      - reads and freezes all YAML configuration files, resolved through
        `#config-files/*`
      - see [configuration procedure](../configuration/configuration.md)
    - [`createObservabilityRuntime(configuration)`](capabilities/platform/observability/runtime-objects/observability/constructor.ts) — `#observability`
      - validates `logging.enabled`
      - `false` → creates a disabled root Pino logger
      - `true` → validates `logging.level`, then creates the root Pino logger
      - returns the one `ObservabilityRuntime` for this backend runtime
    - validates `server.host` and `server.port`
    - [`createDatabase()`](capabilities/platform/persistence/runtime-objects/database/constructor.ts) — `#persistence`
    - [`createDataManager()`](capabilities/data/manager/runtime-objects/manager/constructor.ts) — `#data-manager`
    - [`createIdFactory()`](capabilities/platform/id-factory/runtime-objects/id-factory/constructor.ts) — `#id-factory`
      - the one generator of collision-resistant values for this runtime
      - it produces values and nothing else; every capability keeps its own
        identity semantics, deciding *when* an ID is allocated and what it names
    - `createRichContentRuntime(database, ids)` — `#rich-content`
      - receives the shared Kysely/PGlite database and the shared ID factory
      - creates the capability-owned store and `rich_content` table if absent
      - builds its semantic ID factory over the shared one, so content, atom,
        mark, and list prefixes stay owned by Rich Content
      - returns one persisted `RichContentRuntime` for this backend runtime
    - [`createWebServer()`](capabilities/platform/web-server/runtime-objects/web-server/constructor.ts) — `#web-server`
      - creates Fastify with its built-in logger disabled, and keeps the
        framework instance private to the runtime object
    - [`createRegistry()`](registry/registry-constructor.ts)
      - [`registerBuiltInEndpoints()`](capabilities/built-in/endpoints/register.ts) — `#built-in`
        - `GET /health` → [`health/job.ts`](capabilities/built-in/endpoints/health/job.ts)
        - `POST /echo` → [`echo/job.ts`](capabilities/built-in/endpoints/echo/job.ts)
      - registration lives in the capability that owns the endpoint, not in the
        registry
    - [`webServer.registerTransport(registry, logger)`](capabilities/platform/web-server/runtime-api/register-transport/register-transport.ts)
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
