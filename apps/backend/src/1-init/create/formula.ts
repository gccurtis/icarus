import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createFormulaEngine } from "#formula";
import type { FormulaEngine } from "#formula";

export const createFormula = (config: BackendConfig, logger: Logger): FormulaEngine => {
  return createFormulaEngine(config.formula, logger);
};
