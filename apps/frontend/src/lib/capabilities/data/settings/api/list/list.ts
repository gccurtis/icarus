import { projectDatabase } from "$runtime/server/index.server";
import type { Scope } from "$runtime/server/scope.server";
import { record } from "$settings/api/shared/record";
import { currentSetting } from "$settings/persistence/stored-types";
import type { Setting } from "$settings/types/settings";

/**
 * Every setting in this project, in key order.
 *
 * Key order rather than write order, because the caller is a person reading a
 * list and `editor.font-size` beside `editor.theme` is what they expect.
 * Recency is already on each row for anyone who wants it.
 *
 * Unpaged deliberately. A project's settings are bounded by how many things the
 * application has to configure, not by how much its users do — and a page
 * parameter nobody needs is a second thing every caller has to get right.
 */
export const list = async (scope: Scope): Promise<readonly Setting[]> =>
  record("list", {}, async () => {
    const database = await projectDatabase(scope.projectId);

    const rows = await database
      .selectFrom("settings")
      .selectAll()
      .orderBy("key", "asc")
      .execute();

    return rows.map(currentSetting);
  });
