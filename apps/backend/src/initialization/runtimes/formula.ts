import type { Logger } from "#capabilities/observability/logger.js";
import type { BackendConfig } from "#initialization/configuration.js";
import { createFormulaEngine } from "#formula";
import type { FormulaEngine } from "#formula";

export const createFormula = (config: BackendConfig, logger: Logger): FormulaEngine => {
  return createFormulaEngine(config.formula, logger);
};
