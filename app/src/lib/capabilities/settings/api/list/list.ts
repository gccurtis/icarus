import type { QueryCtx } from "$convex/_generated/server";
import type { Setting } from "$settings/types/settings";

/**
 * Every setting in one project, in key order.
 *
 * The order is the index's, not a sort: `by_project_and_key` is ordered, so a
 * range scan over one project's keys comes back sorted and nothing has to put it
 * in order afterwards.
 *
 * Unpaged, deliberately. A project holds tens of settings, and pagination would
 * be a public contract every caller has to satisfy in exchange for nothing. It
 * becomes `.paginate()` the day a project can hold thousands.
 */
export const list = async (ctx: QueryCtx, projectId: string): Promise<Setting[]> => {
  const rows = await ctx.db
    .query("settings")
    .withIndex("by_project_and_key", (q) => q.eq("projectId", projectId))
    .collect();

  return rows.map((row) => ({ key: row.key, value: JSON.parse(row.value) as unknown }));
};
