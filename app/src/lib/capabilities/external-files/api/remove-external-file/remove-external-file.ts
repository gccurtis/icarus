import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { retireSemanticResource } from "$capabilities/semantic-overlay";

import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { externalFileIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { externalFileUsage } from "$capabilities/external-files/api/shared/usage";
import { validateRemoveExternalFile } from "$capabilities/external-files/api/remove-external-file/validate-remove-external-file";
import type { RemoveExternalFileResult } from "$capabilities/external-files/types/external-files";

export const removeExternalFile = async (input: unknown): Promise<RemoveExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRemoveExternalFile(input);
  const model = serverModel();
  const releaseStorage = await model.externalFileStorage.acquireMutation();
  try {
    const found = externalFileIn(model, scope, asked.externalFileId);
    if (found === null) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "not-found",
      revision: null,
      detail: "No file in this project has that id."
    };
    if ("unavailable" in found) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "corrupt",
      revision: null,
      detail: found.detail
    };
    if (found.item.revision !== asked.baseRevision) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "stale",
      revision: found.item.revision,
      detail: `Authored against revision ${asked.baseRevision}; the file is at ${found.item.revision}.`
    };
    const usage = externalFileUsage(model.store, scope, asked.externalFileId);
    if (usage.total > 0) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "in-use",
      revision: found.item.revision,
      detail: `Remove ${usage.total} represented reference${usage.total === 1 ? "" : "s"} first.`,
      usage
    };
    try {
      await retireSemanticResource({
        ref: { kind: `externalFile::${found.item.subkind}`, id: found.row._id }
      });
    } catch (error) {
      return {
        accepted: false,
        externalFileId: asked.externalFileId,
        reason: "cleanup-failed",
        revision: found.item.revision,
        detail: (error instanceof Error ? error.message : String(error)).slice(0, 400)
      };
    }

    const current = externalFileIn(model, scope, asked.externalFileId);
    if (current === null) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "not-found",
      revision: null,
      detail: "The file was removed by another request."
    };
    if ("unavailable" in current) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "corrupt",
      revision: null,
      detail: current.detail
    };
    if (current.item.revision !== asked.baseRevision) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "stale",
      revision: current.item.revision,
      detail: `The file changed during semantic retirement and is now at revision ${current.item.revision}.`
    };
    const currentUsage = externalFileUsage(model.store, scope, asked.externalFileId);
    if (currentUsage.total > 0) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "in-use",
      revision: current.item.revision,
      detail: "The file became referenced during deletion; refresh semantics before trying again.",
      usage: currentUsage
    };

    model.store.removeRows("externalFiles", [current.row._id]);
    recordExternalFileHistory(model, scope, {
      event: "deleted",
      externalFileId: current.row._id,
      name: current.item.name,
      relativePath: current.item.relativePath,
      detail: `${current.item.size ?? "unknown"} bytes · revision ${current.item.revision + 1}`
    });
    const shared = rowsOf(model.store, "externalFiles").some((row) => row.hash === current.row.hash);
    if (shared) return {
      accepted: true,
      externalFileId: asked.externalFileId,
      revision: current.item.revision + 1,
      blob: "shared"
    };
    try {
      const removed = await model.externalFileStorage.remove({
        storageId: current.row.storageId,
        hash: current.row.hash,
        ...(current.item.size === null ? {} : { size: current.item.size })
      });
      return {
        accepted: true,
        externalFileId: asked.externalFileId,
        revision: current.item.revision + 1,
        blob: removed ? "removed" : "already-missing"
      };
    } catch (error) {
      return {
        accepted: true,
        externalFileId: asked.externalFileId,
        revision: current.item.revision + 1,
        blob: "retained-after-error",
        blobDetail: (error instanceof Error ? error.message : String(error)).slice(0, 400)
      };
    }
  } finally {
    releaseStorage();
  }
};
