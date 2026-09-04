const ZERO = 1e-12;

export const validateVector = (
  vector: readonly number[],
  dimensions?: number,
  label = "vector"
): void => {
  if (vector.length === 0) throw new Error(`${label} must not be empty`);
  if (dimensions !== undefined && vector.length !== dimensions) {
    throw new Error(`${label} must have ${dimensions} dimensions`);
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} must contain only finite numbers`);
  }
};

export const magnitude = (vector: readonly number[]): number =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

export const normalizeVector = (vector: readonly number[], label = "vector"): number[] => {
  validateVector(vector, undefined, label);
  const length = magnitude(vector);
  if (length <= ZERO) throw new Error(`${label} must not be the zero vector`);
  return vector.map((value) => value / length);
};

export const dotProduct = (left: readonly number[], right: readonly number[]): number => {
  validateVector(left, right.length, "left vector");
  validateVector(right, left.length, "right vector");
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
};

export const cosineSimilarity = (
  left: readonly number[],
  right: readonly number[]
): number => dotProduct(normalizeVector(left, "left vector"), normalizeVector(right, "right vector"));

/** Mean direction on the unit hypersphere, with an explicit cancellation fallback. */
export const sphericalCentroid = (
  normalizedVectors: readonly (readonly number[])[],
  fallback: readonly number[]
): number[] => {
  if (normalizedVectors.length === 0) throw new Error("a centroid requires at least one vector");
  const dimensions = fallback.length;
  validateVector(fallback, undefined, "centroid fallback");
  const sum = Array.from({ length: dimensions }, () => 0);
  for (const vector of normalizedVectors) {
    validateVector(vector, dimensions, "centroid member");
    vector.forEach((value, index) => (sum[index] += value));
  }
  return magnitude(sum) <= ZERO ? [...fallback] : normalizeVector(sum, "centroid sum");
};
