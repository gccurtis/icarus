import type { SemanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticMaterialJobFields } from "$representation/data/types/semantic/material";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

/** Coalesces one resource's material inventory work to its newest revision. */
export const enqueueMaterialSyncFor = (
  model: SemanticUnitModel,
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

  const revisionAdvanced = requestedRevision > existing.requestedRevision;
  if (existing.state === "failed" && !revisionAdvanced && !force) return existing._id;
  const common = {
    projectId: existing.projectId,
    ref: existing.ref,
    requestedRevision: revisionAdvanced ? requestedRevision : existing.requestedRevision,
    ...(force || existing.force === true ? { force: true as const } : {}),
    attempts: existing.attempts,
    queuedAt: existing.queuedAt,
    updatedAt: at
  };
  let fields: SemanticMaterialJobFields;
  if (existing.state === "failed") {
    fields = { ...common, state: "queued", attempts: 0, queuedAt: at };
  } else if (existing.state === "running") {
    fields = {
      ...common,
      state: "running",
      startedAt: existing.startedAt,
      claimId: existing.claimId,
      leaseExpiresAt: existing.leaseExpiresAt
    };
  } else {
    fields = { ...common, state: "queued" };
  }
  model.store.update(`semanticMaterialJobs.${existing._id}`, fields);
  return existing._id;
};
