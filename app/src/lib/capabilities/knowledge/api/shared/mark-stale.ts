import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";

/**
 * Marks nodes stale, and everything above them.
 *
 * **Staleness cascades upward.** A cluster assembled from a passage that no
 * longer exists is out of date whether or not its own centroid moved, and
 * `parentId` is the whole path — one field read per level rather than an edge
 * query.
 *
 * Retrieval keeps using stale nodes, marked as possibly out of date, while
 * re-embedding and re-clustering catch up. The alternative is a window where
 * edited content is absent from search entirely, and a slightly stale answer
 * beats a confidently incomplete one.
 *
 * Returns how many were newly marked, which is what the version's `staleCount`
 * moves by.
 */
export const markStale = async (
  ctx: MutationCtx,
  scope: Scope,
  from: readonly Id<"latticeNodes">[],
  at: number
): Promise<number> => {
  const seen = new Set<string>();
  let marked = 0;

  for (const start of from) {
    let id: Id<"latticeNodes"> | undefined = start;
    while (id && !seen.has(id)) {
      seen.add(id);
      const node: Doc<"latticeNodes"> | null = await ctx.db.get(id);
      // Another project's node is not this project's to mark, and the parent
      // chain is where a stray write would cross the boundary unnoticed.
      if (!node || node.projectId !== scope.projectId) break;
      if (node.staleAt === undefined) {
        await ctx.db.patch(id, { staleAt: at });
        marked++;
      }
      id = node.parentId;
    }
  }

  return marked;
};
