import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createFormulaEngine } from "#platform/formula/engine.js";
import type { FormulaEngine } from "#platform/formula/engine.js";

export const createFormula = (config: BackendConfig, logger: Logger): FormulaEngine => {
  return createFormulaEngine(config.formula, logger);
};
