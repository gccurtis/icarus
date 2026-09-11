import { asId } from "$representation/data/behavior/core/id";
import { readCurrentRows } from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";

import {
  createExternalFileIn,
  externalPathIsAvailable
} from "$capabilities/external-files/api/shared/mutations";
import { externalFileRowIn } from "$capabilities/external-files/api/shared/rows";
import type { AdmittedUploadFile, UploadStoreDecision } from "$capabilities/external-files/api/upload-external-files/contracts";
import type { ExternalFilesLimits } from "$capabilities/external-files/types/shared";
import type { ExternalFileStorageReceipt } from "$model/server/external-file-storage/index.server";
import { recordExternalFileActivity } from "$capabilities/activity";

/** Commits path uniqueness, represented identity, history, and semantic intent together. */
export const commitUploadFile = (
  model: ServerModel,
  scope: Scope,
  limits: ExternalFilesLimits,
  file: AdmittedUploadFile,
  receipt: ExternalFileStorageReceipt
): UploadStoreDecision => model.store.transaction((unit) => {
  const occupied = readCurrentRows(unit, "externalFiles").find(
    (row) => row.projectId === scope.projectId && row.relativePath === file.relativePath
  );
  if (occupied !== undefined) {
    const row = externalFileRowIn(unit, scope.projectId, occupied._id, limits.maxPathBytes);
    if (row === null || row.hash !== receipt.hash) return { kind: "conflict" };
    return { kind: "reused", row };
  }
  if (!externalPathIsAvailable(unit, scope.projectId, file.relativePath)) {
    return { kind: "conflict" };
  }
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const created = createExternalFileIn(model, unit, scope, {
    projectId: asId<"projects">(scope.projectId),
    name: file.name,
    originalName: file.originalName,
    relativePath: file.relativePath,
    mediaType: file.native.mediaType,
    subkind: file.native.subkind,
    storageId: receipt.storageId,
    hash: receipt.hash,
    size: receipt.size,
    origin: { kind: "upload" },
    createdBy: actor,
    updatedBy: actor,
    revision: 1,
    updatedAt: Date.now()
  });
  recordExternalFileActivity(unit, scope, {
    kind: "external-file.uploaded",
    file: {
      id: created.row._id,
      name: created.row.name,
      relativePath: created.row.relativePath
    },
    size: receipt.size,
    mediaType: file.native.mediaType
  });
  return { kind: "created", ...created };
});
