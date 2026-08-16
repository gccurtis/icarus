import { v, type Infer } from "convex/values";

/**
 * The index's readiness, which is a property of the population and of no node.
 *
 * A lattice mid-rebuild holds a mix of old and new vectors; one mid-clustering
 * has coherent level-0 vectors and an incomplete hierarchy above them. Both are
 * usable for something and not for everything, and only this says which.
 */
export const latticeStateValidator = v.union(
  v.literal("building"),
  v.literal("ready"),
  v.literal("clustering"),
  v.literal("rebuilding"),
  v.literal("error")
);

export type LatticeState = Infer<typeof latticeStateValidator>;

export const rebuildReasonValidator = v.union(
  v.literal("embedding_changed"),
  v.literal("manual"),
  v.literal("corruption")
);

export type RebuildReason = Infer<typeof rebuildReasonValidator>;

/**
 * What the project's lattice was built from and what it is built with.
 *
 * `levelCount` of 1 means level 0 exists and nothing has been clustered yet.
 * That is the normal state between ingestion and a clustering pass, not a
 * failure — windows are embedded as content arrives and clustering runs after.
 */
export type LatticeVersion = {
  readonly version: number;
  readonly embeddingModel: string;
  readonly embeddingBinding: string;
  readonly dimensions: number;
  readonly levelCount: number;
  readonly nodeCount: number;
  readonly nodesByLevel: readonly number[];
  readonly staleCount: number;
  readonly state: LatticeState;
  readonly error?: string;
  readonly rebuildReason?: RebuildReason;
  readonly updatedAt: number;
};
