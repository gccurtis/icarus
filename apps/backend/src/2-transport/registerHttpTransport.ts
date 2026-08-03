import type { FastifyInstance } from "fastify";
import type { JobRegistry } from "#utils/jobs/registry.js";
import { JobScheduler, QueueCapacityError } from "#utils/jobs/scheduler.js";
import type {
  IncomingRequest,
  RequestEnvelope
} from "#utils/types/request.js";
import type { Logger } from "#platform/observability/logger.js";

/**
 * The size that used to be the silent ceiling — Fastify's 1 MiB default, which
 * this backend now overrides with an effectively unbounded configured limit.
 *
 * Defined here rather than imported from `1-init`: composition depends on
 * transport, not the other way round.
 */
const NOTABLE_BODY_BYTES = 1_048_576;

export interface RegisterHttpTransportDeps {
  scheduler: JobScheduler;
  registry: JobRegistry;
  logger: Logger;
}

const errorFields = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "UnknownError", errorMessage: String(error) };

// Convert Fastify-shaped request data into the framework-neutral request used
// as input to the endpoint registry and its job factories.
/**
 * How big a body actually was, when it is big enough to be worth saying.
 *
 * The body limit is configured effectively unbounded so that a rejected
 * request can always be logged whole. That makes an enormous request something
 * we accept rather than refuse — so it has to be something we can *see*, or
 * the decision to allow it is invisible until a log file fills a disk.
 */
const notableBodyBytes = (body: unknown): number | undefined => {
  if (body === undefined || body === null) return undefined;
  try {
    const bytes = Buffer.byteLength(JSON.stringify(body) ?? "", "utf8");
    return bytes >= NOTABLE_BODY_BYTES ? bytes : undefined;
  } catch {
    // A body that will not serialize is not something to fail a request over.
    return undefined;
  }
};

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
  // Fastify registration happens once during startup. Every HTTP endpoint then
  // enters this same handler; endpoint-specific behavior lives in job wiring.
  app.all(
    "/*",
    async (request, reply) => {
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

      const oversized = notableBodyBytes(envelope.body);
      if (oversized !== undefined) {
        deps.logger.warn("http.request.body-large", {
          requestId: envelope.requestId,
          method: envelope.method,
          path: envelope.path,
          bytes: oversized,
          notableAtBytes: NOTABLE_BODY_BYTES
        });
      }

      // Registry lookup maps the received method/path to a fresh concrete job.
      if (!deps.registry.has(envelope)) {
        deps.logger.warn("http.route.not-found", {
          requestId: envelope.requestId,
          method: envelope.method,
          path: envelope.path,
          statusCode: 404,
          durationMs: Math.round(performance.now() - startedAt)
        });
        reply.code(404);
        return {
          error: `No job registered for endpoint '${envelope.method} ${envelope.path}'`,
          registeredEndpoints: deps.registry.listEndpoints()
        };
      }

      const job = deps.registry.createJob(envelope);

      try {
        // enqueue() maps job.queueType to the serial or concurrent queue. This
        // await resolves when the job produces its response—not necessarily
        // when deferred follow-up work finishes.
        const execution = await deps.scheduler.enqueue(job);
        const { statusCode, headers, body } = execution.response;

        if (headers) {
          reply.headers(headers);
        }

        deps.logger.info("http.request.completed", {
          requestId: envelope.requestId,
          jobId: execution.jobId,
          jobName: execution.jobName,
          queueType: execution.queueType,
          method: envelope.method,
          path: envelope.path,
          statusCode,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return reply.code(statusCode).send(body);
      } catch (error) {
        // Infrastructure errors choose their status here. Successful endpoint
        // status codes and bodies are always chosen by the job work function.
        if (error instanceof QueueCapacityError) {
          deps.logger.warn("http.request.rejected", {
            requestId: envelope.requestId,
            method: envelope.method,
            path: envelope.path,
            statusCode: 429,
            queueType: error.queueType,
            durationMs: Math.round(performance.now() - startedAt),
            ...errorFields(error)
          });
          reply.code(429);
          return {
            error: error.message,
            queueType: error.queueType
          };
        }

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
    }
  );
};
