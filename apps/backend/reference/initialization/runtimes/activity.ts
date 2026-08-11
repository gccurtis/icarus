import type { BackendConfig } from "#initialization/configuration.js";
import type { Logger } from "#capabilities/observability/logger.js";
import {
  createActivityCapability,
  SQLiteActivityStore,
  type ActivityCapability
} from "#activity";

const ACTIVITY_DB_PATH = "./data/activity.db";

/** Constructs the one project-scoped Activity runtime before resource integration. */
export const createActivityInstance = (
  config: BackendConfig,
  logger: Logger
): ActivityCapability => {
  const store = new SQLiteActivityStore(config.projectId, ACTIVITY_DB_PATH);
  return createActivityCapability(store, { logger });
};
