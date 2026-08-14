import type { Kysely } from "kysely";
import type { Logger } from "#observability";
import type { BackendDatabase } from "#persistence";
import { PGliteNameManagerStore } from "#name-manager/persistence/store.js";
import {
  PersistedNameManager,
  type NameManager
} from "#name-manager/runtime-objects/name-manager/definition.js";

/**
 * Creates one project-bound Name Manager over the shared backend database.
 *
 * Initialization is awaited so every method can assume its table and ordering
 * index exist. The database remains owned by the Persistence runtime.
 */
export const createNameManager = async (
  database: Kysely<BackendDatabase>,
  projectId: string,
  logger: Logger
): Promise<NameManager> => {
  const store = new PGliteNameManagerStore(database, projectId);
  await store.initialize();
  return new PersistedNameManager(store, logger);
};
