import { candidateGraph } from "$knowledge/api/cluster/candidates";
import { maximalCliques } from "$knowledge/api/cluster/cliques";
import { mergeWindows } from "$knowledge/api/cluster/merge-windows";
import { nodeId } from "$knowledge/api/cluster/node-id";
import {
  centroidOf,
  cohesionOf,
  dot,
  similarityMatrix,
  thresholdFrom,
  thresholdOf
} from "$knowledge/api/cluster/similarity";
import type { ClusterArtifact, ClusterShape, LevelRelation } from "$knowledge/types/clustering";
import type { LevelIndex } from "$knowledge/types/level-index";

/**
 * `knowledge.clustering.percentile`, `.floor`, and `.knn.maxClusterPool` in
 * `configuration/knowledge.yaml`.
 *
 * Mirrored rather than read, for the reason windowing mirrors its spans: a
 * Convex isolate has no filesystem. `test/unit/configuration.test.ts` is what
 * fails if the file and these disagree.
 */
export const CLUSTER_PERCENTILE = 0.75;
export const CLUSTER_FLOOR = 0.3;
export const MAX_CLUSTER_POOL = 2000;

export type LevelResult = {
  readonly clusters: ClusterShape[];
  readonly orphanIds: string[];
  /** What the pool was clustered through, when it was too large to compare in full. */
  readonly index?: LevelIndex;
};

/**
 * Every pair, compared. Quadratic, affordable below the crossover, and the
 * known-correct oracle the approximate path is measured against.
 */
export const exactRelation = (vectors: readonly (readonly number[])[]): LevelRelation => {
  const matrix = similarityMatrix(vectors);
  const threshold = thresholdOf(matrix, CLUSTER_PERCENTILE, CLUSTER_FLOOR);

  return {
    threshold,
    similarity: (a, b) => matrix[a][b],
    adjacent: (a, b) => matrix[a][b] >= threshold
  };
};

/**
 * The pairs an IVF search over a PCA projection found worth comparing, scored in
 * full.
 *
 * **The projection selects candidates and never scores them.** Every weight
 * here, and therefore every cohesion and every threshold, is a full-dimensional
 * dot product — approximation where it buys asymptotics, exactness where it
 * affects answers.
 *
 * The threshold comes off the graph's edges through the same function the exact
 * path uses on its matrix, so a candidate search that reached every pair lands
 * on exactly the exact path's threshold rather than near it.
 */
export const approximateRelation = (vectors: readonly (readonly number[])[]): LevelRelation => {
  const graph = candidateGraph(vectors);
  const size = vectors.length;

  const weights = new Map<number, number>();
  const pairs: number[] = [];
  graph.neighbours.forEach((list, from) => {
    for (const { to, similarity } of list) {
      // The graph is symmetric, so counting the lower half would weigh every
      // pair twice and say nothing more.
      if (to < from) continue;
      weights.set(from * size + to, similarity);
      pairs.push(similarity);
    }
  });

  const threshold = thresholdFrom(pairs, CLUSTER_PERCENTILE, CLUSTER_FLOOR);
  const edge = (a: number, b: number) => weights.get(a < b ? a * size + b : b * size + a);

  return {
    threshold,
    // A pair outside the graph is outside the *search*, not outside the
    // arithmetic: whatever asks gets the same full-dimensional answer.
    similarity: (a, b) => edge(a, b) ?? dot(vectors[a], vectors[b]),
    // …but it is not related, however close it turns out to be. Scoring the
    // pairs the search skipped is what the search exists to avoid.
    adjacent: (a, b) => (edge(a, b) ?? -1) >= threshold,
    candidates: { k: graph.k, basis: graph.basis, centroids: graph.centroids }
  };
};

/**
 * The cliques of a pool under one relation, and what belongs to none of them.
 *
 * Takes the relation rather than choosing it, which is what lets the exact path
 * be run over a pool the approximate one would have taken — the comparison the
 * approximate path is proved by.
 *
 * A cluster's level is its deepest member's plus one, not a counter over passes.
 * That is what lets a level-3 cluster absorb a level-0 window that never found a
 * home: by now there is something for it to relate to that did not exist when it
 * was passed over.
 */
export const levelOf = (
  artifacts: readonly ClusterArtifact[],
  relation: LevelRelation
): LevelResult => {
  const cliques = maximalCliques(artifacts.length, relation.adjacent);

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
      cohesion: cohesionOf(relation.similarity, clique),
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

/**
 * One level of the lattice, by whichever path the pool's size affords.
 *
 * **The crossover is where exactness stops being affordable**, and nothing else
 * changes with it: both paths score in full, both read their threshold off the
 * pool's own distribution, and both find overlapping maximal cliques. What the
 * approximate path gives up is comparing every pair, not knowing how similar the
 * pairs it compares are.
 *
 * The pool is sorted by id first, so the greedy walk starts from the same place
 * whatever order the store returned rows in. Clique membership, and therefore
 * every node id, is then a property of the vectors alone.
 */
export const clusterLevel = (pool: readonly ClusterArtifact[]): LevelResult => {
  const artifacts = [...pool].sort((left, right) => (left.id < right.id ? -1 : 1));
  if (artifacts.length < 2) {
    return { clusters: [], orphanIds: artifacts.map((artifact) => artifact.id) };
  }

  const vectors = artifacts.map((artifact) => artifact.centroid);
  const relation =
    artifacts.length <= MAX_CLUSTER_POOL ? exactRelation(vectors) : approximateRelation(vectors);

  const result = levelOf(artifacts, relation);
  if (!relation.candidates) return result;

  return {
    ...result,
    index: {
      // The pool's own depth. A cluster's level is its deepest member's plus
      // one, so this is the level the basis was fitted over rather than the one
      // it produced.
      level: Math.max(...artifacts.map((artifact) => artifact.level)),
      threshold: relation.threshold,
      ...relation.candidates
    }
  };
};
