import type { CandidateFit } from "$knowledge/types/level-index";
import type { LatticeWindow } from "$knowledge/types/lattice-node";

/**
 * What clustering sees of a node: an identity, a depth, a direction, and the
 * spans it covers.
 *
 * Deliberately not a stored row. Clustering is arithmetic over vectors, and
 * keeping the store's shape out of it is what lets the same code cluster windows
 * read out of one source and clusters spanning many.
 */
export type ClusterArtifact = {
  readonly id: string;
  readonly level: number;
  readonly centroid: readonly number[];
  readonly windows: readonly LatticeWindow[];
};

/**
 * How one level answers "are these two related, and how strongly" — asked by
 * position in the pool, so a level can answer from a full matrix or from a
 * sparse candidate graph without the clique finder knowing which.
 *
 * `similarity` is a **full-dimensional** dot product on both paths, and
 * `threshold` is read off the pool's own pairs on both. Only `adjacent` differs,
 * and only in reach: above the crossover a pair the candidate search never
 * compared is not related, however close it turns out to be. So the two paths
 * agree wherever the search found every pair above the threshold.
 */
export type LevelRelation = {
  readonly threshold: number;
  readonly similarity: (a: number, b: number) => number;
  readonly adjacent: (a: number, b: number) => boolean;
  /** Present on the approximate path alone — the exact one fits nothing. */
  readonly candidates?: CandidateFit;
};

/** A clique, measured and ready to be written down as a node. */
export type ClusterShape = {
  /** The hash of the sorted member ids — what this cluster *is*. */
  readonly key: string;
  readonly level: number;
  readonly memberIds: readonly string[];
  readonly centroid: number[];
  readonly count: number;
  /** The weakest pairwise similarity inside the clique, never the mean. */
  readonly cohesion: number;
  readonly windows: LatticeWindow[];
};

/**
 * What one clustering pass did.
 *
 * Counts rather than ids: a caller wants to know whether the lattice moved and
 * how far, and a pass over a large project would otherwise answer with a list
 * nobody reads.
 */
export type ClusterPass = {
  readonly tiers: number;
  readonly created: number;
  readonly dissolved: number;
  readonly rebuilt: number;
  readonly levelCount: number;
  /**
   * Nodes this pass wrote, per level, indexed by level — what a
   * [change](lattice-change.ts) records as `reclustered`.
   *
   * A count rather than a list of ids for the reason the rest of this type is
   * counts: an edit cascades upward, and what a person wants to know is how far
   * up it reached, not which four hundred rows moved.
   */
  readonly reclustered: readonly number[];
};
