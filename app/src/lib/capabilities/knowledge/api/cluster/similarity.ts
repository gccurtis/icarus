/**
 * The pairwise arithmetic every level is built from. Vectors are unit-normalized
 * everywhere in the lattice, so cosine similarity is the dot product.
 */
export const dot = (a: readonly number[], b: readonly number[]): number => {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
};

/** A zero vector has no direction to preserve, so it is returned as it came. */
export const normalize = (vector: readonly number[]): number[] => {
  const length = Math.sqrt(dot(vector, vector));
  return length === 0 ? [...vector] : vector.map((value) => value / length);
};

/**
 * The unit-normalized mean of a set of members.
 *
 * Normalizing is what makes it comparable to the members it stands for: the mean
 * of two unit vectors is shorter than either, and retrieval scores a query
 * against this the same way it scores a window.
 */
export const centroidOf = (vectors: readonly (readonly number[])[]): number[] => {
  if (vectors.length === 0) return [];
  const sum = new Array<number>(vectors[0].length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < sum.length; i++) sum[i] += vector[i];
  }
  return normalize(sum);
};

/** The full pairwise matrix — quadratic, and the exact path's whole cost. */
export const similarityMatrix = (vectors: readonly (readonly number[])[]): number[][] => {
  const matrix = vectors.map(() => new Array<number>(vectors.length).fill(1));
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      matrix[i][j] = matrix[j][i] = dot(vectors[i], vectors[j]);
    }
  }
  return matrix;
};

/**
 * The **weakest** pairwise similarity inside a set, which is a cluster's
 * cohesion.
 *
 * Never the mean. A cluster is only as tight as its loosest pair, and averaging
 * hides exactly the case worth knowing about — a tight core with something
 * barely related attached reads as a healthy cluster under a mean.
 */
export const cohesionOf = (
  matrix: readonly (readonly number[])[],
  indices: readonly number[]
): number => {
  let weakest = 1;
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      weakest = Math.min(weakest, matrix[indices[a]][indices[b]]);
    }
  }
  return weakest;
};

/**
 * The similarity a level calls "related", read off that level's own
 * distribution.
 *
 * **A fixed threshold clusters one corpus into nothing and another into one
 * blob.** The percentile makes it relative to the pool in front of it; the floor
 * is what stops a corpus with no real structure from clustering anyway and
 * inventing relationships the weights do not support.
 */
export const thresholdOf = (
  matrix: readonly (readonly number[])[],
  percentile: number,
  floor: number
): number => {
  const pairs: number[] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) pairs.push(matrix[i][j]);
  }
  if (pairs.length === 0) return floor;

  pairs.sort((left, right) => left - right);
  const at = Math.min(pairs.length - 1, Math.floor(percentile * pairs.length));
  return Math.max(floor, pairs[at]);
};
