import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { canonicalValue } from "$settings/api/set/canonical-value";
import { canonicalKey } from "$settings/api/shared/canonical-key";
import { record } from "$settings/api/shared/record";
import { currentSetting } from "$settings/persistence/stored-types";
import type { Setting, SettingInput } from "$settings/types/settings";

/**
 * Writes a value at a key, replacing whatever was there.
 *
 * An upsert rather than separate create and update, because a setting has no
 * meaningful "does not exist yet" state a caller would want to handle: whoever
 * is writing `editor.theme` wants it to be that value afterwards, and making
 * them ask first would only add a race between the check and the write.
 *
 * `scope` is derived server-side and is deliberately separate from the input.
 * The browser's payload has no slot for a project or a user, so a client cannot
 * name authority it does not have — which is what lets `updated_by` be written
 * from `scope.userId` and still be true.
 */
export const set = async (scope: Scope, input: SettingInput): Promise<Setting> =>
  // The key is recorded and the value is not. A key is an identifier; a value is
  // whatever someone stored, and a log outlives the row it describes.
  record("set", { key: input?.key }, async () => {
    const key = canonicalKey(input?.key);
    const value = canonicalValue(input?.value);

    const database = await projectDatabase(scope.projectId);

    const row = await database
      .insertInto("settings")
      .values({
        key,
        value: JSON.stringify(value),
        updated_by: scope.userId,
        updated_at: new Date()
      })
      .onConflict((conflict) =>
        conflict.column("key").doUpdateSet({
          value: JSON.stringify(value),
          updated_by: scope.userId,
          updated_at: new Date()
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return currentSetting(row);
  });
