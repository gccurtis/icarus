import type { FastifyInstance } from "fastify";
import type {
  IncomingRequest,
  RequestEnvelope
} from "#capabilities/platform/web-server/context.js";
import type { RouteRegistry } from "#registry/registry.js";
import type { Logger } from "#capabilities/platform/observability/logger.js";
import { errorFields } from "#capabilities/platform/web-server/errors.js";

export interface RegisterHttpTransportDeps {
  registry: RouteRegistry;
  logger: Logger;
}

// Convert Fastify-shaped request data into the framework-neutral request passed
// to route work, so nothing downstream depends on Fastify types.
const buildEnvelope = (request: IncomingRequest): RequestEnvelope => ({
  requestId: request.id,
  method: request.method,
  path: new URL(request.url, "http://backend.local").pathname,
  params: (request.params as Record<string, unknown> | undefined) ?? {},
  query: (request.query as Record<string, unknown> | undefined) ?? {},
  headers: request.headers,
  body: request.body
});

export const registerHttpTransport = (
  app: FastifyInstance,
  deps: RegisterHttpTransportDeps
): void => {
  // Fastify registration happens once during startup. Every HTTP endpoint enters
  // this same handler, which looks up the route and calls its work directly.
  app.all("/*", async (request, reply) => {
    const startedAt = performance.now();
    const envelope = buildEnvelope({
      id: request.id,
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
      headers: request.headers as Record<string, unknown>,
      body: request.body
    });

    const work = deps.registry.find(envelope);
    if (!work) {
      deps.logger.warn("http.route.not-found", {
        requestId: envelope.requestId,
        method: envelope.method,
        path: envelope.path,
        statusCode: 404,
        durationMs: Math.round(performance.now() - startedAt)
      });
      reply.code(404);
      return {
        error: `No route registered for '${envelope.method} ${envelope.path}'`,
        registeredRoutes: deps.registry.list()
      };
    }

    try {
      const { statusCode, headers, body } = await work(envelope);

      if (headers) {
        reply.headers(headers);
      }

      deps.logger.info("http.request.completed", {
        requestId: envelope.requestId,
        method: envelope.method,
        path: envelope.path,
        statusCode,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return reply.code(statusCode).send(body);
    } catch (error) {
      // A work function that throws is a fault, not an outcome. Successful
      // status codes and bodies are always selected by the work itself.
      deps.logger.error("http.request.failed", {
        requestId: envelope.requestId,
        method: envelope.method,
        path: envelope.path,
        statusCode: 500,
        durationMs: Math.round(performance.now() - startedAt),
        ...errorFields(error)
      });
      throw error;
    }
  });
};
