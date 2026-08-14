import type { Configuration } from "$runtime/server/configuration/types";
import { createConfiguration } from "$runtime/server/configuration/index.server";
import type { Logger, Observability } from "$runtime/server/observability/index.server";
import { createObservability, errorFields } from "$runtime/server/observability/index.server";
import type { Persistence } from "$runtime/server/persistence/index.server";
import { createPersistence } from "$runtime/server/persistence/index.server";

export type { Scope } from "$runtime/server/scope.server";
export type { Logger } from "$runtime/server/observability/index.server";
export type { Database, ProjectDatabase } from "$runtime/server/persistence/index.server";

/**
 * The server runtime: everything held for the process's lifetime.
 *
 * These are runtime *objects* rather than capabilities because each owns a
 * resource with a lifetime — a parsed snapshot, an open log stream, a set of
 * open databases — and each has a `close()`. Capabilities own rows, hold
 * nothing between requests, and are procedural.
 */
export interface ServerRuntime {
  readonly configuration: Configuration;
  readonly logger: Logger;
  readonly persistence: Persistence;
  close(): Promise<void>;
}

/**
 * Builds the server runtime once, in dependency order.
 *
 * Configuration first and outside the try, because every failure below is
 * reported through the logger it configures — so it has to exist before
 * anything that can fail. A failure in those first two has nothing to log with
 * and rejects to the caller instead.
 */
const build = async (): Promise<ServerRuntime> => {
  const configuration = await createConfiguration();
  const observability = createObservability(configuration);
  const { logger } = observability;

  const startedAt = performance.now();

  try {
    const persistence = createPersistence(configuration, logger);

    logger.info("runtime.started", {
      durationMs: Math.round(performance.now() - startedAt)
    });

    return {
      configuration,
      logger,
      persistence,
      close: () => shutdown(persistence, observability)
    };
  } catch (error) {
    logger.error("runtime.start.failed", {
      durationMs: Math.round(performance.now() - startedAt),
      ...errorFields(error)
    });
    await observability.close().catch(() => {});
    throw error;
  }
};

/**
 * Releases what the runtime holds, databases before logging.
 *
 * Logging closes last so the database's own close records still reach the
 * destination — flushing the logger first would drop exactly the lines that say
 * whether shutdown worked.
 */
const shutdown = async (
  persistence: Persistence,
  observability: Observability
): Promise<void> => {
  try {
    await persistence.close();
  } finally {
    await observability.close();
  }
};

/**
 * The one runtime, built on first use.
 *
 * A module-level promise rather than a value: this module is imported by
 * `hooks.server.ts`, and building at import time would make a configuration
 * error a module-load failure with no logger to report it. Caching the promise
 * also means concurrent first requests share one build rather than racing to
 * open the same log file.
 *
 * Safe as module state *because none of it is per-user*. Everything here is
 * process infrastructure; identity arrives per request as `Scope`.
 */
let building: Promise<ServerRuntime> | undefined;

export const serverRuntime = (): Promise<ServerRuntime> => (building ??= build());

/** Closes the runtime if one was built. Used by the shutdown signal handlers. */
export const closeServerRuntime = async (): Promise<void> => {
  if (!building) return;
  const runtime = await building;
  building = undefined;
  await runtime.close();
};
