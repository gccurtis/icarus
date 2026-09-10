import type { SemanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

/**
 * Coalesces resource revisions into one durable row. A running worker notices a
 * newer requestedRevision and returns the row to queued instead of deleting it.
 */
export const enqueueSemanticSyncFor = (
  model: SemanticUnitModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  requestedRevision: number,
  force = false
): Id<"semanticSyncJobs"> => {
  if (!Number.isInteger(requestedRevision) || requestedRevision < 0) {
    throw new Error("A semantic sync revision must be a non-negative integer");
  }
  const at = Date.now();
  const existing = rowsOf(model.store, "semanticSyncJobs")
    .filter((row) => row.projectId === projectId && sameResourceRef(row.ref, ref))
    .sort((left, right) => right.requestedRevision - left.requestedRevision)[0];
  if (existing === undefined) {
    return model.store.create("semanticSyncJobs", {
      projectId,
      ref,
      requestedRevision,
      ...(force ? { force: true } : {}),
      state: "queued",
      attempts: 0,
      queuedAt: at,
      updatedAt: at
    });
  }

  const revisionAdvanced = requestedRevision > existing.requestedRevision;
  if (existing.state === "failed" && !revisionAdvanced && !force) return existing._id;

  if (revisionAdvanced) {
    model.store.update(
      `semanticSyncJobs.${existing._id}.requestedRevision`,
      requestedRevision
    );
  }
  if (force && existing.force !== true) {
    model.store.update(`semanticSyncJobs.${existing._id}.force`, true);
  }
  if (existing.state === "failed") {
    model.store.update(`semanticSyncJobs.${existing._id}.state`, "queued");
    model.store.removeFieldFromRows("semanticSyncJobs", [existing._id], "error");
    model.store.removeFieldFromRows("semanticSyncJobs", [existing._id], "claimId");
    model.store.removeFieldFromRows("semanticSyncJobs", [existing._id], "leaseExpiresAt");
    model.store.removeFieldFromRows("semanticSyncJobs", [existing._id], "startedAt");
    model.store.update(`semanticSyncJobs.${existing._id}.attempts`, 0);
    model.store.update(`semanticSyncJobs.${existing._id}.queuedAt`, at);
  }
  model.store.update(`semanticSyncJobs.${existing._id}.updatedAt`, at);
  return existing._id;
};
