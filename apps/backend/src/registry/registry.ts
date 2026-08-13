import type {
  RequestEndpoint,
  RequestEnvelope
} from "#capabilities/platform/web-server/context.js";

/** What a route work function returns. It chooses its own status code. */
export interface RouteResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * A route work function receives a framework-neutral request and produces a
 * response. The current web-server transport invokes it directly.
 */
export type RouteWork = (request: RequestEnvelope) => Promise<RouteResponse>;

const keyOf = (endpoint: RequestEndpoint): string => `${endpoint.method} ${endpoint.path}`;

/**
 * The runtime-scoped route table: endpoint identity to route work function.
 *
 * It has no Fastify dependency. The web-server transport owns framework
 * translation and direct work execution.
 */
export class RouteRegistry {
  private readonly works = new Map<string, RouteWork>();

  /** @throws if the endpoint is already registered, which is always a wiring bug. */
  register(endpoint: RequestEndpoint, work: RouteWork): void {
    const key = keyOf(endpoint);
    if (this.works.has(key)) {
      throw new Error(`Route already registered: ${key}`);
    }
    this.works.set(key, work);
  }

  find(endpoint: RequestEndpoint): RouteWork | undefined {
    return this.works.get(keyOf(endpoint));
  }

  /** Every registered route, sorted. Reported in a 404 body so the surface is discoverable. */
  list(): string[] {
    return [...this.works.keys()].sort();
  }
}
