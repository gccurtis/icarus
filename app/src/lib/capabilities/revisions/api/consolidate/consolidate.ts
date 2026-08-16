import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { current } from "$revisions/api/shared/current";
import type { ResourceKey } from "$revisions/types/change";

/**
 * `revisions.resources.consolidateAfter` in `configuration/revisions.yaml`.
 *
 * Mirrored rather than read, for the reason `check.ts` mirrors `rebaseWindow`: a
 * mutation runs in an isolate with no filesystem. It must stay below that window,
 * and `test/unit/retention.test.ts` is what fails if the file moves.
 */
export const CONSOLIDATE_AFTER = 100;

/** Where the leader now stands, and how many sets it swallowed getting there. */
export type Consolidation = {
  revision: number;
  folded: number;
};

/**
 * Folds the recent sets into the leader once more than a window has accumulated,
 * and re-tiers them.
 *
 * This is what keeps a read bounded: the leader moves up to the newest set, so
 * the next reader folds nothing. Re-tiering is a flag flip, not a copy between
 * tables and not a delete — the ladder still rebases against these rows, which is
 * why `consolidateAfter` sits below `rebaseWindow`.
 *
 * **The resource row is not involved.** Neither is the base, which stays at
 * revision 0 as the anchor for reconstructing anything below the leader.
 */
export const consolidate = async (
  ctx: MutationCtx,
  scope: Scope,
  resource: ResourceKey
): Promise<Consolidation> => {
  const { leader, sets, revision } = await current(ctx, scope, resource);
  if (sets.length <= CONSOLIDATE_AFTER) return { revision: leader.revision, folded: 0 };

  await ctx.db.patch(leader._id, {
    revision,
    body: applyOps(leader.body, sets.flatMap((set) => set.ops)),
    at: Date.now()
  });
  for (const set of sets) await ctx.db.patch(set._id, { tier: "historical" });

  return { revision, folded: sets.length };
};
