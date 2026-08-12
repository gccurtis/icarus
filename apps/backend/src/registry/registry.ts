import type { RequestEndpoint, RequestEnvelope } from "#api/context.js";

/** What a route handler returns. The handler chooses its own status code. */
export interface RouteResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * A route handler receives the framework-neutral request and produces a
 * response. It is called directly by the transport — there is no queue, no
 * ordering, and no deferred execution.
 */
export type RouteHandler = (request: RequestEnvelope) => Promise<RouteResponse>;

const keyOf = (endpoint: RequestEndpoint): string => `${endpoint.method} ${endpoint.path}`;

/**
 * The process-wide route table: method and path to handler.
 *
 * This replaces the hand-written job registry and scheduler, which are preserved
 * in `reference/workflows/`. Ordering and bounded concurrency were real features
 * of that system; nothing served here needs them, so they return with the first
 * capability that does — or are provided by a durable workflow engine instead.
 */
export class RouteRegistry {
  private readonly handlers = new Map<string, RouteHandler>();

  /** @throws if the endpoint is already registered, which is always a wiring bug. */
  register(endpoint: RequestEndpoint, handler: RouteHandler): void {
    const key = keyOf(endpoint);
    if (this.handlers.has(key)) {
      throw new Error(`Route already registered: ${key}`);
    }
    this.handlers.set(key, handler);
  }

  find(endpoint: RequestEndpoint): RouteHandler | undefined {
    return this.handlers.get(keyOf(endpoint));
  }

  /** Every registered route, sorted. Reported in a 404 body so the surface is discoverable. */
  list(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
