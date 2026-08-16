import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { clusterLevel } from "$knowledge/api/cluster/level";
import type { ClusterArtifact } from "$knowledge/types/clustering";

/** The algorithm sees strings; what goes back into `members` came out of the store. */
const asNodeIds = (ids: readonly string[]) => ids as Id<"latticeNodes">[];

const artifactOf = (node: Doc<"latticeNodes">): ClusterArtifact => ({
  id: node._id,
  level: node.level,
  centroid: node.centroid,
  windows: node.windows
});

export type Grown = {
  readonly written: Id<"latticeNodes">[];
  /** The keys of set-aside rows this pass reached again, and therefore kept. */
  readonly reused: Set<string>;
};

/**
 * Cluster a tier's frontier, and keep going until nothing more clusters.
 *
 * **Each level's orphans are carried into the next one.** A window with no
 * strong neighbour is not dropped and not forced into the nearest cluster — it
 * waits, and a cluster formed above it may take it in, because by then there is
 * something for it to relate to that did not exist before.
 *
 * The loop terminates because every level shrinks the pool: a clique of two or
 * more becomes one node, and the highest-indexed artifact in any clique never
 * seeds one of its own, so a level of *n* artifacts yields at most *n − 1*.
 *
 * What is left unclustered at the end is the tier's roots, which is exactly
 * retrieval's frontier — the pass deliberately does not tidy them away.
 *
 * `reusable` is what a rebuild set aside, keyed by membership. A clique that
 * names the same members **is** that cluster, so it keeps the row rather than
 * being written beside it — which is what identity being a hash of the sorted
 * member ids buys, and why a rebuild that reaches the same grouping churns
 * nothing.
 */
export const grow = async (
  ctx: MutationCtx,
  scope: Scope,
  tierSourceId: string | undefined,
  frontier: readonly Doc<"latticeNodes">[],
  reusable: ReadonlyMap<string, Doc<"latticeNodes">> = new Map()
): Promise<Grown> => {
  const written: Id<"latticeNodes">[] = [];
  const reused = new Set<string>();
  const at = Date.now();
  let pool: ClusterArtifact[] = frontier.map(artifactOf);

  while (pool.length >= 2) {
    const { clusters, orphanIds } = clusterLevel(pool);
    if (clusters.length === 0) break;

    const orphans = new Set(orphanIds);
    const next = pool.filter((artifact) => orphans.has(artifact.id));

    for (const shape of clusters) {
      const measured = {
        projectId: scope.projectId,
        level: shape.level,
        tierSourceId,
        windows: shape.windows,
        centroid: shape.centroid,
        count: shape.count,
        cohesion: shape.cohesion,
        members: asNodeIds(shape.memberIds),
        updatedAt: at
      };

      const kept = reusable.get(shape.key);
      let id: Id<"latticeNodes">;
      if (kept) {
        // Written over rather than replaced, and up to date by definition — it
        // has just been measured against what is there now.
        await ctx.db.patch(kept._id, { ...measured, staleAt: undefined });
        reused.add(shape.key);
        id = kept._id;
      } else {
        id = await ctx.db.insert("latticeNodes", { ...measured, clustered: false });
      }
      written.push(id);

      // Cliques overlap, so a member can be held twice while only one field can
      // name a parent. `members` is the truth about containment; `parentId` is
      // the walk upwards, and the first clique to claim it keeps it so that a
      // rebuild of the same grouping writes the same rows.
      for (const memberId of asNodeIds(shape.memberIds)) {
        const member = await ctx.db.get(memberId);
        if (member && !member.clustered) {
          await ctx.db.patch(memberId, { clustered: true, parentId: id });
        }
      }

      next.push({
        id,
        level: shape.level,
        centroid: shape.centroid,
        windows: shape.windows
      });
    }

    pool = next;
  }

  return { written, reused };
};
