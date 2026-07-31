import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { Intelligence } from "#platform/intelligence/intelligence.js";
import type { ResourceReader } from "#derived-outputs";
import { createDerivedOutputService } from "#derived-outputs";
import { SQLiteDerivedOutputStore } from "#derived-outputs";
import type { DerivedOutputService } from "#derived-outputs";

const DERIVED_OUTPUTS_DB_PATH = "./data/derived-outputs.db";

export const createDerivedOutputServiceInstance = (
  config: BackendConfig,
  knowledge: Knowledge,
  intelligence: Intelligence,
  resourceReader: ResourceReader,
  logger: Logger
): DerivedOutputService => {
  const store = new SQLiteDerivedOutputStore(
    config.projectId,
    DERIVED_OUTPUTS_DB_PATH
  );
  return createDerivedOutputService(
    store,
    knowledge,
    intelligence,
    resourceReader,
    config.derivedOutputs,
    logger
  );
};