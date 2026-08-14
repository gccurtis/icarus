import type { Logger } from "#observability";
import {
  InMemoryNameManager,
  type NameManager
} from "#name-manager/runtime-objects/name-manager/definition.js";

/**
 * Creates the runtime's variable catalog.
 *
 * The logger is the one dependency it takes. It is required rather than
 * optional: a catalog constructed without one would be silently uninstrumented,
 * and the omission would only be noticed when someone went looking for records
 * that were never written.
 */
export const createNameManager = (logger: Logger): NameManager =>
  new InMemoryNameManager(logger);
