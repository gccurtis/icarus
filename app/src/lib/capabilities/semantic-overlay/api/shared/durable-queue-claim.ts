import type {
  DurableSemanticJob,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import {
  commonJobFields,
  isJobInRequestedScope,
  replaceJob
} from "$capabilities/semantic-overlay/api/shared/durable-queue-job-state";
import { LEASE_MS, MAX_ATTEMPTS } from "$capabilities/semantic-overlay/api/shared/durable-queue-policy";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

const eligibleAt = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  job: DurableSemanticJob,
  now: number
): boolean =>
  isJobInRequestedScope(input, job) &&
  (job.state === "queued" ||
    (job.state === "running" && job.leaseExpiresAt <= now));

export const claimDurableSemanticJob = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  attempted: ReadonlySet<string>
): DurableSemanticJob | undefined => input.model.store.transaction((unit) => {
  const now = Date.now();
  const jobs = (): readonly DurableSemanticJob[] =>
    rowsOf(unit, input.table) as unknown as readonly DurableSemanticJob[];

  for (const job of jobs()
    .filter((candidate) => eligibleAt(input, candidate, now))
    .filter((candidate) => candidate.attempts >= MAX_ATTEMPTS)) {
    replaceJob(unit, input.table, job, {
      ...commonJobFields(job),
      state: "failed",
      error: "Semantic synchronization exhausted its retry budget",
      updatedAt: now
    });
  }

  const job = jobs()
    .filter((candidate) => eligibleAt(input, candidate, now))
    .filter((candidate) => candidate.attempts < MAX_ATTEMPTS)
    .filter((candidate) => !attempted.has(candidate._id))
    .sort(
      (left, right) =>
        left.queuedAt - right.queuedAt || left._creationTime - right._creationTime
    )[0];
  if (job === undefined) return undefined;

  const claimId = crypto.randomUUID();
  replaceJob(unit, input.table, job, {
    ...commonJobFields(job),
    state: "running",
    attempts: job.attempts + 1,
    claimId,
    startedAt: now,
    leaseExpiresAt: now + LEASE_MS,
    updatedAt: now
  });
  const claimed = jobs().find(
    (candidate) => candidate._id === job._id &&
      candidate.state === "running" && candidate.claimId === claimId
  );
  if (claimed === undefined) {
    throw new Error("Semantic synchronization claim was not readable");
  }
  return claimed;
});
