import type { Logger } from "#platform/observability/logger.js";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createGeneralFileService, SQLiteGeneralFileStore, type GeneralFileService } from "#general-files";

const GENERAL_FILES_DB_PATH = "./data/general-files.db";

export const createGeneralFilesInstance = (
  config: BackendConfig,
  knowledge: Knowledge,
  logger: Logger,
): GeneralFileService => {
  const store = new SQLiteGeneralFileStore(config.projectId, GENERAL_FILES_DB_PATH);
  return createGeneralFileService(store, knowledge, logger);
};