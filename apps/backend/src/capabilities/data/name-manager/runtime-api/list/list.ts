import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type {
  NamedVariable,
  ReadonlyVariableCatalog
} from "#name-manager/types/variables.js";

/**
 * Returns every current declaration in definition order, each copied for the
 * caller.
 */
export const listVariables = (
  catalog: ReadonlyVariableCatalog
): readonly NamedVariable[] => [...catalog.values()].map(copyVariable);
