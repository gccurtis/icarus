import { maximalCliques } from "$knowledge/api/cluster/cliques";
import { mergeWindows } from "$knowledge/api/cluster/merge-windows";
import { nodeId } from "$knowledge/api/cluster/node-id";
import {
  centroidOf,
  cohesionOf,
  similarityMatrix,
  thresholdOf
} from "$knowledge/api/cluster/similarity";
import type { ClusterArtifact, ClusterShape } from "$knowledge/types/clustering";

/**
 * `knowledge.clustering.percentile` and `.floor` in `configuration/knowledge.yaml`.
 *
 * Mirrored rather than read, for the reason windowing mirrors its spans: a
 * Convex isolate has no filesystem. `test/unit/configuration.test.ts` is what
 * fails if the file and these disagree.
 */
export const CLUSTER_PERCENTILE = 0.75;
export const CLUSTER_FLOOR = 0.3;

export type LevelResult = {
  readonly clusters: ClusterShape[];
  readonly orphanIds: string[];
};

/**
 * One level: the cliques of a pool, and what belongs to none of them.
 *
 * **The exact path.** It builds the full pairwise matrix, which is quadratic and
 * fine below the crossover — and is the known-correct oracle the approximate
 * path is measured against rather than a placeholder for it.
 *
 * The pool is sorted by id first, so the greedy walk starts from the same place
 * whatever order the store returned rows in. Clique membership, and therefore
 * every node id, is then a property of the vectors alone.
 *
 * A cluster's level is its deepest member's plus one, not a counter over passes.
 * That is what lets a level-3 cluster absorb a level-0 window that never found a
 * home: by now there is something for it to relate to that did not exist when it
 * was passed over.
 */
export const clusterLevel = (pool: readonly ClusterArtifact[]): LevelResult => {
  const artifacts = [...pool].sort((left, right) => (left.id < right.id ? -1 : 1));
  if (artifacts.length < 2) {
    return { clusters: [], orphanIds: artifacts.map((artifact) => artifact.id) };
  }

  const matrix = similarityMatrix(artifacts.map((artifact) => artifact.centroid));
  const threshold = thresholdOf(matrix, CLUSTER_PERCENTILE, CLUSTER_FLOOR);
  const cliques = maximalCliques(artifacts.length, (a, b) => matrix[a][b] >= threshold);

  const claimed = new Set<number>();
  const clusters = cliques.map((clique) => {
    for (const index of clique) claimed.add(index);
    const members = clique.map((index) => artifacts[index]);
    const memberIds = members.map((member) => member.id);

    return {
      key: nodeId(memberIds),
      level: Math.max(...members.map((member) => member.level)) + 1,
      memberIds,
      centroid: centroidOf(members.map((member) => member.centroid)),
      count: memberIds.length,
      cohesion: cohesionOf(matrix, clique),
      windows: mergeWindows(members.flatMap((member) => member.windows))
    };
  });

  return {
    clusters,
    orphanIds: artifacts
      .filter((_, index) => !claimed.has(index))
      .map((artifact) => artifact.id)
  };
};
