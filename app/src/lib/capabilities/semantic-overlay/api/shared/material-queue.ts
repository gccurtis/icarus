import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

/** Coalesces one resource's material inventory work to its newest revision. */
export const enqueueMaterialSyncFor = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  requestedRevision: number,
  force = false
): Id<"semanticMaterialJobs"> => {
  if (!Number.isInteger(requestedRevision) || requestedRevision < 0) {
    throw new Error("A semantic material revision must be a non-negative integer");
  }
  const at = Date.now();
  const existing = rowsOf(model.store, "semanticMaterialJobs")
    .filter((row) => row.projectId === projectId && sameResourceRef(row.ref, ref))
    .sort((left, right) => right.requestedRevision - left.requestedRevision)[0];
  if (existing === undefined) return model.store.create("semanticMaterialJobs", {
    projectId,
    ref,
    requestedRevision,
    ...(force ? { force: true } : {}),
    state: "queued",
    attempts: 0,
    queuedAt: at,
    updatedAt: at
  });
  if (requestedRevision > existing.requestedRevision) {
    model.store.update(`semanticMaterialJobs.${existing._id}.requestedRevision`, requestedRevision);
  }
  if (force && existing.force !== true) model.store.update(`semanticMaterialJobs.${existing._id}.force`, true);
  if (existing.state === "failed") {
    model.store.update(`semanticMaterialJobs.${existing._id}.state`, "queued");
    model.store.removeFieldFromRows("semanticMaterialJobs", [existing._id], "error");
    model.store.update(`semanticMaterialJobs.${existing._id}.queuedAt`, at);
  }
  model.store.update(`semanticMaterialJobs.${existing._id}.updatedAt`, at);
  return existing._id;
};
