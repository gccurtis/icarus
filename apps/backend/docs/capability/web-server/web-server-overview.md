# Web Server Overview

## Description

The Platform Web Server capability owns the backend's HTTP adapter.

Today the adapter is Fastify. It normalizes a Fastify request, asks the
platform registry for matching route work, invokes that work directly, and
translates its response back to HTTP.

## Status

Fastify is the only implemented web-server adapter. Route work executes
in-process and directly; there is no queue or executor abstraction today.

The registry has no Fastify dependency. A future server adapter can reuse the
same `RequestEnvelope`, `RouteRegistry`, and route work functions.

## File Tree

- `platform/`
  - `web-server/`
    - [`context.ts`](../../../src/capabilities/platform/web-server/context.ts) — normalized request types
    - [`errors.ts`](../../../src/capabilities/platform/web-server/errors.ts) — log-safe error fields
    - [`register-http-transport.ts`](../../../src/capabilities/platform/web-server/register-http-transport.ts) — Fastify request dispatch
    - `runtime-constructors/`
      - [`fastify.ts`](../../../src/capabilities/platform/web-server/runtime-constructors/fastify.ts) — Fastify construction
- `registry/`
  - [`registry.ts`](../../../src/registry/registry.ts) — endpoint-to-work table
  - [`registry-constructor.ts`](../../../src/registry/registry-constructor.ts) — registry construction
  - `registrations/`
    - [`built-in.ts`](../../../src/registry/registrations/built-in.ts) — current route registration

## Dependency Ports

| Capability | Usage |
| ---------- | ----- |
| Observability | Records route misses, completed requests, and request failures through the shared `Logger`. |
| Registry | Resolves the normalized endpoint to direct route work. |

## Runtime Objects

| Object | Description | File |
| ------ | ----------- | ---- |
| Fastify web server | The HTTP listener and framework adapter for one backend runtime. | [fastify.ts](../../../src/capabilities/platform/web-server/runtime-constructors/fastify.ts) |
| `RouteRegistry` | The endpoint-to-route-work table for one backend runtime. | [registry.ts](../../../src/registry/registry.ts) |

## Public API

| API | Kind | Owner / Transport | Description | File |
| --- | ---- | ----------------- | ----------- | ---- |
| `createFastifyWebServer()` | runtime constructor | Platform Web Server | Creates the current Fastify adapter with Fastify logging disabled. | [fastify.ts](../../../src/capabilities/platform/web-server/runtime-constructors/fastify.ts) |
| `registerHttpTransport(app, deps)` | runtime wiring | Platform Web Server | Registers the one Fastify catch-all handler. | [register-http-transport.ts](../../../src/capabilities/platform/web-server/register-http-transport.ts) |
| `RouteRegistry.register(endpoint, work)` | runtime method | `RouteRegistry` | Registers direct work for one method/path pair. | [registry.ts](../../../src/registry/registry.ts) |

## Procedure Tree

```text
Fastify request
  1. Normalize framework data into `RequestEnvelope`.
  2. Find matching route work in `RouteRegistry`.
  || no work matches
     2.a.1. Log `http.route.not-found`.
     2.a.2. Return 404 and the registered routes.
  3. Invoke the matched work function directly.
  || work throws
     3.a.1. Log `http.request.failed`.
     3.a.2. Rethrow to Fastify.
  4. Apply the work's headers, status code, and body to the HTTP response.
  5. Log `http.request.completed`.
```

## Capability Invariants

- The current backend has one Fastify web server and one `RouteRegistry` per
  backend runtime.
- Route work receives only `RequestEnvelope`, never a Fastify request or reply.
- `RouteRegistry` neither imports Fastify nor selects a web-server adapter.
- The HTTP transport directly calls matched route work; no work queue runs.
- Fastify's built-in logger remains disabled so application request events use
  the shared Pino logger.

## Types

### Type: `RequestEnvelope`

```ts
export interface RequestEnvelope {
  requestId?: string;
  method: string;
  path: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}
```

### Type: `RouteWork`

```ts
export type RouteWork = (
  request: RequestEnvelope
) => Promise<RouteResponse>;
```
