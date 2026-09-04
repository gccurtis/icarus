import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

export type RecursiveIndexConfiguration = {
  branchFactor: number;
  leafSize: number;
};

/** A node is either an internal branch or a leaf; it cannot be both. */
export type SemanticIndexChildren =
  | { kind: "nodes"; ids: Id<"semanticIndexNodes">[] }
  | { kind: "objects"; ids: Id<"semanticObjects">[] };

export type SemanticQueryInput = {
  text: string;
  scope?: ResourceSet;
  topK: number;
};

/** A retrieval value; several IDs indicate that overlapping objects were coalesced. */
export type SemanticHit = {
  semanticObjectIds: Id<"semanticObjects">[];
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  score: number;
  overlayGeneration: number;
};
