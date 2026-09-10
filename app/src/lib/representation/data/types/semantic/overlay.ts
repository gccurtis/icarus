import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  ContextualMaterialFacetKind,
  IntrinsicMaterialFacetKind
} from "$representation/data/types/semantic/material";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

/** The one vector space shared by every active object in a project overlay. */
export type EmbeddingSpace = {
  provider: "jina";
  model: string;
  dimensions: number;
};

/** A half-open source interval interpreted in its source's declared encoding. */
export type SemanticSpan = {
  from: number;
  to: number;
  text: string;
};

/** The value retained when an active semantic object is retired. */
export type SemanticTextObjectSnapshot = {
  lane: "text";
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  vector: number[];
};

type SemanticMaterialObjectSnapshotBase = {
  lane: "material";
  semanticMaterialId: Id<"semanticMaterials">;
  facetText?: string;
  inputHash: string;
  vector: number[];
};

export type SemanticMaterialObjectSnapshot = SemanticMaterialObjectSnapshotBase & (
  | { facet: ContextualMaterialFacetKind; scopeRefs: ResourceRef[] }
  | { facet: IntrinsicMaterialFacetKind; scopeRefs?: never }
);

export type SemanticObjectSnapshot =
  | SemanticTextObjectSnapshot
  | SemanticMaterialObjectSnapshot;
