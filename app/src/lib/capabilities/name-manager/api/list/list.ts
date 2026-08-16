import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { asVariable } from "$name-manager/api/shared/as-variable";
import type { NameVariable } from "$name-manager/types/variable";

/**
 * One project's vocabulary, in the order it was defined.
 *
 * The order comes off `by_project_and_order` rather than from a sort, which is
 * the whole reason `definitionOrder` is stored: the index range is already in
 * the order a reader wants, and two variables defined in the same millisecond
 * still have one.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<NameVariable[]> => {
  const rows = await ctx.db
    .query("nameVariables")
    .withIndex("by_project_and_order", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return rows.map(asVariable);
};
