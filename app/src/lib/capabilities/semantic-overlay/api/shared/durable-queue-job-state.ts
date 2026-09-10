import type { ServerModel } from "$runtime/server/start.server";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SemanticSyncJobFields } from "$representation/data/types/semantic/sync";

import type {
  DurableSemanticJob,
  ProcessQueueInput,
  RunningSemanticJob,
  SemanticJobTable,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

export const jobsIn = (
  model: ServerModel,
  table: SemanticJobTable
): readonly DurableSemanticJob[] =>
  rowsOf(model.store, table) as unknown as readonly DurableSemanticJob[];

export const commonJobFields = (job: DurableSemanticJob): Omit<
  SemanticSyncJobFields,
  "state" | "error" | "startedAt" | "claimId" | "leaseExpiresAt"
> => ({
  projectId: job.projectId,
  ref: job.ref,
  requestedRevision: job.requestedRevision,
  ...(job.force === undefined ? {} : { force: job.force }),
  attempts: job.attempts,
  queuedAt: job.queuedAt,
  updatedAt: job.updatedAt
});

export const replaceJob = (
  unit: StoreUnitOfWork,
  table: SemanticJobTable,
  job: DurableSemanticJob,
  fields: SemanticSyncJobFields
): void => unit.update(`${table}.${job._id}`, fields);

export const claimedJobIn = (
  store: StoreUnitOfWork,
  table: SemanticJobTable,
  projectId: Id<"projects">,
  claimed: DurableSemanticJob
): RunningSemanticJob | undefined =>
  (rowsOf(store, table) as unknown as readonly DurableSemanticJob[]).find(
    (job): job is RunningSemanticJob =>
      job._id === claimed._id &&
      job.projectId === projectId &&
      job.state === "running" &&
      job.claimId === claimed.claimId
  );

export const requeueJobIn = (
  unit: StoreUnitOfWork,
  table: SemanticJobTable,
  current: DurableSemanticJob,
  resetAttempts: boolean
): void => {
  const now = Date.now();
  replaceJob(unit, table, current, {
    ...commonJobFields(current),
    state: "queued",
    attempts: resetAttempts ? 0 : current.attempts,
    queuedAt: now,
    updatedAt: now
  });
};

export const isJobInRequestedScope = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  job: DurableSemanticJob
): boolean =>
  job.projectId === input.projectId &&
  (input.ref === undefined || sameResourceRef(job.ref, input.ref));
