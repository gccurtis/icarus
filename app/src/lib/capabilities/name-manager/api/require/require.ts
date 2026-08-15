import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { NameManagerError } from "$name-manager/errors";
import { canonicalName, nameKey } from "$name-manager/api/shared/canonical-name";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { record } from "$name-manager/api/shared/record";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * The strict retrieval form, for callers that cannot continue without the
 * declaration.
 *
 * **Absence is a failure here, and that is the whole difference from
 * [`get`](../get/get.md).** It exists because the alternative is every such
 * caller writing the same throw, and one of them eventually writing a different
 * message or a different code for the same condition.
 *
 * A resolver walking a formula's references is the caller this is for: it has no
 * useful branch for "that name does not exist" other than to stop, and stopping
 * with `variable-not-found` says more than stopping with a null dereference.
 */
export const require = async (scope: Scope, name: string): Promise<NamedVariable> =>
  record("require", { name }, async () => {
    const canonical = canonicalName(name, "name");
    const database = await projectDatabase(scope.projectId);
    const variable = await findVariable(database, nameKey(canonical));

    if (!variable) {
      throw new NameManagerError("variable-not-found", `Variable '${canonical}' was not found`);
    }

    // Already copied — `currentNamedVariable` clones at the storage boundary.
    return variable;
  });
