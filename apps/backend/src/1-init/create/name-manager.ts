import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createNameManager } from "#name-manager/name-manager.js";
import { SQLiteNameManagerStore } from "#name-manager/sqlite-store.js";
import type { NameManager } from "#name-manager/name-manager.js";

const NAME_MANAGER_DB_PATH = "./data/names.db";

export const createNameManagerInstance = (config: BackendConfig, logger: Logger): NameManager => {
  const store = new SQLiteNameManagerStore(config.projectId, NAME_MANAGER_DB_PATH);
  return createNameManager(store, config.nameManager, logger);
};
