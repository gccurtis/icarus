import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { enqueueMaterialSyncFor } from "$capabilities/semantic-overlay/api/shared/material-queue";
import { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { semanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";

export type SemanticOutboxReceipt = {
  readonly jobId?: Id<"semanticSyncJobs">;
  readonly materialJobId?: Id<"semanticMaterialJobs">;
};

/**
 * Records the semantic work caused by one authoritative revision.
 *
 * This runs inside the caller's Store transaction. It only writes durable
 * outbox rows; embedding, description, and index publication remain worker
 * work after the transaction commits.
 */
export const enqueueSemanticOutboxFor = (
  model: ServerModel,
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  ref: ResourceRef,
  revision: number
): SemanticOutboxReceipt => {
  if (isStagedResource(unit, projectId, ref)) return {};

  const atomic = semanticUnitModel(model, unit);
  const exactText =
    ref.kind === "document" || ref.kind === "presentation" || ref.kind === "externalFile::text";
  const material =
    ref.kind === "document" ||
    ref.kind === "presentation" ||
    ref.kind === "spreadsheet" ||
    ref.kind === "externalFile::code" ||
    ref.kind === "externalFile::data" ||
    ref.kind === "externalFile::image";
  if (!exactText && !material) {
    return {};
  }

  return {
    ...(exactText
      ? { jobId: enqueueSemanticSyncFor(atomic, projectId, ref, revision) }
      : {}),
    ...(material
      ? { materialJobId: enqueueMaterialSyncFor(atomic, projectId, ref, revision) }
      : {})
  };
};
