import { createConfiguration } from "$model/server/configuration/index.server";
import type { Observability } from "$model/server/observability/index.server";
import { createObservability, errorFields } from "$model/server/observability/index.server";
import type { Persistence } from "$model/server/persistence/index.server";
import { createPersistence } from "$model/server/persistence/index.server";
import type { ServerModel } from "$model/server/types";

/**
 * Composes the server graph once, in dependency order.
 *
 * Configuration first and outside the try, because every failure below is
 * reported through the logger it configures — so it has to exist before
 * anything that can fail. A failure in those first two has nothing to log with
 * and rejects to the caller instead.
 *
 * Directly callable, and called by exactly two things: the accessor in
 * `index.server.ts`, which holds the one instance, and a test that wants a whole
 * graph without one. Application code reaches the graph through the door.
 */
export const buildServerModel = async (): Promise<ServerModel> => {
  const configuration = await createConfiguration();
  const observability = createObservability(configuration);
  const { logger } = observability;

  const startedAt = performance.now();
  let persistence: Persistence;

  try {
    persistence = createPersistence(configuration, logger);

    logger.info("model.started", {
      durationMs: Math.round(performance.now() - startedAt)
    });
  } catch (error) {
    // Anything acquired before this point is released before the error escapes.
    // A half-built graph that nobody holds is a log stream nothing will ever
    // close.
    logger.error("model.start.failed", {
      durationMs: Math.round(performance.now() - startedAt),
      ...errorFields(error)
    });
    await observability.close().catch(() => {});
    throw error;
  }

  return {
    configuration,
    observability,
    persistence,
    close: () => shutdown(persistence, observability)
  };
};

/**
 * Releases what the graph holds, databases before logging.
 *
 * Logging closes last so the database's own close records still reach the
 * destination — flushing the logger first would drop exactly the lines that say
 * whether shutdown worked.
 *
 * `finally` rather than a second await: a database that will not close must not
 * take the log stream with it, and the failure that says so has to survive the
 * flush.
 */
export const shutdown = async (
  persistence: Persistence,
  observability: Observability
): Promise<void> => {
  try {
    await persistence.close();
  } finally {
    await observability.close();
  }
};
