import type { ServerModel } from "$runtime/server/start.server";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

type SemanticJobTable = "semanticSyncJobs" | "semanticMaterialJobs";

type DurableSemanticJob = {
  readonly _id: string;
  readonly _creationTime: number;
  readonly projectId: Id<"projects">;
  readonly ref: ResourceRef;
  readonly requestedRevision: number;
  readonly force?: boolean;
  readonly state: "queued" | "running" | "failed";
  readonly attempts: number;
  readonly error?: string;
  readonly queuedAt: number;
  readonly startedAt?: number;
  readonly claimId?: string;
  readonly leaseExpiresAt?: number;
  readonly updatedAt: number;
};

type SemanticWorkerResult = {
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

type ProcessQueueInput<Result extends SemanticWorkerResult> = {
  readonly model: ServerModel;
  readonly table: SemanticJobTable;
  readonly projectId: Id<"projects">;
  readonly limit: number;
  readonly ref?: ResourceRef;
  readonly run: (job: DurableSemanticJob) => Promise<Result>;
};

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Semantic synchronization failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const jobsIn = (
  model: ServerModel,
  table: SemanticJobTable
): readonly DurableSemanticJob[] =>
  rowsOf(model.store, table) as unknown as readonly DurableSemanticJob[];

const clearClaim = (unit: StoreUnitOfWork, table: SemanticJobTable, jobId: string): void => {
  unit.removeFieldFromRows(table, [jobId as never], "claimId");
  unit.removeFieldFromRows(table, [jobId as never], "leaseExpiresAt");
  unit.removeFieldFromRows(table, [jobId as never], "startedAt");
};

const claimBatch = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>
): DurableSemanticJob[] => input.model.store.transaction((unit) => {
  const now = Date.now();
  const rows = rowsOf(unit, input.table) as unknown as readonly DurableSemanticJob[];
  const eligible = (job: DurableSemanticJob): boolean =>
    job.projectId === input.projectId &&
    (input.ref === undefined || sameResourceRef(job.ref, input.ref)) &&
    (job.state === "queued" ||
      (job.state === "running" &&
        job.leaseExpiresAt !== undefined &&
        job.leaseExpiresAt <= now));

  for (const job of rows.filter(eligible).filter((candidate) => candidate.attempts >= MAX_ATTEMPTS)) {
    unit.update(`${input.table}.${job._id}.state`, "failed");
    unit.update(`${input.table}.${job._id}.error`, "Semantic synchronization exhausted its retry budget");
    unit.update(`${input.table}.${job._id}.updatedAt`, now);
    clearClaim(unit, input.table, job._id);
  }

  const candidates = (rowsOf(unit, input.table) as unknown as readonly DurableSemanticJob[])
    .filter(eligible)
    .filter((job) => job.attempts < MAX_ATTEMPTS)
    .sort(
      (left, right) =>
        left.queuedAt - right.queuedAt || left._creationTime - right._creationTime
    )
    .slice(0, input.limit);

  return candidates.map((job) => {
    const claimId = crypto.randomUUID();
    const attempts = job.attempts + 1;
    const leaseExpiresAt = now + LEASE_MS;
    unit.update(`${input.table}.${job._id}.state`, "running");
    unit.update(`${input.table}.${job._id}.attempts`, attempts);
    unit.update(`${input.table}.${job._id}.claimId`, claimId);
    unit.update(`${input.table}.${job._id}.startedAt`, now);
    unit.update(`${input.table}.${job._id}.leaseExpiresAt`, leaseExpiresAt);
    unit.update(`${input.table}.${job._id}.updatedAt`, now);
    return { ...job, state: "running", attempts, claimId, startedAt: now, leaseExpiresAt, updatedAt: now };
  });
});

const currentClaim = (
  model: ServerModel,
  table: SemanticJobTable,
  projectId: Id<"projects">,
  claimed: DurableSemanticJob
): DurableSemanticJob | undefined =>
  jobsIn(model, table).find(
    (job) =>
      job._id === claimed._id &&
      job.projectId === projectId &&
      job.claimId === claimed.claimId
  );

const requeue = (
  model: ServerModel,
  table: SemanticJobTable,
  current: DurableSemanticJob,
  resetAttempts: boolean,
  error?: string
): void => {
  model.store.transaction((unit) => {
    const now = Date.now();
    unit.update(`${table}.${current._id}.state`, "queued");
    unit.update(`${table}.${current._id}.queuedAt`, now);
    unit.update(`${table}.${current._id}.attempts`, resetAttempts ? 0 : current.attempts);
    if (error === undefined) unit.removeFieldFromRows(table, [current._id as never], "error");
    else unit.update(`${table}.${current._id}.error`, error);
    unit.update(`${table}.${current._id}.updatedAt`, now);
    clearClaim(unit, table, current._id);
  });
};

const complete = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  result: Result
): void => {
  const current = currentClaim(input.model, input.table, input.projectId, claimed);
  if (current === undefined) return;
  const completedRevision = result.revision ?? claimed.requestedRevision;
  if (result.outcome === "superseded" || current.requestedRevision > completedRevision) {
    requeue(input.model, input.table, current, true);
    return;
  }
  input.model.store.transaction((unit) => unit.remove(`${input.table}.${current._id}`));
};

const fail = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  error: string
): "lost" | "retrying" | "failed" => {
  const current = currentClaim(input.model, input.table, input.projectId, claimed);
  if (current === undefined) return "lost";
  if (current.requestedRevision > claimed.requestedRevision) {
    requeue(input.model, input.table, current, true);
    return "retrying";
  }
  if (current.attempts < MAX_ATTEMPTS) {
    requeue(input.model, input.table, current, false, error);
    return "retrying";
  }
  input.model.store.transaction((unit) => {
    const now = Date.now();
    unit.update(`${input.table}.${current._id}.state`, "failed");
    unit.update(`${input.table}.${current._id}.error`, error);
    unit.update(`${input.table}.${current._id}.updatedAt`, now);
    clearClaim(unit, input.table, current._id);
  });
  return "failed";
};

/** Atomically claims, runs, and settles one bounded semantic queue batch. */
export const processDurableSemanticQueue = async <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>
): Promise<DurableSemanticQueueResult<Result>> => {
  const claimed = claimBatch(input);
  const processed: DurableSemanticProcessed<Result>[] = [];
  for (const job of claimed) {
    try {
      const result = await input.run(job);
      complete(input, job, result);
      processed.push({ jobId: job._id, ref: job.ref, result });
    } catch (error) {
      const message = safeFailure(error);
      const outcome = fail(input, job, message);
      processed.push({
        jobId: job._id,
        ref: job.ref,
        ...(outcome === "failed" ? { error: message } : { retrying: message })
      });
    }
  }

  const unresolved = jobsIn(input.model, input.table).filter(
    (job) => job.projectId === input.projectId && job.state !== "failed"
  );
  const failed = jobsIn(input.model, input.table)
    .filter((job) => job.projectId === input.projectId && job.state === "failed")
    .map((job) => ({ jobId: job._id, ref: job.ref, error: job.error ?? "Semantic synchronization failed" }));
  return { processed, remaining: unresolved.length, failed };
};
