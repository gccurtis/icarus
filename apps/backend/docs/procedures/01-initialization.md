# Initialization procedure

This is the live startup path for each backend process.

- [`main.ts`](../../src/main.ts)
  - awaits `buildRuntime()`
    - [`createConfiguration()`](../../src/capabilities/platform/configuration/configuration.ts)
      - reads and freezes all YAML configuration files
      - see [configuration procedure](02-configuration.md)
    - [`createObservabilityRuntime(configuration)`](../../src/capabilities/platform/observability/runtime-constructors/observability.ts)
      - validates `logging.enabled`
      - `false` → creates a disabled root Pino logger
      - `true` → validates `logging.level`, then creates the root Pino logger
      - returns the one `ObservabilityRuntime` for this backend runtime
    - validates `server.host` and `server.port`
    - [`createDatabase()`](../../src/capabilities/platform/persistence/database.ts)
    - [`createFastifyWebServer()`](../../src/capabilities/platform/web-server/runtime-constructors/fastify.ts)
      - creates Fastify with its built-in logger disabled
    - [`createRegistry()`](../../src/registry/registry-constructor.ts)
      - [`registerBuiltInRoutes()`](../../src/registry/registrations/built-in.ts)
        - `GET /health` → [`healthCapability.ts`](../../src/capabilities/built-in/healthCapability.ts)
        - `POST /echo` → [`echoCapability.ts`](../../src/capabilities/built-in/echoCapability.ts)
    - [`registerHttpTransport()`](../../src/capabilities/platform/web-server/register-http-transport.ts)
      - normalizes Fastify requests, finds a route work function, and invokes it directly
    - awaits `app.listen({ host, port })`
    - logs `backend.started`
    - returns `Runtime { config, database, observability, address, close }`
  - registers graceful-shutdown handlers

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
