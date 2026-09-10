import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { EnqueueSemanticSyncResult } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";

import { semanticSourceIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import { materialProjectionIsCurrentFor } from "$capabilities/semantic-overlay/api/shared/material-current";
import { enqueueMaterialSyncFor } from "$capabilities/semantic-overlay/api/shared/material-queue";
import { readMaterialSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { readSemanticSyncTargetFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";

/** Enqueue one exact project-owned resource without relying on ambient request state. */
export const enqueueSemanticSyncForModel = async (
  model: ServerModel,
  projectId: Id<"projects">,
  inputRef: ResourceRef,
  signal?: AbortSignal
): Promise<EnqueueSemanticSyncResult> => {
  const askedRef = semanticIngestibleResourceRef(inputRef);
  signal?.throwIfAborted();
  if (isStagedResource(model.store, projectId, askedRef)) return null;
  const textTarget = readSemanticSyncTargetFor(model.store, projectId, askedRef);
  const materialTarget = readMaterialSyncTargetFor(model, projectId, askedRef);
  const revision = textTarget?.revision ?? materialTarget?.revision;
  if (revision === undefined) return null;
  const ref = textTarget?.ref ?? materialTarget?.ref ?? askedRef;
  const exactCurrent =
    textTarget === undefined ||
    rowsOf(model.store, "semanticSources").some(
      (source) =>
        source.projectId === projectId &&
        source.ref.kind === textTarget.ref.kind &&
        source.ref.id === textTarget.ref.id &&
        semanticSourceIsCurrent(model.store, projectId, source)
    );
  const materialCurrent = materialTarget === undefined || await materialProjectionIsCurrentFor(
    model,
    projectId,
    materialTarget.ref,
    signal
  );
  signal?.throwIfAborted();
  if (exactCurrent && materialCurrent) return { ref, revision };
  const queued = model.store.transaction((unit) => {
    const atomic = semanticUnitModel(model, unit);
    return {
      ...(textTarget === undefined || exactCurrent
        ? {}
        : { jobId: enqueueSemanticSyncFor(atomic, projectId, textTarget.ref, textTarget.revision) }),
      ...(materialTarget === undefined || materialCurrent
        ? {}
        : {
            materialJobId: enqueueMaterialSyncFor(
              atomic,
              projectId,
              materialTarget.ref,
              materialTarget.revision
            )
          })
    };
  });
  return { ...queued, ref, revision };
};
