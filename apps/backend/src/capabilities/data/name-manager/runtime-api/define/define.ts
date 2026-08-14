import { NameManagerError } from "#name-manager/errors.js";
import { canonicalVariable } from "#name-manager/runtime-api/define/canonical-variable.js";
import {
  invalidValue,
  isRecord
} from "#name-manager/runtime-api/define/value-guards.js";
import {
  canonicalName,
  nameKey
} from "#name-manager/runtime-api/shared/canonical-name.js";
import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type {
  NamedVariable,
  NamedVariableInput,
  VariableCatalog
} from "#name-manager/types/variables.js";

/**
 * Adds one declaration to the catalog. The name conflict is decided before the
 * type and value are admitted, so a redefinition attempt reports the conflict
 * rather than whichever schema fault its payload happens to carry.
 */
export const defineVariable = (
  catalog: VariableCatalog,
  input: NamedVariableInput
): NamedVariable => {
  if (!isRecord(input)) return invalidValue("variable", "an object declaration");
  const name = canonicalName(input.name, "variable.name");
  const key = nameKey(name);
  if (catalog.has(key)) {
    throw new NameManagerError(
      "name-conflict",
      `Variable name '${name}' is already defined`
    );
  }
  const variable = canonicalVariable(input);
  catalog.set(key, variable);
  return copyVariable(variable);
};
