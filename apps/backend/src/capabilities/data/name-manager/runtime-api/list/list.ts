import type { NameManagerStore } from "#name-manager/persistence/store.js";
import { copyVariable } from "#name-manager/runtime-api/shared/copy-variable.js";
import type { NamedVariable } from "#name-manager/types/variables.js";

/**
 * Returns every current declaration in definition order, each copied for the
 * caller.
 */
export const listVariables = async (
  store: NameManagerStore
): Promise<readonly NamedVariable[]> =>
  (await store.list()).map(copyVariable);
