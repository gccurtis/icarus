import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { syncSemanticMaterialsFor } from "$capabilities/semantic-overlay/api/shared/material-sync";
import type { ProcessSemanticMaterialQueueResult } from "$capabilities/semantic-overlay/types/material-sync";

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Semantic material sync failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

export const processSemanticMaterialQueueFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  limit: number,
  ref?: { kind: string; id: string }
): Promise<ProcessSemanticMaterialQueueResult> => {
  const claimed = rowsOf(model.store, "semanticMaterialJobs")
    .filter((row) =>
      row.projectId === projectId &&
      row.state === "queued" &&
      (ref === undefined || sameResourceRef(row.ref, ref))
    )
    .sort((left, right) => left.queuedAt - right.queuedAt || left._creationTime - right._creationTime)
    .slice(0, limit);
  const processed: ProcessSemanticMaterialQueueResult["processed"] = [];
  for (const job of claimed) {
    const startedAt = Date.now();
    model.store.update(`semanticMaterialJobs.${job._id}.state`, "running");
    model.store.update(`semanticMaterialJobs.${job._id}.startedAt`, startedAt);
    model.store.update(`semanticMaterialJobs.${job._id}.attempts`, job.attempts + 1);
    model.store.update(`semanticMaterialJobs.${job._id}.updatedAt`, startedAt);
    try {
      const result = await syncSemanticMaterialsFor(model, projectId, job.ref, job.force === true);
      const current = rowsOf(model.store, "semanticMaterialJobs").find((row) => row._id === job._id);
      if (current !== undefined) {
        const completed = result.revision ?? current.requestedRevision;
        if (result.outcome === "superseded" || current.requestedRevision > completed) {
          model.store.update(`semanticMaterialJobs.${job._id}.state`, "queued");
          model.store.update(`semanticMaterialJobs.${job._id}.queuedAt`, Date.now());
          model.store.update(`semanticMaterialJobs.${job._id}.updatedAt`, Date.now());
        } else model.store.removeRows("semanticMaterialJobs", [job._id]);
      }
      processed.push({ jobId: job._id, ref: job.ref, result });
    } catch (error) {
      const message = safeFailure(error);
      const current = rowsOf(model.store, "semanticMaterialJobs").find((row) => row._id === job._id);
      if (current !== undefined) {
        model.store.update(`semanticMaterialJobs.${job._id}.state`, "failed");
        model.store.update(`semanticMaterialJobs.${job._id}.error`, message);
        model.store.update(`semanticMaterialJobs.${job._id}.updatedAt`, Date.now());
      }
      processed.push({ jobId: job._id, ref: job.ref, error: message });
    }
  }
  return {
    processed,
    remaining: rowsOf(model.store, "semanticMaterialJobs").filter(
      (row) => row.projectId === projectId && row.state === "queued"
    ).length
  };
};
