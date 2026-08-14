import type { FastifyInstance } from "fastify";
import type { RequestEndpoint } from "#web-server/types/request.js";
import type { EndpointJob, RouteRegistry } from "#registry";
import { errorFields, type Logger } from "#observability";
import { buildEnvelope } from "#web-server/runtime-api/register-transport/build-envelope.js";
import {
  endpointNotFoundBody,
  errorResponse
} from "#web-server/runtime-api/register-transport/error-response.js";
import { registerRequestLogging } from "#web-server/runtime-api/register-transport/request-logging.js";

/**
 * Finds the job answering an endpoint, falling back from `HEAD` to `GET`.
 *
 * The registry matches method and path exactly, and it should: it is a table of
 * endpoint identities, not a model of HTTP. But a caller issuing `HEAD` against
 * a resource that serves `GET` — a monitor, a proxy, a load balancer — expects
 * an answer, and getting a 404 tells it the resource is gone. So the convention
 * lives here, in the one place that knows this is HTTP. Fastify strips the body
 * from the response, so the job does not need to know it was a `HEAD`.
 */
const findJob = (registry: RouteRegistry, endpoint: RequestEndpoint): EndpointJob | undefined =>
  registry.find(endpoint) ??
  (endpoint.method === "HEAD"
    ? registry.find({ method: "GET", path: endpoint.path })
    : undefined);

export const registerHttpTransport = (
  app: FastifyInstance,
  registry: RouteRegistry,
  logger: Logger
): void => {
  // JSON is the only body this API accepts, so Fastify's text/plain parser is
  // removed and every other media type is refused with 415 before a job runs.
  // Leaving it in place meant a `text/plain` body arrived at a job as a bare
  // string, through a decoder written on the assumption it had JSON.
  app.removeContentTypeParser("text/plain");

  registerRequestLogging(app, logger);

  // Everything Fastify raises arrives here — a job that threw, and equally a
  // body it refused to parse before routing. Both are shaped into one error
  // format, and the thrown value's own message is never part of it.
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = errorResponse(error, request.id);
    request.faultFields = { errorCode: body.error.code, ...errorFields(error) };
    return reply.code(statusCode).send(body);
  });

  // Fastify registration happens once during startup. Every routed request
  // enters this same handler, which looks up the endpoint and calls its job
  // directly. A job that throws is not caught here: it belongs to the error
  // handler above, which is also the only thing that can answer for a fault
  // raised before this handler was reached.
  app.all("/*", async (request, reply) => {
    const envelope = buildEnvelope({
      id: request.id,
      method: request.method,
      url: request.url,
      query: request.query,
      headers: request.headers as Record<string, unknown>,
      body: request.body
    });

    const job = findJob(registry, envelope);
    if (!job) {
      request.faultFields = { errorCode: "endpoint-not-found" };
      return reply.code(404).send(endpointNotFoundBody(envelope.method, envelope.path));
    }

    const { statusCode, headers, body } = await job(envelope);

    if (headers) {
      reply.headers(headers);
    }

    return reply.code(statusCode).send(body);
  });
};
