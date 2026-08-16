import type { Id } from "$convex/_generated/dataModel";

/**
 * A pair one clustering pass found related, and how strongly.
 *
 * **`weight` is a full-dimensional dot product, always.** The PCA projection
 * used above the crossover selects which pairs are worth comparing and never
 * decides how similar they are, so a projected score never reaches a row.
 *
 * Ids rather than pool positions, because a pass hands these to storage and the
 * pool is gone by then.
 */
export type LevelEdge = {
  readonly fromId: string;
  readonly toId: string;
  readonly weight: number;
};

/**
 * The far end of an edge, from the node that was asked about.
 *
 * A neighbour query does not care which column held which id — one row per pair
 * is read from either end — so what comes back is the *other* node rather than
 * the row.
 */
export type LatticeNeighbour = {
  readonly nodeId: Id<"latticeNodes">;
  /** The generation the pass ran at, which is not necessarily either node's own. */
  readonly level: number;
  readonly weight: number;
};
