import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createStructuredData } from "#structured-data/structured-data.js";
import { SQLiteDataStore } from "#structured-data/sqlite-store.js";
import type { StructuredData } from "#structured-data/structured-data.js";

const STRUCTURED_DATA_DB_PATH = "./data/structured-data.db";

export const createStructuredDataInstance = (
  config: BackendConfig,
  logger: Logger
): StructuredData => {
  // Structured Data is project-scoped at runtime. Prefixing by projectId keeps
  // tenant data separated inside the shared DB file.
  const store = new SQLiteDataStore(config.projectId, STRUCTURED_DATA_DB_PATH);
  return createStructuredData(store, config.structuredData, logger);
};
