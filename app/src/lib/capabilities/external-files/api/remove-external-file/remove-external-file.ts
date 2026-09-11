import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { recordExternalFileActivity } from "$capabilities/activity";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { removeExternalFileIn } from "$capabilities/external-files/api/shared/mutations";
import {
  cleanupExternalBlobIfUnreferenced,
  releaseExternalBlobClaim
} from "$capabilities/external-files/api/shared/native-file";
import { externalFileRowIn } from "$capabilities/external-files/api/shared/rows";
import { externalFileUsage } from "$capabilities/external-files/api/shared/usage/usage";
import { validateRemoveExternalFile } from "$capabilities/external-files/api/remove-external-file/validate-remove-external-file";
import type { RemoveExternalFileResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const removeExternalFile = async (input: unknown): Promise<RemoveExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRemoveExternalFile(input);
  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);

  let committed;
  try {
    committed = model.store.transaction((unit) => {
      let row;
      try {
        row = externalFileRowIn(unit, scope.projectId, asked.externalFileId, limits.maxPathBytes);
      } catch (error) {
        return { kind: "corrupt" as const, detail: failure(error) };
      }
      if (row === null) return { kind: "not-found" as const };
      if (row.revision !== asked.baseRevision) {
        return { kind: "stale" as const, revision: row.revision };
      }
      const usage = externalFileUsage(unit, scope, row._id);
      if (usage.total > 0) return { kind: "in-use" as const, revision: row.revision, usage };

      recordExternalFileActivity(unit, scope, {
        kind: "external-file.deleted",
        file: { id: row._id, name: row.name, relativePath: row.relativePath },
        size: row.size,
        revision: row.revision + 1
      });
      removeExternalFileIn(model, unit, scope, row);
      return {
        kind: "removed" as const,
        revision: row.revision + 1,
        reference: { storageId: row.storageId, hash: row.hash, size: row.size }
      };
    });
  } catch (error) {
    return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "store-failed",
      revision: asked.baseRevision,
      detail: failure(error)
    };
  }

  if (committed.kind === "not-found") return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "not-found",
    revision: null,
    detail: "No file in this project has that id."
  };
  if (committed.kind === "corrupt") return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "corrupt",
    revision: null,
    detail: committed.detail
  };
  if (committed.kind === "stale") return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "stale",
    revision: committed.revision,
    detail: `Authored against revision ${asked.baseRevision}; the file is at ${committed.revision}.`
  };
  if (committed.kind === "in-use") return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "in-use",
    revision: committed.revision,
    detail: `Remove ${committed.usage.total} represented reference${committed.usage.total === 1 ? "" : "s"} first.`,
    usage: committed.usage
  };

  const released = await releaseExternalBlobClaim(
    model,
    asId<"externalFiles">(asked.externalFileId),
    committed.reference
  );
  const blob = released
    ? await cleanupExternalBlobIfUnreferenced(model, committed.reference)
    : "retained-after-error";
  return {
    accepted: true,
    externalFileId: asked.externalFileId,
    revision: committed.revision,
    blob,
    ...(blob === "retained-after-error"
      ? { blobDetail: "The row was removed; startup reconciliation will retry blob cleanup." }
      : {})
  };
};
