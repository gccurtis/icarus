import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

export type SyncSemanticMaterialsResult = {
  outcome: "missing" | "current" | "published" | "superseded";
  ref: ResourceRef;
  revision?: number;
  overlayGeneration?: number;
  materialCount?: number;
  facetCount?: number;
  index?: RebuildSemanticIndexResult;
  usage?: ProviderUsage[];
};

export type ProcessedSemanticMaterialJob = {
  jobId: Id<"semanticMaterialJobs">;
  ref: ResourceRef;
  result?: SyncSemanticMaterialsResult;
  error?: string;
};

export type ProcessSemanticMaterialQueueResult = {
  processed: ProcessedSemanticMaterialJob[];
  remaining: number;
};
