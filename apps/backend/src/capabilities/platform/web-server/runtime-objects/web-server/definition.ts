import type { FastifyInstance } from "fastify";
import type { Logger } from "#observability";
import type { RouteRegistry } from "#registry/registry.js";
import type { ListenAddress } from "#web-server/types/listen-address.js";
import { registerHttpTransport } from "#web-server/runtime-api/register-transport/register-transport.js";
import { listenForRequests } from "#web-server/runtime-api/listen/listen.js";
import { closeWebServer } from "#web-server/runtime-api/close/close.js";

/**
 * The one HTTP server for one backend runtime. It is created by main, given the
 * endpoint registry to serve, bound to an address, and closed at shutdown.
 */
export interface WebServerRuntime {
  registerTransport(registry: RouteRegistry, logger: Logger): void;
  listen(address: ListenAddress): Promise<string>;
  close(): Promise<void>;
}

/**
 * The Fastify implementation. The framework instance is private: consumers hold
 * this object, so replacing Fastify changes this file and nothing above it.
 */
export class FastifyWebServer implements WebServerRuntime {
  constructor(private readonly app: FastifyInstance) {}

  registerTransport(registry: RouteRegistry, logger: Logger): void {
    registerHttpTransport(this.app, registry, logger);
  }

  listen(address: ListenAddress): Promise<string> {
    return listenForRequests(this.app, address);
  }

  close(): Promise<void> {
    return closeWebServer(this.app);
  }
}
