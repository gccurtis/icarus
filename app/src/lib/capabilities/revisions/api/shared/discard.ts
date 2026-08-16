import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import type { ResourceKey } from "$revisions/types/change";

/**
 * Takes a resource's content with the resource: both anchors, every checkpoint,
 * and the whole change-set log.
 *
 * **Not registered, and called by whoever deletes the resource**, in the same
 * transaction, for the reason [`start`](start.ts) is called by whoever creates
 * it. The scope is the caller's, and it is the same one that resolved the
 * resource row — so a mismatched pair reaches nothing rather than another
 * project's log.
 *
 * **Deleting the resource row alone would not remove it.** A read scopes off the
 * leader snapshot and a submit off the head change set, neither of which knows
 * the resource row exists — so a document deleted this way would stay readable
 * and writable by anyone still holding its id.
 *
 * One transaction, so there is no order to observe. Split across several there
 * would be: the leader and the `recent` sets have to go together, because the
 * head falls back from one to the other.
 */
export const discard = async (
  ctx: MutationCtx,
  scope: Scope,
  resource: ResourceKey
): Promise<void> => {
  // One prefix range covers both tiers; `by_resource_state` would need one per
  // tier and buys nothing, since order does not matter to a delete.
  const sets = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_revision", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
    )
    .collect();

  const snapshots = await ctx.db
    .query("resourceSnapshots")
    .withIndex("by_resource_role", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
    )
    .collect();

  for (const row of [...sets, ...snapshots]) await ctx.db.delete(row._id);
};
