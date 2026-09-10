import type { Id, Row } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  DerivedOutput as SemanticDerivedOutput,
  DerivedOutputFields as SemanticDerivedOutputFields,
  DerivedOutputRefreshJobFields as SemanticDerivedOutputRefreshJobFields
} from "$representation/data/types/semantic/derived-output";
import type {
  RecursiveIndexConfiguration,
  SemanticIndexChildren,
  SemanticIndexLane
} from "$representation/data/types/semantic/index";
import type {
  ContextualMaterialFacetKind,
  IntrinsicMaterialFacetKind,
  SemanticMaterialFields as SemanticMaterialFieldsData,
  SemanticMaterialHistoryFields as SemanticMaterialHistoryFieldsData,
  SemanticMaterialJobFields as SemanticMaterialJobFieldsData,
  SemanticMaterialPlacementFields as SemanticMaterialPlacementFieldsData
} from "$representation/data/types/semantic/material";
import type {
  EmbeddingSpace,
  SemanticObjectSnapshot,
  SemanticSpan
} from "$representation/data/types/semantic/overlay";
import type {
  SemanticEncoding,
  SemanticLocatorSpan
} from "$representation/data/types/semantic/source";
import type { SemanticSyncJobFields as SemanticSyncJobFieldsData } from "$representation/data/types/semantic/sync";

export type SemanticOverlayFields = {
  projectId: Id<"projects">;
  generation: number;
  embedding: EmbeddingSpace;
  updatedAt: number;
};
export type SemanticOverlay = Row<"semanticOverlays"> & SemanticOverlayFields;

export type SemanticSourceFields = {
  projectId: Id<"projects">;
  ref: ResourceRef;
  revision: number;
  contentHash?: string;
  encoding: SemanticEncoding;
  locators?: SemanticLocatorSpan[];
  hardBoundaries?: number[];
  updatedAt: number;
};
export type SemanticSource = Row<"semanticSources"> & SemanticSourceFields;

export type SemanticSyncJobFields = SemanticSyncJobFieldsData;
export type SemanticSyncJob = Row<"semanticSyncJobs"> & SemanticSyncJobFields;

export type SemanticObjectFields = {
  projectId: Id<"projects">;
  vector: number[];
} & (
  | {
      lane: "text";
      semanticSourceId: Id<"semanticSources">;
      span: SemanticSpan;
    }
  | {
      lane: "material";
      semanticMaterialId: Id<"semanticMaterials">;
      facetText?: string;
      inputHash: string;
    } & (
      | { facet: ContextualMaterialFacetKind; scopeRefs: ResourceRef[] }
      | { facet: IntrinsicMaterialFacetKind; scopeRefs?: never }
    )
);
export type SemanticObject = Row<"semanticObjects"> & SemanticObjectFields;

export type SemanticObjectHistoryFields = {
  projectId: Id<"projects">;
  retiredGeneration: number;
  object: SemanticObjectSnapshot;
  retiredAt: number;
};
export type SemanticObjectHistory = Row<"semanticObjectHistory"> & SemanticObjectHistoryFields;

export type SemanticIndexFields = {
  projectId: Id<"projects">;
  semanticOverlayId: Id<"semanticOverlays">;
  method: "recursiveClustering";
  lane: SemanticIndexLane;
  rootNodeIds: Id<"semanticIndexNodes">[];
  configuration: RecursiveIndexConfiguration;
  updatedAt: number;
};
export type SemanticIndex = Row<"semanticIndexes"> & SemanticIndexFields;

export type SemanticIndexNodeFields = {
  projectId: Id<"projects">;
  indexId: Id<"semanticIndexes">;
  parentNodeId?: Id<"semanticIndexNodes">;
  centroidVector: number[];
  children: SemanticIndexChildren;
};
export type SemanticIndexNode = Row<"semanticIndexNodes"> & SemanticIndexNodeFields;

export type SemanticMaterialFields = SemanticMaterialFieldsData;
export type SemanticMaterialHistoryFields = SemanticMaterialHistoryFieldsData;
export type SemanticMaterialJobFields = SemanticMaterialJobFieldsData;
export type SemanticMaterialPlacementFields = SemanticMaterialPlacementFieldsData;

export type SemanticMaterial = Row<"semanticMaterials"> & SemanticMaterialFields;
export type SemanticMaterialPlacement = Row<"semanticMaterialPlacements"> &
  SemanticMaterialPlacementFields;
export type SemanticMaterialJob = Row<"semanticMaterialJobs"> & SemanticMaterialJobFields;
export type SemanticMaterialHistory = Row<"semanticMaterialHistory"> &
  SemanticMaterialHistoryFields;

export type DerivedOutputFields = SemanticDerivedOutputFields;
export type DerivedOutput = SemanticDerivedOutput;
export type DerivedOutputRefreshJobFields = SemanticDerivedOutputRefreshJobFields;
export type DerivedOutputRefreshJob = Row<"derivedOutputRefreshJobs"> &
  DerivedOutputRefreshJobFields;
