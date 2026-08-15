import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { canonicalKey } from "$settings/api/shared/canonical-key";
import { record } from "$settings/api/shared/record";
import { currentSetting } from "$settings/persistence/stored-types";
import type { Setting } from "$settings/types/settings";

/**
 * Reads one setting, or reports that there is none.
 *
 * **An absent key is an ordinary answer**, so this returns `undefined` rather
 * than raising. An unusable key is not ordinary and still fails as
 * `invalid-key`: asking for something that cannot exist is a different event
 * from asking for something that merely does not, and a caller branching on
 * `undefined` should not have to tell them apart itself.
 */
export const get = async (scope: Scope, key: string): Promise<Setting | undefined> =>
  record("get", { key }, async () => {
    const canonical = canonicalKey(key);
    const database = await projectDatabase(scope.projectId);

    const row = await database
      .selectFrom("settings")
      .selectAll()
      .where("key", "=", canonical)
      .executeTakeFirst();

    return row && currentSetting(row);
  });
