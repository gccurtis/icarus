import {
  canonicalName,
  nameKey
} from "#name-manager/runtime-api/shared/canonical-name.js";
import type { NameManagerStore } from "#name-manager/persistence/store.js";
import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type { NamedVariable } from "#name-manager/types/variables.js";

/**
 * Looks a declaration up by name. An absent name is an ordinary answer;
 * an unusable name is not, and still fails as `invalid-name`.
 */
export const getVariable = async (
  store: NameManagerStore,
  name: string
): Promise<NamedVariable | undefined> => {
  const canonical = canonicalName(name, "name");
  const variable = await store.find(nameKey(canonical));
  return variable && copyVariable(variable);
};
