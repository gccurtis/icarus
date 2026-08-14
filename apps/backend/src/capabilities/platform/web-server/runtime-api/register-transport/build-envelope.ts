import type {
  IncomingRequest,
  RequestEnvelope
} from "#web-server/types/request.js";

/**
 * The path an endpoint is matched on: the URL's pathname, with any query string
 * removed.
 *
 * The base is a placeholder that never leaves this function. `request.url` is
 * origin-relative, and `URL` requires an absolute one to parse against.
 */
export const pathOf = (url: string): string =>
  new URL(url, "http://backend.local").pathname;

/**
 * Converts Fastify-shaped request data into the framework-neutral request passed
 * to endpoint jobs, so nothing downstream depends on Fastify types.
 *
 * Fastify's `request.params` is deliberately not carried. The transport
 * registers a single `/*` route, so that object holds one key — `*` — whose
 * value is the matched path. It is a routing artifact of the framework this
 * envelope exists to hide, and a job reading it would be depending on how the
 * transport happens to route rather than on anything about its own endpoint.
 */
export const buildEnvelope = (request: IncomingRequest): RequestEnvelope => ({
  requestId: request.id,
  method: request.method,
  path: pathOf(request.url),
  query: (request.query as Record<string, unknown> | undefined) ?? {},
  headers: request.headers,
  body: request.body
});
