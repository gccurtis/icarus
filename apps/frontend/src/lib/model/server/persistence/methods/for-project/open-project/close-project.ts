import type { PGlite } from "@electric-sql/pglite";
import type { Kysely } from "kysely";
import type { Logger } from "$model/server/observability/index.server";
import type { Database } from "$model/server/persistence/types";

/**
 * Ends one project's database and releases the directory it held.
 *
 * Both steps are needed. `destroy()` ends the dialect's connection; closing the
 * instance releases the WASM heap and its file handles, and without it the
 * directory stays locked against the next open.
 *
 * Kysely's PGlite driver closes the instance itself — but only lazily, once a
 * query has initialized the driver. So `destroy()` is sufficient for a database
 * that was used and a no-op for one that was not, and the explicit close covers
 * the second case. **The guard is load-bearing:** closing an already-closed
 * instance throws, which would turn every clean shutdown into a non-zero exit.
 */
export const closeProject = async (
  logger: Logger,
  projectId: string,
  database: Kysely<Database>,
  pglite: PGlite
): Promise<void> => {
  logger.debug("persistence.project.closing", { projectId });

  await database.destroy();
  if (!pglite.closed) await pglite.close();
};
