import type {
  DurableSemanticProcessed,
  DurableSemanticQueueResult,
  ProcessQueueInput,
  SemanticWorkerResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";

import { claimDurableSemanticJob } from "$capabilities/semantic-overlay/api/shared/durable-queue-claim";
import { processClaimedSemanticJob } from "$capabilities/semantic-overlay/api/shared/durable-queue-process-claim";
import { summarizeDurableSemanticQueue } from "$capabilities/semantic-overlay/api/shared/durable-queue-summary";

export type {
  DurableSemanticProcessed,
  DurableSemanticQueueResult
} from "$capabilities/semantic-overlay/api/shared/durable-queue-contracts";

/** Atomically claims, runs, and settles one bounded semantic queue batch. */
export const processDurableSemanticQueue = async <Result extends SemanticWorkerResult>(
  input: ProcessQueueInput<Result>
): Promise<DurableSemanticQueueResult<Result>> => {
  const processed: DurableSemanticProcessed<Result>[] = [];
  const attempted = new Set<string>();
  for (let count = 0; count < input.limit; count += 1) {
    input.signal?.throwIfAborted();
    const job = claimDurableSemanticJob(input, attempted);
    if (job === undefined) break;
    attempted.add(job._id);
    processed.push(await processClaimedSemanticJob(input, job));
  }

  input.signal?.throwIfAborted();
  return { processed, ...summarizeDurableSemanticQueue(input) };
};
