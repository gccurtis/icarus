import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type EnqueueSemanticSyncInput = {
  readonly ref: ResourceRef;
};

export type EnqueueSemanticSyncResult = {
  readonly jobId?: Id<"semanticSyncJobs">;
  readonly materialJobId?: Id<"semanticMaterialJobs">;
  readonly ref: ResourceRef;
  readonly revision: number;
} | null;
