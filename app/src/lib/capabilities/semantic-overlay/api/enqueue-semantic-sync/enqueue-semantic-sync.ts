import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { readSemanticSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
import { validateEnqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/validate-enqueue-semantic-sync";
import type { EnqueueSemanticSyncResult } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";
import { enqueueMaterialSyncFor } from "$capabilities/semantic-overlay/api/shared/material-queue";
import { readMaterialSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";

/** Captures the authoritative leader revision; callers provide only a scoped resource ref. */
export const enqueueSemanticSync = async (
  input: unknown
): Promise<EnqueueSemanticSyncResult> => {
  const scope = await requireScope();
  const asked = validateEnqueueSemanticSync(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  if (isStagedResource(model.store, projectId, asked.ref)) return null;
  const textTarget = readSemanticSyncTargetFor(model.store, projectId, asked.ref);
  const materialTarget = readMaterialSyncTargetFor(model, projectId, asked.ref);
  const revision = textTarget?.revision ?? materialTarget?.revision;
  if (revision === undefined || materialTarget === undefined) return null;
  const ref = textTarget?.ref ?? materialTarget?.ref ?? asked.ref;
  const queued = model.store.transaction((unit) => {
    const atomic = semanticUnitModel(model, unit);
    return {
      ...(textTarget === undefined
        ? {}
        : { jobId: enqueueSemanticSyncFor(atomic, projectId, textTarget.ref, textTarget.revision) }),
      materialJobId: enqueueMaterialSyncFor(
        atomic,
        projectId,
        materialTarget.ref,
        materialTarget.revision
      )
    };
  });
  return {
    ...queued,
    ref,
    revision
  };
};
