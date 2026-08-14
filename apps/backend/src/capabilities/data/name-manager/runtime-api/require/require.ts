import { NameManagerError } from "#name-manager/errors.js";
import {
  canonicalName,
  nameKey
} from "#name-manager/runtime-api/shared/canonical-name.js";
import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type {
  NamedVariable,
  ReadonlyVariableCatalog
} from "#name-manager/types/variables.js";

/**
 * The strict retrieval form, for callers that cannot continue without the
 * declaration. Absence is a failure here, which is the whole difference from
 * `get`.
 */
export const requireVariable = (
  catalog: ReadonlyVariableCatalog,
  name: string
): NamedVariable => {
  const canonical = canonicalName(name, "name");
  const variable = catalog.get(nameKey(canonical));
  if (!variable) {
    throw new NameManagerError(
      "variable-not-found",
      `Variable '${canonical}' was not found`
    );
  }
  return copyVariable(variable);
};
