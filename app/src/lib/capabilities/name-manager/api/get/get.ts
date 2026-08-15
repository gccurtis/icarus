import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { canonicalName, nameKey } from "$name-manager/api/shared/canonical-name";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { record } from "$name-manager/api/shared/record";
import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Looks a declaration up by name.
 *
 * **An absent name is an ordinary answer; an unusable one is not.** `undefined`
 * means the catalog has nothing under that name, and a caller branches on it. A
 * name that could never have been defined — the wrong type, or not an identifier
 * — still fails with `invalid-name`, because answering "not found" would tell a
 * caller their name is available when it is not.
 *
 * [`require`](../require/require.md) is the same lookup for callers that cannot
 * continue without one.
 */
export const get = async (scope: Scope, name: string): Promise<NamedVariable | undefined> =>
  record("get", { name }, async () => {
    const canonical = canonicalName(name, "name");
    const database = await projectDatabase(scope.projectId);
    // Already copied — `currentNamedVariable` clones at the storage boundary,
    // so what comes back shares nothing with the driver's row.
    return findVariable(database, nameKey(canonical));
  });
