import type { Logger } from "#capabilities/observability/logger.js";
import type { BackendConfig } from "#initialization/configuration.js";
import { createContextManager } from "#context";
import { SQLiteContextStore } from "#context";
import type { ContextManager } from "#context";

const CONTEXT_DB_PATH = "./data/contexts.db";

export const createContextManagerInstance = (config: BackendConfig, logger: Logger): ContextManager => {
  const store = new SQLiteContextStore(config.projectId, CONTEXT_DB_PATH);
  return createContextManager(store, config.context, logger);
};
