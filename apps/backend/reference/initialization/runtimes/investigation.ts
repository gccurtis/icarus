import type { Logger } from "#capabilities/observability/logger.js";
import type { Knowledge } from "#capabilities/knowledge/knowledge.js";
import type { BackendConfig } from "#initialization/configuration.js";
import {
  createInvestigationRuntime,
  SQLiteInvestigationStore,
  type InvestigationRuntime
} from "#investigation";

const INVESTIGATION_DB_PATH = "./data/investigation.db";

/** Constructs the one project-scoped runtime that owns all Investigation records. */
export const createInvestigationRuntimeInstance = (
  config: BackendConfig,
  knowledge: Knowledge,
  logger: Logger
): InvestigationRuntime => {
  const store = new SQLiteInvestigationStore(config.projectId, INVESTIGATION_DB_PATH);
  return createInvestigationRuntime(store, knowledge, logger, {
    actorId: config.userId
  });
};
