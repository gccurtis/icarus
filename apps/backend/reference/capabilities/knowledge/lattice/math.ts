// Pure math utilities used throughout the lattice.

/** Dot product of two same-length vectors. */
export const dot = (a: number[], b: number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** L2 norm of a vector. */
export const norm = (v: number[]): number => Math.sqrt(dot(v, v));

/** Return a unit-normalized copy of v. Zero vectors return themselves. */
export const normalize = (v: number[]): number[] => {
  const n = norm(v);
  if (n === 0) return v.slice();
  return v.map((x) => x / n);
};

/** Cosine similarity (assumes unit-normalized inputs for speed). */
export const cosineSim = dot;

/**
 * Compute the unit-normalized centroid of a set of unit-normalized vectors.
 * Returns a zero vector if the set is empty.
 */
export const centroid = (vecs: number[][]): number[] => {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return normalize(sum);
};

/** Minimum pairwise cosine similarity inside a set of indices (cohesion). */
export const minPairwiseSim = (indices: number[], sim: number[][]): number => {
  let min = 1;
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      const s = sim[indices[a]][indices[b]];
      if (s < min) min = s;
    }
  }
  return min;
};

/**
 * Build a full n×n cosine similarity matrix from unit-normalized vectors.
 * Symmetric; diagonal is 1.
 */
export const buildSimilarityMatrix = (vecs: number[][]): number[][] => {
  const n = vecs.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    sim[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const s = dot(vecs[i], vecs[j]);
      sim[i][j] = s;
      sim[j][i] = s;
    }
  }
  return sim;
};

/**
 * Estimate a similarity threshold from the similarity matrix at the given
 * percentile. Samples up to sampleBudget pairs; uses all pairs if n(n-1)/2
 * is within budget.
 */
export const estimateThreshold = (
  sim: number[][],
  percentile: number,
  floor: number,
  sampleBudget = 200_000
): number => {
  const n = sim.length;
  const totalPairs = (n * (n - 1)) / 2;
  const samples: number[] = [];

  if (totalPairs <= sampleBudget) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        samples.push(sim[i][j]);
      }
    }
  } else {
    // Stride sample
    const stride = Math.max(1, Math.floor(totalPairs / sampleBudget));
    let k = 0;
    outer: for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (k++ % stride === 0) {
          samples.push(sim[i][j]);
          if (samples.length >= sampleBudget) break outer;
        }
      }
    }
  }

  samples.sort((a, b) => a - b);
  const idx = Math.min(
    samples.length - 1,
    Math.floor(percentile * samples.length)
  );
  return Math.max(floor, samples[idx] ?? floor);
};

/** Modified Gram-Schmidt orthonormalization in place. */
export const orthonormalize = (rows: number[][]): void => {
  for (let i = 0; i < rows.length; i++) {
    // Subtract projections onto previous rows
    for (let j = 0; j < i; j++) {
      const proj = dot(rows[i], rows[j]);
      for (let k = 0; k < rows[i].length; k++) {
        rows[i][k] -= proj * rows[j][k];
      }
    }
    const n = norm(rows[i]);
    if (n < 1e-10) {
      // Collapsed row — re-seed with a unit vector along dimension i
      rows[i] = new Array<number>(rows[i].length).fill(0);
      if (i < rows[i].length) rows[i][i] = 1;
    } else {
      for (let k = 0; k < rows[i].length; k++) rows[i][k] /= n;
    }
  }
};

/** Deterministic xorshift64-based PRNG (seed must be non-zero). */
export class Xorshift {
  private state: bigint;

  constructor(seed: number) {
    this.state = BigInt(seed === 0 ? 1 : seed);
  }

  next(): number {
    let s = this.state;
    s ^= s << 13n;
    s ^= s >> 7n;
    s ^= s << 17n;
    s &= 0xFFFF_FFFF_FFFF_FFFFn;
    this.state = s;
    return Number(s);
  }

  /** Uniform float in [0, 1). */
  uniform(): number {
    return (this.next() % 2_000_000) / 2_000_000;
  }

  /** Uniform int in [0, n). */
  intn(n: number): number {
    return this.next() % n;
  }
}
