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
  readonly run: (
    job: DurableSemanticJob,
    assertClaim: (unit: StoreUnitOfWork) => void
  ) => Promise<Result>;
};

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
const HEARTBEAT_MS = Math.floor(LEASE_MS / 3);

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

const claimOne = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  attempted: ReadonlySet<string>
): DurableSemanticJob | undefined => input.model.store.transaction((unit) => {
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
    .filter((job) => !attempted.has(job._id))
    .sort(
      (left, right) =>
        left.queuedAt - right.queuedAt || left._creationTime - right._creationTime
    )
    .slice(0, 1);

  const job = candidates[0];
  if (job === undefined) return undefined;
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

const claimIn = (
  store: StoreUnitOfWork,
  table: SemanticJobTable,
  projectId: Id<"projects">,
  claimed: DurableSemanticJob
): DurableSemanticJob | undefined =>
  (rowsOf(store, table) as unknown as readonly DurableSemanticJob[]).find(
    (job) =>
      job._id === claimed._id &&
      job.projectId === projectId &&
      job.state === "running" &&
      job.claimId === claimed.claimId
  );

const renewClaim = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob
): boolean => input.model.store.transaction((unit) => {
  const current = claimIn(unit, input.table, input.projectId, claimed);
  const now = Date.now();
  if (
    current === undefined ||
    current.leaseExpiresAt === undefined ||
    current.leaseExpiresAt <= now
  ) return false;
  unit.update(`${input.table}.${current._id}.leaseExpiresAt`, now + LEASE_MS);
  unit.update(`${input.table}.${current._id}.updatedAt`, now);
  return true;
});

const claimAssertion = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  heartbeatFailure: { error?: unknown }
): ((unit: StoreUnitOfWork) => void) => (unit) => {
  if (heartbeatFailure.error !== undefined) throw heartbeatFailure.error;
  const current = claimIn(unit, input.table, input.projectId, claimed);
  if (
    current === undefined ||
    current.leaseExpiresAt === undefined ||
    current.leaseExpiresAt <= Date.now()
  ) throw new Error("Semantic synchronization lost its durable claim");
};

const requeueIn = (
  unit: StoreUnitOfWork,
  table: SemanticJobTable,
  current: DurableSemanticJob,
  resetAttempts: boolean,
  error?: string
): void => {
  const now = Date.now();
  unit.update(`${table}.${current._id}.state`, "queued");
  unit.update(`${table}.${current._id}.queuedAt`, now);
  unit.update(`${table}.${current._id}.attempts`, resetAttempts ? 0 : current.attempts);
  if (error === undefined) unit.removeFieldFromRows(table, [current._id as never], "error");
  else unit.update(`${table}.${current._id}.error`, error);
  unit.update(`${table}.${current._id}.updatedAt`, now);
  clearClaim(unit, table, current._id);
};

const complete = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  result: Result,
  assertClaim: (unit: StoreUnitOfWork) => void
): void => input.model.store.transaction((unit) => {
  assertClaim(unit);
  const current = claimIn(unit, input.table, input.projectId, claimed);
  if (current === undefined) throw new Error("Semantic synchronization lost its durable claim");
  const completedRevision = result.revision ?? claimed.requestedRevision;
  if (result.outcome === "superseded" || current.requestedRevision > completedRevision) {
    requeueIn(unit, input.table, current, true);
    return;
  }
  unit.remove(`${input.table}.${current._id}`);
});

const fail = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  claimed: DurableSemanticJob,
  error: string
): "lost" | "retrying" | "failed" => input.model.store.transaction((unit) => {
  const current = claimIn(unit, input.table, input.projectId, claimed);
  if (current === undefined) return "lost";
  if (current.requestedRevision > claimed.requestedRevision) {
    requeueIn(unit, input.table, current, true);
    return "retrying";
  }
  if (current.attempts < MAX_ATTEMPTS) {
    requeueIn(unit, input.table, current, false, error);
    return "retrying";
  }
  const now = Date.now();
  unit.update(`${input.table}.${current._id}.state`, "failed");
  unit.update(`${input.table}.${current._id}.error`, error);
  unit.update(`${input.table}.${current._id}.updatedAt`, now);
  clearClaim(unit, input.table, current._id);
  return "failed";
});

/** Atomically claims, runs, and settles one bounded semantic queue batch. */
export const processDurableSemanticQueue = async <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>
): Promise<DurableSemanticQueueResult<Result>> => {
  const processed: DurableSemanticProcessed<Result>[] = [];
  const attempted = new Set<string>();
  for (let count = 0; count < input.limit; count += 1) {
    const job = claimOne(input, attempted);
    if (job === undefined) break;
    attempted.add(job._id);
    const heartbeatFailure: { error?: unknown } = {};
    const assertClaim = claimAssertion(input, job, heartbeatFailure);
    const heartbeat = setInterval(() => {
      try {
        if (!renewClaim(input, job)) {
          heartbeatFailure.error = new Error("Semantic synchronization lost its durable claim");
        }
      } catch (error) {
        heartbeatFailure.error = error;
      }
    }, HEARTBEAT_MS);
    try {
      const result = await input.run(job, assertClaim);
      complete(input, job, result, assertClaim);
      processed.push({ jobId: job._id, ref: job.ref, result });
    } catch (error) {
      const message = safeFailure(error);
      const outcome = fail(input, job, message);
      processed.push({
        jobId: job._id,
        ref: job.ref,
        ...(outcome === "failed" ? { error: message } : { retrying: message })
      });
    } finally {
      clearInterval(heartbeat);
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
