import type { Doc } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type { ResourceKey } from "$revisions/types/change";

/** Where a resource stands, and whose it is. */
export type Head = { revision: number; projectId: Doc<"changeSets">["projectId"] };

/**
 * The last accepted set, or the leader behind it once consolidation has
 * re-tiered those sets.
 *
 * **Two rows at most, and never a body.** A caller that wants the current
 * revision — to accept a change above it, or to ask whether a generation is out
 * of date — must not pay for the deck the leader carries, which is what makes
 * this affordable once per input of every output in a project.
 *
 * It carries `projectId` because this is also the only row that can say whose
 * the resource is: the change-set indexes lead with the resource pair, so
 * nothing in a read of them is scoped by the gate. **No head means no
 * resource** — [`start`](start.ts) writes the leader in the same transaction as
 * the resource row, so nothing that exists is without one.
 */
export const head = async (ctx: QueryCtx, resource: ResourceKey): Promise<Head | null> => {
  const last = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_state", (q) =>
      q
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
        .eq("tier", "recent")
    )
    .order("desc")
    .first();
  if (last) return { revision: last.revision, projectId: last.projectId };

  const leader = await ctx.db
    .query("resourceSnapshots")
    .withIndex("by_resource_role", (q) =>
      q
        .eq("resourceType", resource.resourceType)
        .eq("resourceId", resource.resourceId)
        .eq("role", "leader")
    )
    .unique();
  return leader ? { revision: leader.revision, projectId: leader.projectId } : null;
};
