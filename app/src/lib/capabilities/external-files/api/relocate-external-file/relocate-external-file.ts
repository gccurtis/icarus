import { asId } from "$representation/data/behavior/core/id";
import {
  canonicalFileSubkind,
  externalFileNameIn,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync, retireSemanticResource } from "$capabilities/semantic-overlay";

import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { externalFileIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { displayName } from "$capabilities/external-files/api/shared/validation";
import { validateRelocateExternalFile } from "$capabilities/external-files/api/relocate-external-file/validate-relocate-external-file";
import type { RelocateExternalFileResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const relocateExternalFile = async (
  input: unknown
): Promise<RelocateExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRelocateExternalFile(input);
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
    const name = displayName(externalFileNameIn(asked.relativePath));
    if (asked.relativePath === found.item.relativePath) return {
      accepted: true,
      externalFileId: asked.externalFileId,
      revision: found.item.revision,
      relativePath: found.item.relativePath,
      semantic: "unsupported"
    };
    const occupied = rowsOf(model.store, "externalFiles").some((row) => {
      if (row.projectId !== scope.projectId || row._id === found.row._id) return false;
      try {
        return normalizeExternalRelativePath(row.relativePath ?? row.originalName ?? row.name) ===
          asked.relativePath;
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
    const subkind = canonicalFileSubkind(undefined, found.item.mediaType, name);
    model.store.update(`externalFiles.${found.row._id}`, {
      ...held,
      name,
      relativePath: asked.relativePath,
      subkind,
      updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
      revision,
      updatedAt: Date.now()
    });
    recordExternalFileHistory(model, scope, {
      event: "moved",
      externalFileId: found.row._id,
      name,
      relativePath: asked.relativePath,
      detail: `${found.item.relativePath} → ${asked.relativePath}`
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
      externalFileId: found.row._id,
      revision,
      relativePath: asked.relativePath,
      semantic,
      ...(semanticDetail === undefined ? {} : { semanticDetail })
    };
  } finally {
    release();
  }
};
