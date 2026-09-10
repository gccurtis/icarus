import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { processDurableSemanticQueue } from "$capabilities/semantic-overlay/api/shared/durable-queue";
import { syncSemanticMaterialsFor } from "$capabilities/semantic-overlay/api/shared/material-sync";
import type {
  ProcessedSemanticMaterialJob,
  ProcessSemanticMaterialQueueResult
} from "$capabilities/semantic-overlay/types/material-sync";

/** The material worker seam; it shares the exact lane's claim and lease protocol. */
export const processSemanticMaterialQueueFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  limit: number,
  ref?: ResourceRef,
  signal?: AbortSignal
): Promise<ProcessSemanticMaterialQueueResult> => {
  signal?.throwIfAborted();
  const material = await processDurableSemanticQueue({
    model,
    table: "semanticMaterialJobs",
    projectId,
    limit,
    ...(ref === undefined ? {} : { ref }),
    ...(signal === undefined ? {} : { signal }),
    run: async (job, assertClaim) =>
      await syncSemanticMaterialsFor(
        model,
        projectId,
        job.ref,
        job.force === true,
        assertClaim,
        signal
      )
  });
  signal?.throwIfAborted();
  const adapt = (entry: (typeof material.processed)[number]): ProcessedSemanticMaterialJob => ({
    ...entry,
    jobId: entry.jobId as Id<"semanticMaterialJobs">
  });
  return {
    processed: material.processed.map(adapt),
    remaining: material.remaining,
    failed: material.failed.map(adapt)
  };
};
