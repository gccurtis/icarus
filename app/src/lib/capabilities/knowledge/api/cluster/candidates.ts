import { assignCells, cellCount } from "$knowledge/api/cluster/cells";
import { fitProjection, project } from "$knowledge/api/cluster/projection";
import { dot } from "$knowledge/api/cluster/similarity";

/**
 * `knowledge.clustering.knn` in `configuration/knowledge.yaml`, mirrored because
 * a Convex isolate has no filesystem. `test/unit/configuration.test.ts` fails if
 * the file and these disagree.
 */
export const NEIGHBOURS_K = 32;
export const PCA_DIMS = 128;
export const PROBE_CELLS = 4;

export type Neighbour = {
  readonly to: number;
  /** A **full-dimensional** dot product. Never a projected one. */
  readonly similarity: number;
};

export type CandidateGraph = {
  /** Symmetric: `to` appears in `from`'s list exactly when the reverse holds. */
  readonly neighbours: readonly (readonly Neighbour[])[];
  /** One cell per artifact, in the pool's own order. */
  readonly cells: readonly number[];
  readonly basis: number[][];
  readonly centroids: number[][];
  readonly k: number;
};

/** Strongest first, and by position where two are equally strong. */
const strongestFirst = (left: Neighbour, right: Neighbour) =>
  right.similarity - left.similarity || left.to - right.to;

/**
 * The neighbour graph clique-finding runs over, above the crossover.
 *
 * **The projection guides candidate selection and nothing else.** An artifact is
 * compared against its own cell and the nearest few rather than against the
 * pool, and every surviving candidate is then scored with a **full-dimensional**
 * dot product. So the approximation decides which pairs are worth comparing and
 * never how similar they are: cheap where it buys asymptotics, exact where it
 * affects answers.
 *
 * **The graph is symmetrized by union, and deliberately not re-truncated.** An
 * edge one endpoint kept and the other did not is still an edge — dropping it to
 * hold every artifact at `k` would make adjacency depend on which end was asked,
 * and a clique is only a clique if both ends agree. A popular artifact therefore
 * keeps more than `k` neighbours, and the graph still holds at most `n · k`
 * edges, which is the bound that matters.
 */
export const candidateGraph = (vectors: readonly (readonly number[])[]): CandidateGraph => {
  const count = vectors.length;
  const k = Math.max(0, Math.min(NEIGHBOURS_K, count - 1));

  const basis = fitProjection(vectors, Math.min(PCA_DIMS, vectors[0]?.length ?? PCA_DIMS));
  const projections =
    basis.length > 0 ? vectors.map((vector) => project(basis, vector)) : vectors.map((v) => [...v]);
  const { centroids, assignments } = assignCells(projections, cellCount(count));

  const members: number[][] = Array.from({ length: centroids.length }, () => []);
  for (let i = 0; i < count; i++) members[assignments[i]].push(i);

  const found: Map<number, number>[] = Array.from({ length: count }, () => new Map());
  for (let i = 0; i < count; i++) {
    const probed = centroids
      .map((centroid, cell) => ({ cell, score: dot(projections[i], centroid) }))
      .sort((left, right) => right.score - left.score || left.cell - right.cell)
      .slice(0, PROBE_CELLS);

    const candidates = new Set<number>();
    for (const { cell } of probed) {
      for (const member of members[cell]) if (member !== i) candidates.add(member);
    }

    const ranked = [...candidates]
      .map((to) => ({ to, similarity: dot(vectors[i], vectors[to]) }))
      .sort(strongestFirst)
      .slice(0, k);

    for (const neighbour of ranked) {
      found[i].set(neighbour.to, neighbour.similarity);
      found[neighbour.to].set(i, neighbour.similarity);
    }
  }

  return {
    neighbours: found.map((list) =>
      [...list].map(([to, similarity]) => ({ to, similarity })).sort(strongestFirst)
    ),
    cells: assignments,
    basis,
    centroids,
    k
  };
};
