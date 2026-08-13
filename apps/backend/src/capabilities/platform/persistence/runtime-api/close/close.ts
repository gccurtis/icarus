import type { PGlite } from "@electric-sql/pglite";
import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence/types/database.js";

/**
 * Releases the Kysely client and then the PGlite instance behind it.
 *
 * Kysely closes PGlite after its first query. The explicit `pglite.closed` check
 * also covers a backend that starts and stops before any capability uses Kysely.
 */
export const closeDatabase = async (
  database: Kysely<BackendDatabase>,
  pglite: PGlite
): Promise<void> => {
  await database.destroy();

  if (!pglite.closed) {
    await pglite.close();
  }
};
