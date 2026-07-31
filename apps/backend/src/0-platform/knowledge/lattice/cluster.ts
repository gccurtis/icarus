import { createHash } from "node:crypto";
import type { KnowledgeNode, FrontierEntry, ClusterConfig, KNNConfig } from "#platform/knowledge/types.js";
import { NODE_PREFIX, WINDOW_PREFIX, isWindowId } from "#platform/knowledge/types.js";
import {
  buildSimilarityMatrix,
  centroid,
  cosineSim,
  estimateThreshold,
  minPairwiseSim,
  normalize
} from "#platform/knowledge/lattice/math.js";
import { buildKNNGraph, projectVector } from "#platform/knowledge/lattice/knn.js";

const DEFAULT_PERCENTILE = 0.75;
const DEFAULT_FLOOR = 0.30;

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  percentile: DEFAULT_PERCENTILE,
  floor: DEFAULT_FLOOR,
  knn: {
    k: 32,
    pcaDims: 128,
    maxClusterPool: 2000,
    repairMaxFraction: 0.2,
    repairMaxDrift: 0.02
  }
};

export interface Artifact {
  id: string;
  vector: number[];
  level: number; // 0 = window
}

interface ClusterLevelResult {
  nodes: KnowledgeNode[];
  orphanIds: string[];
}

// ─── Node ID derivation ───────────────────────────────────────────────────────

export const makeNodeId = (memberIds: string[]): string =>
  NODE_PREFIX +
  createHash("sha256")
    .update([...memberIds].sort().join("\x00"))
    .digest("hex")
    .slice(0, 32);

export const makeWindowId = (sourceId: string, text: string): string =>
  WINDOW_PREFIX +
  createHash("sha256")
    .update(sourceId + "\x00" + text)
    .digest("hex")
    .slice(0, 32);

// ─── Greedy maximal clique finding ───────────────────────────────────────────

/**
 * Greedy overlapping clique finder. For each artifact (in order), grows the
 * largest clique it can seed: starts with that artifact and greedily adds
 * every subsequent artifact that is adjacent to ALL current clique members.
 * Cliques of size ≥ 2 are collected; singletons are orphans.
 *
 * Complexity: O(n² × average clique size). Works correctly for the exact path
 * (n ≤ maxClusterPool) and for the k-NN adjacency graph on larger pools.
 */
function findCliques(n: number, isAdj: (i: number, j: number) => boolean): number[][] {
  const cliques: number[][] = [];
  const inClique = new Set<number>();

  for (let i = 0; i < n; i++) {
    const clique = [i];
    for (let j = i + 1; j < n; j++) {
      if (clique.every((k) => isAdj(k, j))) {
        clique.push(j);
      }
    }
    if (clique.length >= 2) {
      cliques.push(clique);
      for (const idx of clique) inClique.add(idx);
    }
  }

  return cliques;
}

// ─── One level of KLR clustering ─────────────────────────────────────────────

function clusterLevel(
  artifacts: Artifact[],
  level: number,
  sourceId: string | undefined,
  config: ClusterConfig
): ClusterLevelResult {
  const n = artifacts.length;
  if (n < 2) {
    return { nodes: [], orphanIds: artifacts.map((a) => a.id) };
  }

  const vecs = artifacts.map((a) => a.vector);
  const useExact = n <= config.knn.maxClusterPool;

  let threshold: number;
  let isAdj: (i: number, j: number) => boolean;

  if (useExact) {
    const sim = buildSimilarityMatrix(vecs);
    threshold = estimateThreshold(sim, config.percentile, config.floor);
    isAdj = (i, j) => sim[i][j] >= threshold;
  } else {
    // Sparse path: use k-NN graph
    const { graph, basis, cellCentroids } = buildKNNGraph(vecs, config.knn);
    // Estimate threshold from graph edge similarities
    const edgeSims: number[] = [];
    for (const [, neighbors] of graph) {
      for (const { sim } of neighbors) edgeSims.push(sim);
    }
    edgeSims.sort((a, b) => a - b);
    const idx = Math.floor(config.percentile * edgeSims.length);
    threshold = Math.max(config.floor, edgeSims[idx] ?? config.floor);

    // Build projected query function for future descent (not used here directly)
    void basis;
    void cellCentroids;

    isAdj = (i, j) => {
      const neighbors = graph.get(i);
      if (!neighbors) return false;
      return neighbors.some((nb) => nb.idx === j && nb.sim >= threshold);
    };
  }

  const cliques = findCliques(n, isAdj);
  const inAnyClique = new Set<number>();
  const nodes: KnowledgeNode[] = [];

  for (const clique of cliques) {
    for (const idx of clique) inAnyClique.add(idx);
    const members = clique.map((i) => artifacts[i]);
    const memberIds = members.map((m) => m.id);
    const memberVecs = members.map((m) => m.vector);

    nodes.push({
      id: makeNodeId(memberIds),
      sourceId,
      level,
      centroid: centroid(memberVecs),
      count: memberIds.length,
      cohesion: minPairwiseSim(
        clique,
        useExact ? buildSimilarityMatrix(memberVecs) : buildSimilarityMatrix(memberVecs)
      ),
      memberIds
    });
  }

  const orphanIds = artifacts
    .filter((_, i) => !inAnyClique.has(i))
    .map((a) => a.id);

  return { nodes, orphanIds };
}

// ─── Full source-tier lattice build ──────────────────────────────────────────

export interface SourceLatticeResult {
  allNodes: KnowledgeNode[];
  frontier: FrontierEntry[];
}

/**
 * Build the source-tier forest for one source. Iteratively clusters the
 * artifact pool until no further clustering is possible or the pool is too
 * small. Returns all created nodes plus the source frontier.
 */
export function buildSourceLattice(
  windowArtifacts: Artifact[],
  sourceId: string,
  config: ClusterConfig
): SourceLatticeResult {
  let pool: Artifact[] = windowArtifacts.map((a) => ({ ...a, level: 0 }));
  const frontier: FrontierEntry[] = [];
  const allNodes: KnowledgeNode[] = [];

  for (let level = 1; pool.length >= 2; level++) {
    const { nodes, orphanIds } = clusterLevel(pool, level, sourceId, config);

    // Orphans can't cluster further — they go to the source frontier
    for (const id of orphanIds) {
      const artifact = pool.find((a) => a.id === id)!;
      frontier.push({ id, vector: artifact.vector, isWindow: artifact.level === 0 });
    }

    if (nodes.length === 0) {
      pool = [];
      break;
    }

    for (const n of nodes) allNodes.push(n);

    // Next level's pool is the new nodes' centroids
    pool = nodes.map((n) => ({ id: n.id, vector: n.centroid, level }));
  }

  // Whatever remains in pool (0 or 1 artifact after loop) goes to frontier
  for (const a of pool) {
    const alreadyAdded = frontier.some((f) => f.id === a.id);
    if (!alreadyAdded) {
      frontier.push({ id: a.id, vector: a.vector, isWindow: a.level === 0 });
    }
  }

  return { allNodes, frontier };
}

// ─── Corpus-tier lattice build ────────────────────────────────────────────────

export interface CorpusLatticeResult {
  corpusNodes: KnowledgeNode[];
  corpusFrontier: FrontierEntry[];
}

/**
 * Cluster the union of all sources' frontier entries into the corpus tier.
 * The corpus frontier is what descent enters from.
 */
export function buildCorpusTier(
  sourceFrontiers: FrontierEntry[],
  config: ClusterConfig
): CorpusLatticeResult {
  if (sourceFrontiers.length === 0) {
    return { corpusNodes: [], corpusFrontier: [] };
  }

  const pool: Artifact[] = sourceFrontiers.map((f) => ({
    id: f.id,
    vector: f.vector,
    level: f.isWindow ? 0 : 1
  }));

  const { allNodes, frontier } = buildSourceLattice(pool, "", config);

  // Corpus nodes have no sourceId
  const corpusNodes = allNodes.map((n) => ({ ...n, sourceId: undefined }));
  return { corpusNodes, corpusFrontier: frontier };
}
