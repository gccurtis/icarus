import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { readVersion } from "$knowledge/api/shared/version";
import type { LatticeCause, LatticeNodeSet } from "$knowledge/types/lattice-change";
import type { ResourceKey } from "$revisions/types/change";

/**
 * `revisions.lattice.changeHistory` in `configuration/revisions.yaml`, mirrored
 * because a Convex isolate has no filesystem. `test/unit/configuration.test.ts`
 * fails if the file and this disagree.
 */
export const CHANGE_HISTORY = 1000;

/** What produced a change, without the parts storage decides. */
export type ChangeRecord = {
  readonly cause: LatticeCause;
  readonly nodeSets: readonly LatticeNodeSet[];
  readonly reclustered?: readonly number[];
};

/** The project's lattice history, newest first. */
export const changeHistory = async (
  ctx: QueryCtx,
  scope: Scope
): Promise<Doc<"latticeChanges">[]> =>
  await ctx.db
    .query("latticeChanges")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .order("desc")
    .collect();

/**
 * Write one change down, and drop the oldest that no longer fit.
 *
 * **The version is read rather than passed.** A change row is only meaningful
 * beside the lattice state it produced, and a caller that had to supply the
 * number could supply the wrong one.
 *
 * **Pruning is oldest-first and loses nothing.** Lattice history carries no
 * correctness weight — the lattice can be rebuilt from project content at any
 * time, so a dropped row costs an explanation and never a state. That is what
 * makes this different from a resource snapshot, where pruning has to advance a
 * base first.
 *
 * The read is bounded by `CHANGE_HISTORY` because this same function is what
 * keeps the table under it. There is no second writer.
 */
export const recordChange = async (
  ctx: MutationCtx,
  scope: Scope,
  change: ChangeRecord
): Promise<Id<"latticeChanges">> => {
  const version = await readVersion(ctx, scope);
  const id = await ctx.db.insert("latticeChanges", {
    projectId: scope.projectId,
    // A project with no version row has no lattice for a change to have moved.
    version: version?.version ?? 0,
    cause: change.cause,
    nodeSets: [...change.nodeSets],
    reclustered: change.reclustered ? [...change.reclustered] : undefined,
    at: Date.now()
  });

  const oldestFirst = await ctx.db
    .query("latticeChanges")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();
  for (const row of oldestFirst.slice(0, Math.max(0, oldestFirst.length - CHANGE_HISTORY))) {
    await ctx.db.delete(row._id);
  }

  return id;
};

/**
 * The revision of a resource the lattice last indexed, if it ever did.
 *
 * The gap between this and the resource's current revision is a subtraction,
 * and that subtraction is the only honest answer to "how far behind is the
 * index" — a lattice that is behind without saying what it is behind makes a
 * stale retrieval result unattributable.
 *
 * A cause that is not a `resource` followed no change-set sequence, so it can
 * never answer this. Absent is not zero.
 */
export const indexedRevision = (
  history: readonly Doc<"latticeChanges">[],
  key: ResourceKey
): number | undefined => {
  for (const change of history) {
    const { cause } = change;
    if (
      cause.kind === "resource" &&
      cause.resourceType === key.resourceType &&
      cause.resourceId === key.resourceId
    ) {
      return cause.revision;
    }
  }
  return undefined;
};
