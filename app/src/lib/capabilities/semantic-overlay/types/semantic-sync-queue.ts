import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticSyncJobState } from "$representation/data/types/semantic/sync";
import type { SyncSemanticResourceResult } from "$capabilities/semantic-overlay/types/sync-semantic-resource";
import type { ProcessSemanticMaterialQueueResult } from "$capabilities/semantic-overlay/types/material-sync";

export type { SemanticSyncJobState };

export type ProcessSemanticSyncQueueInput = {
  readonly limit?: number;
  readonly ref?: ResourceRef;
};

export type ProcessedSemanticSyncJob = {
  readonly jobId: Id<"semanticSyncJobs">;
  readonly ref: ResourceRef;
  readonly result?: SyncSemanticResourceResult;
  readonly error?: string;
  readonly retrying?: string;
};

export type ProcessSemanticSyncQueueResult = {
  readonly processed: readonly ProcessedSemanticSyncJob[];
  readonly remaining: number;
  readonly failed: readonly ProcessedSemanticSyncJob[];
  readonly materials: ProcessSemanticMaterialQueueResult;
};

export type BackfillSemanticOverlayInput = {
  readonly force?: boolean;
  readonly limit?: number;
};

export type BackfillSemanticOverlayResult = {
  readonly discovered: number;
  readonly queued: number;
  readonly materialQueued: number;
  readonly queue: ProcessSemanticSyncQueueResult;
};
