import {
  canonicalName,
  nameKey
} from "#data-manager/runtime-api/shared/canonical-name.js";
import { copyVariable } from "#data-manager/runtime-api/shared/copy-variable.js";
import type {
  NamedVariable,
  ReadonlyVariableCatalog
} from "#data-manager/types/variables.js";

/**
 * Looks a declaration up by name. An absent name is an ordinary answer;
 * an unusable name is not, and still fails as `invalid-name`.
 */
export const getVariable = (
  catalog: ReadonlyVariableCatalog,
  name: string
): NamedVariable | undefined => {
  const canonical = canonicalName(name, "name");
  const variable = catalog.get(nameKey(canonical));
  return variable && copyVariable(variable);
};
