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
};
