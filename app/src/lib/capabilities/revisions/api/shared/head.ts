import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { ResourceKey } from "$revisions/types/change";

/**
 * Where a resource stands: the last accepted set, or the leader behind it once
 * consolidation has re-tiered those sets.
 *
 * **Two rows at most, and never a body.** A caller that wants the current
 * revision — to accept a change above it, or to ask whether a generation is out
 * of date — must not pay for the deck the leader carries, which is what makes
 * this affordable once per input of every output in a project.
 *
 * **No head means no resource, in this project.** Both indexes lead with
 * `projectId`, so somebody else's resource is indistinguishable from one that
 * was never started — which is the refusal a caller should be making anyway.
 * [`start`](start.ts) writes the leader in the same transaction as the resource
 * row, so nothing that exists here is without one.
 */
export const head = async (
  ctx: QueryCtx,
  scope: Scope,
  resource: ResourceKey
): Promise<number | null> => {
  const last = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_state", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
        .eq("tier", "recent")
    )
    .order("desc")
    .first();
  if (last) return last.revision;

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
  return leader ? leader.revision : null;
};
