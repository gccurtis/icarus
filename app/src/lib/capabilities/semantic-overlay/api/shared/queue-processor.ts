import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";
import type {
  ProcessSemanticSyncQueueResult,
  ProcessedSemanticSyncJob
} from "$capabilities/semantic-overlay/types/semantic-sync-queue";
import { processSemanticMaterialQueueFor } from "$capabilities/semantic-overlay/api/shared/material-queue-processor";

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Semantic resource sync failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

/** The worker seam; one caller claims and processes a bounded batch in order. */
export const processSemanticSyncQueueFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  limit: number,
  ref?: { kind: string; id: string }
): Promise<ProcessSemanticSyncQueueResult> => {
  const claimed = rowsOf(model.store, "semanticSyncJobs")
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.state === "queued" &&
        (ref === undefined || sameResourceRef(row.ref, ref))
    )
    .sort(
      (left, right) =>
        left.queuedAt - right.queuedAt || left._creationTime - right._creationTime
    )
    .slice(0, limit);
  const processed: ProcessedSemanticSyncJob[] = [];

  for (const job of claimed) {
    const startedAt = Date.now();
    model.store.update(`semanticSyncJobs.${job._id}.state`, "running");
    model.store.update(`semanticSyncJobs.${job._id}.startedAt`, startedAt);
    model.store.update(`semanticSyncJobs.${job._id}.attempts`, job.attempts + 1);
    model.store.update(`semanticSyncJobs.${job._id}.updatedAt`, startedAt);
    try {
      const result = await syncSemanticResourceFor(model, projectId, job.ref, job.force === true);
      const current = rowsOf(model.store, "semanticSyncJobs").find(
        (row) => row._id === job._id && row.projectId === projectId
      );
      if (current !== undefined) {
        const completedRevision = result.outcome === "missing" ? current.requestedRevision : result.revision;
        if (
          result.outcome === "superseded" ||
          current.requestedRevision > completedRevision
        ) {
          model.store.update(`semanticSyncJobs.${job._id}.state`, "queued");
          model.store.update(`semanticSyncJobs.${job._id}.queuedAt`, Date.now());
          model.store.update(`semanticSyncJobs.${job._id}.updatedAt`, Date.now());
        } else {
          model.store.removeRows("semanticSyncJobs", [job._id]);
        }
      }
      processed.push({ jobId: job._id, ref: job.ref, result });
    } catch (error) {
      const message = safeFailure(error);
      const current = rowsOf(model.store, "semanticSyncJobs").find(
        (row) => row._id === job._id && row.projectId === projectId
      );
      if (current !== undefined) {
        model.store.update(`semanticSyncJobs.${job._id}.state`, "failed");
        model.store.update(`semanticSyncJobs.${job._id}.error`, message);
        model.store.update(`semanticSyncJobs.${job._id}.updatedAt`, Date.now());
      }
      processed.push({ jobId: job._id, ref: job.ref, error: message });
    }
  }

  const remaining = rowsOf(model.store, "semanticSyncJobs").filter(
    (row) => row.projectId === projectId && row.state === "queued"
  ).length;
  const materials = await processSemanticMaterialQueueFor(model, projectId, limit, ref);
  model.observability.logger.info("semanticOverlay.syncQueueProcessed", {
    projectId,
    claimed: claimed.length,
    succeeded: processed.filter((entry) => entry.result !== undefined).length,
    failed: processed.filter((entry) => entry.error !== undefined).length,
    remaining
  });
  return { processed, remaining, materials };
};
