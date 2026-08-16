import { seeded } from "$knowledge/api/cluster/seeded";
import { dot, normalize } from "$knowledge/api/cluster/similarity";

/**
 * `knowledge.clustering.knn.cells` and `knowledge.clustering.determinism` in
 * `configuration/knowledge.yaml`, mirrored because a Convex isolate has no
 * filesystem. `test/unit/configuration.test.ts` fails if they disagree.
 */
export const IVF_CELLS: number | null = null;
export const KMEANS_SEED = 0xd1b54a32;
export const KMEANS_ITERATIONS = 8;

/**
 * How many cells a pool is divided into.
 *
 * Roughly the square root of the pool when configuration names no number, which
 * is the standard choice because it is self-scaling: cells and members per cell
 * grow at the same rate, so probing a few stays a small fraction of the whole
 * however large the corpus gets.
 */
export const cellCount = (pool: number): number =>
  IVF_CELLS ?? Math.max(1, Math.round(Math.sqrt(pool)));

export type CellAssignment = {
  readonly centroids: number[][];
  /** One cell per artifact, in the pool's own order. */
  readonly assignments: number[];
};

/**
 * k-means over the projections: each artifact lands in exactly one cell.
 *
 * Cells are what make candidate search cheap — an artifact compares itself
 * against its own cell and the nearest few rather than against the pool — so
 * this is asked for a partition, not for a good clustering. The clusters are
 * decided afterwards, from exact similarities.
 *
 * Seeded from a fixed number and iterated a fixed number of times, so the same
 * pool partitions the same way every rebuild.
 *
 * A cell that lost every member keeps its centroid rather than collapsing to
 * zero: a zero centroid is nearest to nothing and would quietly reduce the
 * number of cells anything can probe.
 */
export const assignCells = (
  projections: readonly (readonly number[])[],
  cells: number
): CellAssignment => {
  const count = projections.length;
  if (count === 0) return { centroids: [], assignments: [] };

  const width = projections[0].length;
  const wanted = Math.min(cells, count);
  const random = seeded(KMEANS_SEED);
  const chosen = new Set<number>();
  // Drawing distinct indices out of a pool the same size as the draw is the
  // coupon collector; taking them in order is the same set and terminates.
  if (wanted === count) for (let i = 0; i < count; i++) chosen.add(i);
  while (chosen.size < wanted) chosen.add(random.intn(count));

  let centroids = [...chosen].map((index) => [...projections[index]]);
  const assignments = new Array<number>(count).fill(0);

  for (let iteration = 0; iteration < KMEANS_ITERATIONS; iteration++) {
    let moved = false;
    for (let i = 0; i < count; i++) {
      let best = 0;
      let bestScore = -Infinity;
      for (let cell = 0; cell < centroids.length; cell++) {
        const score = dot(projections[i], centroids[cell]);
        if (score > bestScore) {
          bestScore = score;
          best = cell;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        moved = true;
      }
    }
    if (!moved) break;

    const sums = Array.from({ length: centroids.length }, () => new Array<number>(width).fill(0));
    const members = new Array<number>(centroids.length).fill(0);
    for (let i = 0; i < count; i++) {
      const cell = assignments[i];
      for (let t = 0; t < width; t++) sums[cell][t] += projections[i][t];
      members[cell]++;
    }
    centroids = sums.map((sum, cell) => (members[cell] > 0 ? normalize(sum) : centroids[cell]));
  }

  return { centroids, assignments };
};
