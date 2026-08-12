import { createConfig } from "#initialization/runtimes/config.js";
import { createApp } from "#initialization/runtimes/app.js";
import { createLogger } from "#initialization/runtimes/logger.js";
import { createRegistry } from "#initialization/runtimes/registry.js";
import { registerHttpTransport } from "#registry/registerHttpTransport.js";
import { errorFields } from "#api/errors.js";
import type { BackendConfig } from "#initialization/configuration/index.js";
import type { Logger } from "#capabilities/observability/logger.js";

/**
 * A backend that is up and serving.
 *
 * Returned rather than left implicit so the caller — and only the caller — owns
 * the process: whether to stop, and with what exit code. Nothing in here reads
 * or writes `process`.
 */
export interface Runtime {
  readonly config: BackendConfig;
  readonly logger: Logger;
  /** Where it is actually listening, as reported by the server itself. */
  readonly address: string;
  /**
   * Stops serving, then flushes the log.
   *
   * Nothing calls this yet — the process is stopped by a signal, and the default
   * signal death was measured to lose nothing. This is the seam a graceful stop
   * goes through once a capability holds state that a kill would corrupt.
   */
  close(): Promise<void>;
}

/**
 * Composes the backend in dependency order and starts it.
 *
 * Only the transport spine is wired: configuration, logging, the route table, and
 * Fastify. No capability is constructed, and there is no job queue.
 *
 * @throws whatever failed, after recording it. The log is flushed first, because
 * a caller's only correct response to a failed start is to exit, and exiting
 * would otherwise discard the entry explaining why.
 */
export const buildRuntime = async (): Promise<Runtime> => {
  // Before this line there is no logger, so a configuration failure can only be
  // reported by throwing.
  const config = await createConfig();
  const logger = createLogger(config);
  const startedAt = performance.now();

  try {
    const app = createApp();
    const registry = createRegistry();

    registerHttpTransport(app, { registry, logger });

    const address = await app.listen({
      host: config.server.host,
      port: config.server.port
    });

    logger.info("backend.started", {
      address,
      routes: registry.list(),
      durationMs: Math.round(performance.now() - startedAt)
    });

    return {
      config,
      logger,
      address,
      close: async (): Promise<void> => {
        // Stop serving before flushing. The logger closes last so anything the
        // shutdown itself emits is still recorded.
        await app.close();
        await logger.close?.();
      }
    };
  } catch (error) {
    logger.error("backend.start.failed", {
      durationMs: Math.round(performance.now() - startedAt),
      ...errorFields(error)
    });
    await logger.close?.();
    throw error;
  }
};
