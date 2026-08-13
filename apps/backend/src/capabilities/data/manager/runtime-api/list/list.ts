import { copyVariable } from "#data-manager/runtime-api/shared/copy-variable.js";
import type {
  NamedVariable,
  ReadonlyVariableCatalog
} from "#data-manager/types/variables.js";

/**
 * Returns every current declaration in definition order, each copied for the
 * caller.
 */
export const listVariables = (
  catalog: ReadonlyVariableCatalog
): readonly NamedVariable[] => [...catalog.values()].map(copyVariable);
