/**
 * A fixed-seed generator, because the approximate path has to start somewhere
 * and "somewhere" must be the same place every time.
 *
 * Subspace iteration needs an initial basis and k-means needs initial cells, and
 * both would otherwise be drawn at random — which would make the same pool
 * cluster into a different lattice on every rebuild, retrieval irreproducible,
 * and repair impossible to reason about.
 *
 * xorshift32 in plain numbers rather than a wider generator in `BigInt`: this is
 * called once per basis component, and the quality asked of it is "spread out",
 * not "unpredictable".
 */
export const seeded = (seed: number) => {
  // Zero is a fixed point of the shift-xor cycle: seeded(0) would return zero
  // forever and degenerate the basis rather than fail.
  let state = seed >>> 0 || 1;

  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };

  return {
    /** Uniform in [0, 1). */
    uniform: () => next() / 2 ** 32,
    /** Uniform in [0, n). */
    intn: (n: number) => next() % n
  };
};
