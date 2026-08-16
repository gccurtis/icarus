import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import { check, touchedBy } from "$revisions/api/submit/check";
import { notFound } from "$revisions/errors";
import type { Op, ResourceKey, ResourceType } from "$revisions/types/change";
import type { Actor } from "$shared/types/actor";

/** A change as its author wrote it, against the revision they were looking at. */
export type AuthoredChange = ResourceKey & {
  baseRevision: number;
  ops: Op[];
};

/**
 * Where the resource stands: the last accepted set, or the leader behind it once
 * consolidation has re-tiered those sets.
 *
 * Two rows at most, rather than the window `read` collects — this needs the
 * maximum revision, not the body. It carries `projectId` because this is also the
 * only row that can say whose the resource is: the change set indexes lead with
 * the resource pair, so nothing in a read of them is scoped by the gate.
 */
const headOf = async (ctx: MutationCtx, resourceType: ResourceType, resourceId: string) => {
  const last = await ctx.db
    .query("changeSets")
    .withIndex("by_resource_state", (q) =>
      q.eq("resourceType", resourceType).eq("resourceId", resourceId).eq("tier", "recent")
    )
    .order("desc")
    .first();
  if (last) return { revision: last.revision, projectId: last.projectId };

  const leader = await ctx.db
    .query("resourceSnapshots")
    .withIndex("by_resource_role", (q) =>
      q.eq("resourceType", resourceType).eq("resourceId", resourceId).eq("role", "leader")
    )
    .unique();
  return leader && { revision: leader.revision, projectId: leader.projectId };
};

/**
 * Accepts a change, or refuses it: read the current revision, decide the change
 * against everything that landed since its author last looked, append it above.
 *
 * **Nothing here is a compare-and-swap.** Convex mutations are serializable, so
 * a writer that commits `current + 1` first invalidates this one's read set and
 * this re-runs against the state that beat it. There is no version field and no
 * retry loop; the isolation level is the guarantee.
 *
 * The insert is the whole write. The resource row is untouched, the leader
 * snapshot is untouched, and nothing is patched — which is the point of keeping
 * the body and the revision off the resource row.
 *
 * **No activity entry.** An edit is a keystroke batch, and a feed of them would
 * bury everything a person would want to read there.
 */
export const submit = async (
  ctx: MutationCtx,
  scope: Scope,
  authored: AuthoredChange
): Promise<{ revision: number }> => {
  const head = await headOf(ctx, authored.resourceType, authored.resourceId);
  // No head means no resource: creating one writes its anchors, so nothing that
  // exists is without one.
  if (!head || head.projectId !== scope.projectId) throw notFound(authored);

  const current = head.revision;
  const touched = touchedBy(authored.ops);
  const ops = await check(ctx, scope, { ...authored, touched }, current);
  const revision = current + 1;

  await ctx.db.insert("changeSets", {
    projectId: scope.projectId,
    resourceType: authored.resourceType,
    resourceId: authored.resourceId,
    revision,
    baseRevision: authored.baseRevision,
    tier: "recent",
    ops,
    touched,
    actor: { kind: "user", userId: scope.userId } satisfies Actor,
    at: Date.now()
  });

  return { revision };
};
