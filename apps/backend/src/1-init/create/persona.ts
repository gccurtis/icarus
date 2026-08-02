import type { ContextManager } from "#context";
import {
  SQLitePersonaStore,
  createPersonaCapability,
  type PersonaCapability
} from "#persona";
import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

const PERSONA_DB_PATH = "./data/personas.db";

/**
 * ContextManager structurally satisfies PersonaContextPort, so it is passed
 * as-is. Persona uses only declare/update/delete, and only to manage the private
 * wrapper record it owns per persona.
 */
export const createPersonaInstance = (
  config: BackendConfig,
  context: ContextManager,
  logger: Logger
): PersonaCapability => {
  const store = new SQLitePersonaStore(config.projectId, PERSONA_DB_PATH);
  return createPersonaCapability(store, { context, logger });
};
