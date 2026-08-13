import type {
  RequestEndpoint,
  RequestEnvelope
} from "#web-server";

/** What an endpoint job returns. It chooses its own status code. */
export interface EndpointJobResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * An endpoint job receives a framework-neutral request and produces a response.
 * It is the unit a capability registers against one endpoint identity. The
 * current web-server transport invokes it directly.
 */
export type EndpointJob = (request: RequestEnvelope) => Promise<EndpointJobResponse>;

const keyOf = (endpoint: RequestEndpoint): string => `${endpoint.method} ${endpoint.path}`;

/**
 * The runtime-scoped endpoint table: endpoint identity to endpoint job.
 *
 * It has no Fastify dependency. The web-server transport owns framework
 * translation and direct job execution.
 */
export class RouteRegistry {
  private readonly jobs = new Map<string, EndpointJob>();

  /** @throws if the endpoint is already registered, which is always a wiring bug. */
  register(endpoint: RequestEndpoint, job: EndpointJob): void {
    const key = keyOf(endpoint);
    if (this.jobs.has(key)) {
      throw new Error(`Endpoint job already registered: ${key}`);
    }
    this.jobs.set(key, job);
  }

  find(endpoint: RequestEndpoint): EndpointJob | undefined {
    return this.jobs.get(keyOf(endpoint));
  }

  /** Every registered endpoint, sorted. Reported in a 404 body so the surface is discoverable. */
  list(): string[] {
    return [...this.jobs.keys()].sort();
  }
}
