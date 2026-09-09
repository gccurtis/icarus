import { asId } from "$representation/data/behavior/core/id";
import {
  canonicalFileSubkind,
  externalDirectoryIn,
  externalPathIn,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync, retireSemanticResource } from "$capabilities/semantic-overlay";

import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { externalFileIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { validateRenameExternalFile } from "$capabilities/external-files/api/rename-external-file/validate-rename-external-file";
import type { RenameExternalFileResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const renameExternalFile = async (input: unknown): Promise<RenameExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRenameExternalFile(input);
  const model = serverModel();
  const release = await model.externalFileStorage.acquireMutation();
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
    if (found.item.name === asked.name) return {
      accepted: true,
      externalFileId: asked.externalFileId,
      revision: found.item.revision,
      relativePath: found.item.relativePath,
      semantic: "unsupported"
    };

    const relativePath = externalPathIn(externalDirectoryIn(found.item.relativePath), asked.name);
    const occupied = rowsOf(model.store, "externalFiles").some((row) => {
      if (row.projectId !== scope.projectId || row._id === found.row._id) return false;
      try {
        return normalizeExternalRelativePath(row.relativePath ?? row.originalName ?? row.name) === relativePath;
      } catch {
        return false;
      }
    });
    if (occupied) return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "path-conflict",
      revision: found.item.revision,
      detail: "Another file already occupies that path."
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
        detail: failure(error)
      };
    }

    const { _id, _creationTime, ...held } = found.row;
    void _id;
    void _creationTime;
    const revision = found.item.revision + 1;
    const subkind = canonicalFileSubkind(undefined, found.item.mediaType, asked.name);
    model.store.update(`externalFiles.${found.row._id}`, {
      ...held,
      name: asked.name,
      relativePath,
      subkind,
      updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
      revision,
      updatedAt: Date.now()
    });
    recordExternalFileHistory(model, scope, {
      event: "renamed",
      externalFileId: found.row._id,
      name: asked.name,
      relativePath,
      detail: `${found.item.name} → ${asked.name}`
    });

    let semantic: "queued" | "unsupported" | "enqueue-failed" = "unsupported";
    let semanticDetail: string | undefined;
    try {
      semantic = await enqueueSemanticSync({
        ref: { kind: `externalFile::${subkind}`, id: found.row._id }
      }) === null ? "unsupported" : "queued";
    } catch (error) {
      semantic = "enqueue-failed";
      semanticDetail = failure(error);
    }
    return {
      accepted: true,
      externalFileId: asked.externalFileId,
      revision,
      relativePath,
      semantic,
      ...(semanticDetail === undefined ? {} : { semanticDetail })
    };
  } finally {
    release();
  }
};
