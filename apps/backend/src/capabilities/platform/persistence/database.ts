import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory: string = dirname(
  fileURLToPath(import.meta.resolve("#package.json"))
);

const pgliteDirectory: string = join(packageDirectory, "data", "pglite");

/**
 * The tables owned by backend capabilities.
 *
 * Capabilities add their table definitions here as they become live. Keeping the
 * database type at the runtime boundary ensures all of them use the same client.
 */
export interface BackendDatabase {}

export interface DatabaseRuntime {
  readonly database: Kysely<BackendDatabase>;
  readonly pglite: PGlite;
  close(): Promise<void>;
}

/**
 * Opens the backend's embedded PostgreSQL database.
 *
 * Kysely closes PGlite after its first query. The explicit `pglite.close` check
 * also covers a backend that starts and stops before any capability uses Kysely.
 */
export const createDatabase = async (): Promise<DatabaseRuntime> => {
  const pglite = await PGlite.create(pgliteDirectory);
  const database = new Kysely<BackendDatabase>({
    dialect: new PGliteDialect({ pglite })
  });

  return {
    database,
    pglite,
    close: async (): Promise<void> => {
      await database.destroy();

      if (!pglite.closed) {
        await pglite.close();
      }
    }
  };
};
