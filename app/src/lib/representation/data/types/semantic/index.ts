import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type {
  SemanticLocatorSpan,
  SemanticSourceSnapshot
} from "$representation/data/types/semantic/source";

export type RecursiveIndexConfiguration = {
  branchFactor: number;
  leafSize: number;
  maxIterations: number;
  convergenceTolerance: number;
  candidateMultiplier: number;
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
  /** Projected resource locations intersecting this exact text span, when available. */
  locators?: SemanticLocatorSpan[];
  score: number;
  overlayGeneration: number;
};

/** The minimum stored-object information used to construct the tree. */
export type IndexableSemanticObject = {
  id: Id<"semanticObjects">;
  vector: number[];
};

/** A provider-free node keyed by its deterministic path before rows are minted. */
export type SemanticIndexNodeDraft = {
  key: string;
  parentKey?: string;
  centroidVector: number[];
  children:
    | { kind: "nodes"; keys: string[] }
    | { kind: "objects"; ids: Id<"semanticObjects">[] };
};

export type RecursiveIndexBuild = {
  rootKeys: string[];
  nodes: SemanticIndexNodeDraft[];
};

/** A hydrated active object; source values are joined at the capability seam. */
export type SearchableSemanticObject = IndexableSemanticObject & {
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
};

/** The persisted shape consumed by traversal, independent of store rows. */
export type SearchableSemanticIndexNode = {
  id: Id<"semanticIndexNodes">;
  centroidVector: number[];
  children: SemanticIndexChildren;
};

export type RecursiveQueryDiagnostics = {
  eligibleObjects: number;
  candidateTarget: number;
  visitedNodes: number;
  evaluatedObjects: number;
  exhausted: boolean;
};

export type RecursiveQueryResult = {
  hits: SemanticHit[];
  diagnostics: RecursiveQueryDiagnostics;
};

export type RecursiveQueryInput = {
  queryVector: number[];
  rootNodeIds: Id<"semanticIndexNodes">[];
  nodes: SearchableSemanticIndexNode[];
  objects: SearchableSemanticObject[];
  eligibleObjectIds?: Id<"semanticObjects">[];
  topK: number;
  configuration: RecursiveIndexConfiguration;
  overlayGeneration: number;
};
