import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { ResearchThreadsError } from "$research-threads/errors";
import type { ResearchAnchor } from "$research-threads/types/research-thread";

/**
 * Proves the anchor names a row the caller's project holds.
 *
 * **Not found, never forbidden.** An anchor in another project answers exactly
 * as one that never existed; telling them apart confirms what somebody else is
 * trying to find out.
 *
 * A `discover` thread has nothing to prove, which is the mode rather than a
 * skipped check — [`researchThreadAnchor`](../../types/research-thread.ts) has
 * already refused an anchor its mode does not name.
 */
export const requireAnchor = async (
  ctx: QueryCtx,
  scope: Scope,
  anchor: ResearchAnchor
): Promise<void> => {
  const id = anchor.questionId ?? anchor.hypothesisId;
  if (id === undefined) return;

  const row = await ctx.db.get(id);
  if (!row || row.projectId !== scope.projectId) {
    throw new ResearchThreadsError("not-found", `Anchor not found: ${id}`);
  }
};
