import { createConfig } from "#initialization/runtimes/config.js";
import { createApp } from "#initialization/runtimes/app.js";
import { createLogger } from "#initialization/runtimes/logger.js";
import { createScheduler } from "#initialization/runtimes/scheduler.js";
import { createRegistry } from "#initialization/runtimes/registry.js";
import { registerHttpTransport } from "#api/registerHttpTransport.js";

/**
 * Composes the backend in dependency order.
 *
 * Only the transport spine is wired right now: configuration, logging, the job
 * scheduler, the endpoint registry, and Fastify. No capability is constructed,
 * so the only endpoints served are the built-in operational ones.
 *
 * The previous composition — 23 runtime initializations and 11 route groups — is
 * preserved verbatim under `reference/`. Capabilities come back one at a time,
 * and each one adds its construction here.
 */
export const startBackend = async (): Promise<void> => {
  const config = await createConfig();
  const logger = createLogger(config);
  const startedAt = performance.now();
  try {
    const app = createApp();
    const scheduler = createScheduler(config, logger);
    const registry = createRegistry(scheduler);

    registerHttpTransport(app, { scheduler, registry, logger });

    await app.listen({
      host: config.server.host,
      port: config.server.port
    });

    logger.info("Backend listening", { port: config.server.port });

    // Flush buffered log writes on shutdown so a killed process does not lose
    // its tail of in-flight log entries.
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      logger.info("Backend shutting down", { signal });
      await app.close();
      await logger.close?.();
      process.exit(0);
    };
    process.once("SIGTERM", (signal) => void shutdown(signal));
    process.once("SIGINT", (signal) => void shutdown(signal));
  } catch (error) {
    logger.error("backend.start.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown startup failure",
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }
};
