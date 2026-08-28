import type { Id } from "$representation/data/types/core/id";

/**
 * Which model built a project's lattice, at what width.
 *
 * Both the binding and the model it resolved to are stored, so a provider
 * quietly changing what a binding means is detectable. Every vector in a project
 * must come from one model — a distance between vectors from two is meaningless.
 */
export type LatticeBinding = {
  embeddingModel: string;
  embeddingBinding: string;
  dimensions: number;
  /** A stored basis is fitted at one width. */
  pcaDims: number;
};

/** One window of one source. A window node is exactly one window, so the span is two numbers. */
export type LatticeWindow = {
  sourceKind: string;
  sourceId: string;
  start: number;
  end: number;
  /** This window's text. Never the source's. */
  text: string;
};

/** A clique over the nodes below it. */
export type LatticeCluster = {
  members: Id<"latticeNodes">[];
  cohesion: number;
};

/** What set a clustering pass off. Uniform `{ kind, id }` — never per-variant names. */
export type LatticeCause = { kind: string; id: string };

/** A cluster's previous state, enough to put it back. */
export type LatticeClusterState = { id: Id<"latticeNodes"> } & LatticeCluster;

/**
 * A node that was taken out. No vector: a cluster's is the mean of its members',
 * and a removed window's cannot be rebuilt from here.
 */
export type LatticeRemoval = {
  id: Id<"latticeNodes">;
  level: number;
  sourceKind?: string;
  sourceId?: string;
  members?: Id<"latticeNodes">[];
};
