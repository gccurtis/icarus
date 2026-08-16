import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { notFound } from "$revisions/errors";
import type { ResourceKey } from "$revisions/types/change";

/** Where a resource stands: the anchor, and everything accepted above it. */
export type Current = {
  leader: Doc<"resourceSnapshots">;
  sets: Doc<"changeSets">[];
  /** The last accepted set's, or the leader's when consolidation has re-tiered them all. */
  revision: number;
};

/**
 * The leader snapshot and the recent sets past it — one indexed range each, and
 * the only read either `read` or `consolidate` performs.
 *
 * A prefix of equalities and a range on the field after them is one contiguous
 * scan of a B-tree sorted by that tuple, so rows belonging to other resources
 * are never reached rather than scanned and discarded. That is what bounds this
 * at `consolidateAfter + 1` rows however busy the deployment is.
 *
 * **The scoping is the index, not a check after it.** `projectId` leads both, so
 * another project's resource has no leader here and reads as absent.
 */
export const current = async (
  ctx: QueryCtx,
  scope: Scope,
  resource: ResourceKey
): Promise<Current> => {
  const leader = await ctx.db
    .query("resourceSnapshots")
    .withIndex("by_resource_role", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
        .eq("role", "leader")
    )
    .unique();
  if (!leader) throw notFound(resource);

  const sets = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_state", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
        .eq("tier", "recent")
        .gt("revision", leader.revision)
    )
    .order("asc")
    .collect();

  return { leader, sets, revision: sets.at(-1)?.revision ?? leader.revision };
};
