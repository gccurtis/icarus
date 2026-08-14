import Fastify from "fastify";
import type { Logger } from "#observability";
import type { WebServerOptions } from "#web-server/types/web-server-options.js";
import type { WebServerRuntime } from "#web-server/runtime-objects/web-server/definition.js";
import { FastifyWebServer } from "#web-server/runtime-objects/web-server/definition.js";

/**
 * Creates the backend's web server.
 *
 * Fastify's own logger stays disabled: request events are recorded through the
 * injected application `Logger`, so every record shares one format and one
 * destination.
 *
 * Everything else Fastify is given here is a bound it enforces before a request
 * reaches a handler. That is the line this constructor keeps: instance limits at
 * construction, request behavior at registration. Nothing about how a request is
 * admitted, answered, or logged is decided in this file.
 */
export const createWebServer = (
  options: WebServerOptions,
  logger: Logger
): WebServerRuntime =>
  new FastifyWebServer(
    Fastify({
      logger: false,
      bodyLimit: options.bodyLimitBytes,
      requestTimeout: options.requestTimeoutMs
    }),
    logger
  );
