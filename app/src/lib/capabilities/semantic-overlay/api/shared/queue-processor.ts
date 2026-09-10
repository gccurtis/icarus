import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { processDurableSemanticQueue } from "$capabilities/semantic-overlay/api/shared/durable-queue";
import { processSemanticMaterialQueueFor } from "$capabilities/semantic-overlay/api/shared/material-queue-processor";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";
import type {
  ProcessSemanticSyncQueueResult,
  ProcessedSemanticSyncJob
} from "$capabilities/semantic-overlay/types/semantic-sync-queue";

/** The exact-text worker seam; every caller claims a bounded durable batch. */
export const processSemanticSyncQueueFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  limit: number,
  ref?: { kind: string; id: string }
): Promise<ProcessSemanticSyncQueueResult> => {
  const exact = await processDurableSemanticQueue({
    model,
    table: "semanticSyncJobs",
    projectId,
    limit,
    ...(ref === undefined ? {} : { ref }),
    run: async (job) =>
      await syncSemanticResourceFor(model, projectId, job.ref, job.force === true)
  });
  const adapt = (entry: (typeof exact.processed)[number]): ProcessedSemanticSyncJob => ({
    ...entry,
    jobId: entry.jobId as Id<"semanticSyncJobs">
  });
  const processed = exact.processed.map(adapt);
  const failed = exact.failed.map(adapt);
  const materials = await processSemanticMaterialQueueFor(model, projectId, limit, ref);
  model.observability.logger.info("semanticOverlay.syncQueueProcessed", {
    projectId,
    claimed: processed.length,
    succeeded: processed.filter((entry) => entry.result !== undefined).length,
    retrying: processed.filter((entry) => entry.retrying !== undefined).length,
    failed: failed.length,
    remaining: exact.remaining
  });
  return { processed, remaining: exact.remaining, failed, materials };
};
