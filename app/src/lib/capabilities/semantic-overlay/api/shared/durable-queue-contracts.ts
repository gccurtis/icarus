import type { ServerModel } from "$runtime/server/start.server";
import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type SemanticJobTable = "semanticSyncJobs" | "semanticMaterialJobs";

export type DurableSemanticJob =
  | TableRow<"semanticSyncJobs">
  | TableRow<"semanticMaterialJobs">;

export type RunningSemanticJob = Extract<DurableSemanticJob, { state: "running" }>;
export type FailedSemanticJob = Extract<DurableSemanticJob, { state: "failed" }>;

export type SemanticWorkerResult = {
  readonly outcome: "missing" | "current" | "published" | "superseded";
  readonly revision?: number;
};

export type DurableSemanticProcessed<Result extends SemanticWorkerResult> = {
  readonly jobId: string;
  readonly ref: ResourceRef;
  readonly result?: Result;
  readonly error?: string;
  readonly retrying?: string;
};

export type DurableSemanticQueueResult<Result extends SemanticWorkerResult> = {
  readonly processed: DurableSemanticProcessed<Result>[];
  readonly remaining: number;
  readonly failed: DurableSemanticProcessed<Result>[];
};

export type ProcessQueueInput<Result extends SemanticWorkerResult> = {
  readonly model: ServerModel;
  readonly table: SemanticJobTable;
  readonly projectId: Id<"projects">;
  readonly limit: number;
  readonly ref?: ResourceRef;
  readonly signal?: AbortSignal;
  readonly run: (
    job: DurableSemanticJob,
    assertClaim: (unit: StoreUnitOfWork) => void
  ) => Promise<Result>;
};
