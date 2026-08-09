import type { KNNConfig, StoredLevelIndex } from "#platform/knowledge/types.js";
import { dot, normalize, orthonormalize, Xorshift } from "#platform/knowledge/lattice/math.js";

const PROJECTION_SEED = 0x9e3779b9;
const KMEANS_SEED = 0xd1b54a32;
const PROJECTION_SAMPLE_MAX = 1000;
const PROJECTION_ITERATIONS = 4;
const KMEANS_ITERATIONS = 8;
const PROBE_CELLS = 4;

// ─── PCA basis fitting ────────────────────────────────────────────────────────

/**
 * Fit a d-row orthonormal PCA basis over the pool's dominant directions using
 * uncentered subspace iteration on a stride sample. Uncentered because the
 * basis approximates dot products, not mean-centered variance.
 */
export function fitProjection(vecs: number[][], d: number): number[][] {
  if (vecs.length === 0 || d <= 0) return [];
  const dim = vecs[0].length;
  if (d >= dim) return [];

  const rng = new Xorshift(PROJECTION_SEED);

  // Stride sample
  const sample =
    vecs.length > PROJECTION_SAMPLE_MAX
      ? Array.from({ length: PROJECTION_SAMPLE_MAX }, (_, i) =>
          vecs[Math.floor((i * vecs.length) / PROJECTION_SAMPLE_MAX)]
        )
      : vecs;

  // Initialize random orthonormal basis
  const q: number[][] = Array.from({ length: d }, () => {
    const row = Array.from({ length: dim }, () => rng.uniform() * 2 - 1);
    return row;
  });
  orthonormalize(q);

  // Subspace iteration: q ← X'Xq, orthonormalize
  for (let iter = 0; iter < PROJECTION_ITERATIONS; iter++) {
    const z: number[][] = Array.from({ length: d }, () => new Array<number>(dim).fill(0));
    for (const x of sample) {
      for (let j = 0; j < d; j++) {
        const c = dot(x, q[j]);
        for (let t = 0; t < dim; t++) z[j][t] += c * x[t];
      }
    }
    for (let j = 0; j < d; j++) q[j] = z[j];
    orthonormalize(q);
  }

  return q;
}

/** Project a vector into the PCA basis. Returns a d-dim projection. */
export function projectVector(basis: number[][], vec: number[]): number[] {
  return basis.map((row) => dot(row, vec));
}

// ─── k-means ─────────────────────────────────────────────────────────────────

function kMeans(
  projections: number[][],
  cells: number,
  seed: number
): { centroids: number[][]; assignments: number[] } {
  const n = projections.length;
  const d = projections[0].length;
  const rng = new Xorshift(seed);

  // Random initialization
  const centroidIndices = new Set<number>();
  while (centroidIndices.size < Math.min(cells, n)) {
    centroidIndices.add(rng.intn(n));
  }
  let centroids = [...centroidIndices].map((i) => [...projections[i]]);
  let assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestCell = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const s = dot(projections[i], centroids[c]);
        if (s > bestSim) {
          bestSim = s;
          bestCell = c;
        }
      }
      if (assignments[i] !== bestCell) {
        assignments[i] = bestCell;
        changed = true;
      }
    }
    if (!changed) break;

    // Update centroids
    const sums: number[][] = Array.from({ length: centroids.length }, () =>
      new Array<number>(d).fill(0)
    );
    const counts = new Array<number>(centroids.length).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      for (let t = 0; t < d; t++) sums[c][t] += projections[i][t];
      counts[c]++;
    }
    centroids = sums.map((s, c) => (counts[c] > 0 ? normalize(s) : centroids[c]));
  }

  return { centroids, assignments };
}

// ─── k-NN graph building ──────────────────────────────────────────────────────

export interface Neighbor {
  idx: number;
  sim: number;
}

export interface KNNGraphResult {
  graph: Map<number, Neighbor[]>;
  basis: number[][];
  cellCentroids: number[][];
}

/**
 * Build a k-NN graph over the artifact pool using IVF search over a PCA
 * projection. Approximation is only in candidate selection; all stored
 * similarities are exact full-dimension dot products.
 */
export function buildKNNGraph(vecs: number[][], config: KNNConfig): KNNGraphResult {
  const n = vecs.length;
  const k = Math.min(config.k, n - 1);
  const cells = config.cells ?? Math.max(1, Math.round(Math.sqrt(n)));
  const pcaDims = Math.min(config.pcaDims, vecs[0]?.length ?? config.pcaDims);

  const basis = fitProjection(vecs, pcaDims);
  const projections =
    basis.length > 0 ? vecs.map((v) => projectVector(basis, v)) : vecs.map((v) => [...v]);

  const { centroids: cellCentroids, assignments } = kMeans(projections, cells, KMEANS_SEED);

  // Build inverted index: cell → artifact indices
  const cellMembers: number[][] = Array.from({ length: cellCentroids.length }, () => []);
  for (let i = 0; i < n; i++) cellMembers[assignments[i]].push(i);

  // For each artifact, find candidate neighbors via nearest PROBE_CELLS cells
  const graph = new Map<number, Neighbor[]>();

  for (let i = 0; i < n; i++) {
    const qProj = projections[i];

    // Find nearest cells
    const cellScores = cellCentroids.map((c, ci) => ({ ci, score: dot(qProj, c) }));
    cellScores.sort((a, b) => b.score - a.score);
    const probeCells = cellScores.slice(0, PROBE_CELLS).map((x) => x.ci);

    // Collect candidate indices from probed cells
    const candidateSet = new Set<number>();
    for (const ci of probeCells) {
      for (const j of cellMembers[ci]) {
        if (j !== i) candidateSet.add(j);
      }
    }

    // Exact rerank with full-dimension dot products
    const scored = [...candidateSet].map((j) => ({ idx: j, sim: dot(vecs[i], vecs[j]) }));
    scored.sort((a, b) => b.sim - a.sim);
    graph.set(i, scored.slice(0, k));
  }

  // Symmetrize: if j is in i's neighbors, ensure i is in j's neighbors
  for (const [i, neighbors] of graph) {
    for (const { idx: j, sim } of neighbors) {
      const jNeighbors = graph.get(j)!;
      if (!jNeighbors.some((nb) => nb.idx === i)) {
        jNeighbors.push({ idx: i, sim });
        if (jNeighbors.length > k * 2) {
          jNeighbors.sort((a, b) => b.sim - a.sim);
          graph.set(j, jNeighbors.slice(0, k));
        }
      }
    }
  }

  return { graph, basis, cellCentroids };
}

// ─── Stored index construction ────────────────────────────────────────────────

/**
 * Build a StoredLevelIndex from a k-NN graph result for use in query-time
 * IVF-accelerated descent.
 */
export function buildLevelIndex(
  ids: string[],
  graph: Map<number, Neighbor[]>,
  basis: number[][],
  cellCentroids: number[][],
  assignments: number[],
  threshold: number,
  k: number,
  level: number
): StoredLevelIndex {
  return {
    level,
    threshold,
    k,
    basis,
    centroids: cellCentroids,
    artifacts: ids.map((id, i) => ({
      id,
      cell: assignments[i],
      edges: (graph.get(i) ?? []).map(({ idx, sim }) => ({ to: ids[idx], similarity: sim }))
    }))
  };
}
