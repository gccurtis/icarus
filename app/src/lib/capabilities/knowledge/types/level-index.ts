/** What the candidate search itself produced: the geometry it selected through. */
export type CandidateFit = {
  /** Neighbours retained per artifact. */
  readonly k: number;
  /** Orthonormal rows. Empty when the pool is already no wider than the projection. */
  readonly basis: number[][];
  /** IVF cell centroids, in the projected space. */
  readonly centroids: number[][];
};

/**
 * The index one level was clustered through.
 *
 * **Entirely derived.** Every number in it is refittable from the persisted
 * windows, so it can be dropped and rebuilt without losing anything — which is
 * what makes changing `pcaDims`, `k`, or the cell count a rebuild rather than a
 * migration.
 *
 * `threshold` and `k` sit beside the basis for one reason: an index fitted under
 * other parameters has to be recognizable as stale rather than silently mixed
 * with one that is not.
 */
export type LevelIndex = CandidateFit & {
  /** The deepest level in the pool the basis was fitted over. */
  readonly level: number;
  readonly threshold: number;
};
