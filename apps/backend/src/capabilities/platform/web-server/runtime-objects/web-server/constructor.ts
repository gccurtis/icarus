import Fastify from "fastify";
import type { WebServerRuntime } from "#web-server/runtime-objects/web-server/definition.js";
import { FastifyWebServer } from "#web-server/runtime-objects/web-server/definition.js";

/**
 * Creates the backend's web server.
 *
 * Fastify's own logger stays disabled: request events are recorded through the
 * injected application `Logger` when the transport is registered, so every
 * record shares one format and one destination.
 */
export const createWebServer = (): WebServerRuntime =>
  new FastifyWebServer(Fastify({ logger: false }));
