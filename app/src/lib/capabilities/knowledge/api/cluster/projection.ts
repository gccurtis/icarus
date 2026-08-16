import { seeded } from "$knowledge/api/cluster/seeded";
import { dot } from "$knowledge/api/cluster/similarity";

/**
 * `knowledge.clustering.determinism` in `configuration/knowledge.yaml`, mirrored
 * because a Convex isolate has no filesystem. `test/unit/configuration.test.ts`
 * is what fails if the file and these disagree.
 */
export const PROJECTION_SEED = 0x9e3779b9;
export const PROJECTION_SAMPLE_MAX = 1000;
export const PROJECTION_ITERATIONS = 4;

/** Below this a row has nothing left of its own after the projections came off. */
const COLLAPSED = 1e-10;

/**
 * Modified Gram-Schmidt, in place.
 *
 * A collapsed row is re-seeded onto an axis rather than left at zero: a zero row
 * in the basis projects every vector onto nothing, which reads downstream as a
 * pool of identical points rather than as a degenerate basis.
 */
export const orthonormalize = (rows: number[][]): void => {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) {
      const overlap = dot(rows[i], rows[j]);
      for (let t = 0; t < rows[i].length; t++) rows[i][t] -= overlap * rows[j][t];
    }

    const length = Math.sqrt(dot(rows[i], rows[i]));
    if (length < COLLAPSED) {
      rows[i] = new Array<number>(rows[i].length).fill(0);
      if (i < rows[i].length) rows[i][i] = 1;
    } else {
      for (let t = 0; t < rows[i].length; t++) rows[i][t] /= length;
    }
  }
};

/**
 * An orthonormal basis over the pool's dominant directions, by subspace
 * iteration over a stride sample.
 *
 * **Uncentered, deliberately.** The basis approximates *dot products*, not
 * mean-centred variance: subtracting the mean would fit the directions a corpus
 * varies along rather than the ones it points along, which is the wrong quantity
 * and degrades recall without failing anywhere.
 *
 * **Sampled by stride rather than at random**, and seeded from a fixed number,
 * because the same pool has to fit the same basis every time it is rebuilt.
 *
 * An empty basis means there is nothing to gain: a projection into a space no
 * narrower than the vectors already are costs a matrix and saves no comparisons.
 */
export const fitProjection = (vectors: readonly (readonly number[])[], dims: number): number[][] => {
  if (vectors.length === 0 || dims <= 0) return [];
  const width = vectors[0].length;
  if (dims >= width) return [];

  const sample =
    vectors.length > PROJECTION_SAMPLE_MAX
      ? Array.from(
          { length: PROJECTION_SAMPLE_MAX },
          (_, i) => vectors[Math.floor((i * vectors.length) / PROJECTION_SAMPLE_MAX)]
        )
      : vectors;

  const random = seeded(PROJECTION_SEED);
  let basis = Array.from({ length: dims }, () =>
    Array.from({ length: width }, () => random.uniform() * 2 - 1)
  );
  orthonormalize(basis);

  // basis ← X'X · basis, re-orthonormalized: each pass pulls the rows further
  // towards the directions the sample carries the most weight along.
  for (let iteration = 0; iteration < PROJECTION_ITERATIONS; iteration++) {
    const next = Array.from({ length: dims }, () => new Array<number>(width).fill(0));
    for (const vector of sample) {
      for (let row = 0; row < dims; row++) {
        const along = dot(vector, basis[row]);
        for (let t = 0; t < width; t++) next[row][t] += along * vector[t];
      }
    }
    basis = next;
    orthonormalize(basis);
  }

  return basis;
};

/** A vector's coordinates in the basis — one per direction it keeps. */
export const project = (
  basis: readonly (readonly number[])[],
  vector: readonly number[]
): number[] => basis.map((row) => dot(row, vector));
