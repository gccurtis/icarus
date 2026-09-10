import type {
  DurableSemanticJob,
  DurableSemanticProcessed,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";
import { openDurableClaimLease } from "$capabilities/semantic-overlay/api/shared/durable-queue-claim-lease";
import { settleDurableSemanticJob } from "$capabilities/semantic-overlay/api/shared/durable-queue-settlement";
import { safeSemanticFailure } from "$capabilities/semantic-overlay/api/shared/safe-failure";

export const processClaimedSemanticJob = async <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>,
  job: DurableSemanticJob
): Promise<DurableSemanticProcessed<Result>> => {
  const lease = openDurableClaimLease(input, job);
  try {
    const result = await input.run(job, lease.assertClaim);
    input.signal?.throwIfAborted();
    settleDurableSemanticJob(input, job, {
      state: "completed",
      result,
      assertClaim: lease.assertClaim
    });
    return { jobId: job._id, ref: job.ref, result };
  } catch (error) {
    if (input.signal?.aborted === true) {
      settleDurableSemanticJob(input, job, { state: "interrupted" });
      throw input.signal.reason instanceof Error
        ? input.signal.reason
        : new Error("Semantic synchronization was interrupted", {
            cause: input.signal.reason
          });
    }
    const message = safeSemanticFailure(error);
    const outcome = settleDurableSemanticJob(input, job, {
      state: "failed",
      error: message
    });
    return {
      jobId: job._id,
      ref: job.ref,
      ...(outcome === "failed" ? { error: message } : { retrying: message })
    };
  } finally {
    lease.close();
  }
};
