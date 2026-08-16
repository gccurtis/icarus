import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * Where descent enters: every artifact no higher cluster contains.
 *
 * **That is exactly the `clustered: false` set**, top-level corpus nodes and
 * orphan windows alike, because both are roots and neither has a parent. The
 * same `by_project_clustered` index is the clustering pass's work queue, so the
 * two readers cannot disagree about what is outstanding — and it is why an
 * orphan staying unclustered matters: an unclustered window is not a loose end,
 * it is an entry point.
 *
 * **The stored level index cannot narrow this yet**, and the reason is
 * structural rather than unfinished work — see
 * [`shared.md`](../shared.md#narrowing-the-frontier-needs-a-row-nothing-writes).
 */
export const frontier = async (ctx: QueryCtx, scope: Scope): Promise<Doc<"latticeNodes">[]> =>
  await ctx.db
    .query("latticeNodes")
    .withIndex("by_project_clustered", (q) =>
      q.eq("projectId", scope.projectId).eq("clustered", false)
    )
    .collect();
