import type { FastifyInstance } from "fastify";
import type { Logger } from "#observability";
import { pathOf } from "#web-server/runtime-api/register-transport/build-envelope.js";

declare module "fastify" {
  interface FastifyRequest {
    /** When the transport first saw this request, for the response's duration. */
    startedAt: number;
    /** Extra fields the response record carries when something went wrong. */
    faultFields: Record<string, unknown> | null;
  }
}

/**
 * Records one log entry per response.
 *
 * The hooks matter more than they look. Logging used to sit inside the route
 * handler, which meant a request Fastify refused before routing — a malformed
 * JSON body, an unsupported media type, a body over the limit — was answered
 * with no record at all: the endpoint most likely to be misused was the one
 * least visible. `onRequest` and `onResponse` fire for every request, so every
 * response is recorded exactly once, with a duration measured over the whole
 * exchange rather than over the part the handler could see.
 *
 * The level and event name follow the status. `faultFields` is set by whichever
 * step knew what went wrong — the error handler, or the route handler on a
 * registry miss — so the record carries the reason without this hook having to
 * infer it.
 */
export const registerRequestLogging = (app: FastifyInstance, logger: Logger): void => {
  app.decorateRequest("startedAt", 0);
  app.decorateRequest("faultFields", null);

  app.addHook("onRequest", async (request) => {
    request.startedAt = performance.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const { statusCode } = reply;
    const record = {
      requestId: request.id,
      method: request.method,
      path: pathOf(request.url),
      statusCode,
      durationMs: Math.round(performance.now() - request.startedAt),
      ...request.faultFields
    };

    if (statusCode >= 500) {
      logger.error("http.request.failed", record);
      return;
    }

    // A 404 from the registry is a different event from a 404 an endpoint job
    // chose — one says the endpoint does not exist, the other that the thing it
    // addresses does not.
    if (request.faultFields?.["errorCode"] === "endpoint-not-found") {
      logger.warn("http.route.not-found", record);
      return;
    }

    if (statusCode >= 400) {
      logger.warn("http.request.rejected", record);
      return;
    }

    logger.info("http.request.completed", record);
  });
};
