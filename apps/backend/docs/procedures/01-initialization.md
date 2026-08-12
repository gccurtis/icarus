# Initialization procedure

This is the complete startup path that runs once for each backend process. Read
from the top down; every linked node executes in the current backend.

- [`main.ts`](../../src/main.ts)
  - awaits [`buildRuntime()`](../../src/initialization/runtime-initialization.ts)
    - [`createConfig()`](../../src/initialization/runtimes/config.ts)
      - [`loadBackendConfig()`](../../src/initialization/configuration/index.ts)
        - finds the configuration directory in [`paths.ts`](../../src/initialization/paths.ts)
        - reads every `configuration/*.yaml` file in sorted order
        - merges their values
        - applies `configuration/local.yaml` last, if it exists
        - parses values and applies defaults
    - [`createLogger(config)`](../../src/initialization/runtimes/logger.ts)
      - logging disabled → [`NoopLogger`](../../src/capabilities/observability/logger.ts)
      - logging enabled
        - ensures the configured log directory exists
        - creates [`FileLogger`](../../src/capabilities/observability/logger.ts)
          - opens the daily file stream on the first log entry
    - [`createDatabase()`](../../src/initialization/runtimes/database.ts)
      - opens PGlite at `data/pglite`
      - creates a Kysely wrapper for that PGlite instance
    - [`createApp()`](../../src/initialization/runtimes/app.ts)
      - creates Fastify with Fastify logging disabled
    - [`createRegistry()`](../../src/initialization/runtimes/registry.ts)
      - [`registerBuiltInRoutes()`](../../src/registry/registerBuiltInRoutes.ts)
        - registers `GET /health` → [`healthCapability.ts`](../../src/capabilities/built-in/healthCapability.ts)
        - registers `POST /echo` → [`echoCapability.ts`](../../src/capabilities/built-in/echoCapability.ts)
    - [`registerHttpTransport(app, { registry, logger })`](../../src/registry/registerHttpTransport.ts)
      - registers Fastify's single `app.all("/*", …)` handler
    - awaits `app.listen({ host: config.server.host, port: config.server.port })`
    - logs `backend.started` with the bound address and registered routes
    - returns `Runtime { config, database, logger, address, close }`
  - prints `backend listening on …`

## Failure branch

- [`buildRuntime()`](../../src/initialization/runtime-initialization.ts) fails before the logger exists
  - configuration startup rejects
  - [`main.ts`](../../src/main.ts) lets Node report the error

- [`buildRuntime()`](../../src/initialization/runtime-initialization.ts) fails after the logger exists
  - logs `backend.start.failed`
  - closes the database, if it was opened
  - closes the logger
  - [`main.ts`](../../src/main.ts) lets Node report the error
