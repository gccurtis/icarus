import { PGlite } from "@electric-sql/pglite";
import { Kysely, PGliteDialect } from "kysely";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BackendDatabase } from "#persistence/types/database.js";
import type { DatabaseRuntime } from "#persistence/runtime-objects/database/definition.js";
import { PGliteDatabaseRuntime } from "#persistence/runtime-objects/database/definition.js";

const packageDirectory: string = dirname(
  fileURLToPath(import.meta.resolve("#package.json"))
);

const pgliteDirectory: string = join(packageDirectory, "data", "pglite");

/** Opens the backend's embedded PostgreSQL database. */
export const createDatabase = async (): Promise<DatabaseRuntime> => {
  const pglite = await PGlite.create(pgliteDirectory);
  const database = new Kysely<BackendDatabase>({
    dialect: new PGliteDialect({ pglite })
  });

  return new PGliteDatabaseRuntime(database, pglite);
};
