import { NameManagerError } from "#name-manager/errors.js";
import type { NameManagerStore } from "#name-manager/persistence/store.js";
import {
  canonicalName,
  nameKey
} from "#name-manager/runtime-api/shared/canonical-name.js";
import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type { NamedVariable } from "#name-manager/types/variables.js";

/**
 * The strict retrieval form, for callers that cannot continue without the
 * declaration. Absence is a failure here, which is the whole difference from
 * `get`.
 */
export const requireVariable = async (
  store: NameManagerStore,
  name: string
): Promise<NamedVariable> => {
  const canonical = canonicalName(name, "name");
  const variable = await store.find(nameKey(canonical));
  if (!variable) {
    throw new NameManagerError(
      "variable-not-found",
      `Variable '${canonical}' was not found`
    );
  }
  return copyVariable(variable);
};
