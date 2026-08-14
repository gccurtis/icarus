import type { FastifyInstance } from "fastify";
import type { Logger } from "#observability";
import type { RouteRegistry } from "#registry";
import type { ListenAddress } from "#web-server/types/listen-address.js";
import { registerHttpTransport } from "#web-server/runtime-api/register-transport/register-transport.js";
import { listenForRequests } from "#web-server/runtime-api/listen/listen.js";
import { closeWebServer } from "#web-server/runtime-api/close/close.js";

/**
 * The one HTTP server for one backend runtime. It is created during startup,
 * given the endpoint registry to serve, bound to an address, and closed at
 * shutdown.
 */
export interface WebServerRuntime {
  registerTransport(registry: RouteRegistry): void;
  listen(address: ListenAddress): Promise<string>;
  close(): Promise<void>;
}

/**
 * The Fastify implementation. The framework instance is private: consumers hold
 * this object, so replacing Fastify changes this file and nothing above it.
 */
export class FastifyWebServer implements WebServerRuntime {
  constructor(
    private readonly app: FastifyInstance,
    private readonly logger: Logger
  ) {}

  registerTransport(registry: RouteRegistry): void {
    this.logger.debug("web-server.register-transport.started", {});
    registerHttpTransport(this.app, registry, this.logger);
    this.logger.debug("web-server.register-transport.completed", {
      endpoints: registry.list().length
    });
  }

  async listen(address: ListenAddress): Promise<string> {
    this.logger.debug("web-server.listen.started", address);
    const bound = await listenForRequests(this.app, address);
    this.logger.debug("web-server.listen.completed", { address: bound });
    return bound;
  }

  async close(): Promise<void> {
    this.logger.debug("web-server.close.started", {});
    await closeWebServer(this.app);
    this.logger.debug("web-server.close.completed", {});
  }
}
