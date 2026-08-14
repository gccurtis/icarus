import type { Kysely } from "kysely";
import type { Configuration } from "$runtime/server/configuration/types";
import { createConfiguration } from "$runtime/server/configuration/index.server";
import type { Logger, Observability } from "$runtime/server/observability/index.server";
import { createObservability, errorFields } from "$runtime/server/observability/index.server";
import type { Database, Persistence } from "$runtime/server/persistence/index.server";
import { createPersistence } from "$runtime/server/persistence/index.server";

export type { Scope, Session } from "$runtime/server/scope.server";
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

/**
 * Once shutdown begins the runtime is gone for good.
 *
 * Clearing `building` instead would let a request arriving mid-shutdown build a
 * *second* runtime — a second config read, a second log file, and a second
 * PGlite instance against a directory the first is concurrently closing. That
 * window is not theoretical: the server drains in-flight requests for up to
 * thirty seconds after the signal, and keep-alive connections keep delivering.
 */
let closed = false;

export const serverRuntime = (): Promise<ServerRuntime> => {
  if (closed) {
    throw new Error("The server runtime is shutting down and cannot be rebuilt");
  }

  // A rejected promise is not `undefined`, so caching one would replay the same
  // startup failure for the life of the process and make a fixed config file
  // require a restart. Evicting on failure mirrors the project registry.
  return (building ??= build().catch((error: unknown) => {
    building = undefined;
    throw error;
  }));
};

/**
 * One project's database, for the capability procedure that asked.
 *
 * **The only scoped accessor there is, and the reason it is a call rather than
 * an import.** Configuration and the logger are one per process, so code that
 * needs them imports them; there is no `import { database }` that could be
 * correct, because which database depends on a `scope.projectId` known only when
 * the procedure runs.
 *
 * It lives here rather than in `persistence/` because that module exports a
 * constructor — `createPersistence(configuration, logger)` — and the built
 * instance is held by this file. An accessor inside `persistence/` would have to
 * reach back up to the composition root, which is a cycle.
 *
 * A second scoped object — a per-project cache, a subscription fan-out — would
 * get its own accessor beside this one rather than joining a bundle that then
 * has to grow a field for everyone.
 */
export const projectDatabase = async (projectId: string): Promise<Kysely<Database>> => {
  const { persistence } = await serverRuntime();
  const { database } = await persistence.forProject(projectId);
  return database;
};

/** Closes the runtime if one was built. Idempotent, and one-way. */
export const closeServerRuntime = async (): Promise<void> => {
  if (closed) return;
  closed = true;

  const pending = building;
  if (!pending) return;

  // Awaited before clearing, so nothing can observe an absent runtime and
  // decide to build one.
  const runtime = await pending;
  await runtime.close();
  building = undefined;
};
