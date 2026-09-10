import type {
  DurableSemanticProcessed,
  FailedSemanticJob,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import {
  isJobInRequestedScope,
  jobsIn
} from "$capabilities/semantic-overlay/api/shared/durable-queue-job-state";

type DurableSemanticQueueSummary<Result extends SemanticWorkerResult> = {
  readonly remaining: number;
  readonly failed: DurableSemanticProcessed<Result>[];
};

export const summarizeDurableSemanticQueue = <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>
): DurableSemanticQueueSummary<Result> => {
  const unresolved = jobsIn(input.model, input.table).filter(
    (job) => isJobInRequestedScope(input, job) && job.state !== "failed"
  );
  const failed = jobsIn(input.model, input.table)
    .filter((job): job is FailedSemanticJob =>
      isJobInRequestedScope(input, job) && job.state === "failed"
    )
    .map((job) => ({ jobId: job._id, ref: job.ref, error: job.error }));
  return { remaining: unresolved.length, failed };
};
