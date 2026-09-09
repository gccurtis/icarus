import { asId } from "$representation/data/behavior/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync } from "$capabilities/semantic-overlay";

import { externalFileIn } from "$capabilities/external-files/api/shared/rows";
import { validateRenameExternalFile } from "$capabilities/external-files/api/rename-external-file/validate-rename-external-file";
import type { RenameExternalFileResult } from "$capabilities/external-files/types/external-files";

export const renameExternalFile = async (input: unknown): Promise<RenameExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRenameExternalFile(input);
  const model = serverModel();
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
    semantic: "unsupported"
  };

  const { _id, _creationTime, ...held } = found.row;
  void _id;
  void _creationTime;
  const revision = found.item.revision + 1;
  model.store.update(`externalFiles.${found.row._id}`, {
    ...held,
    name: asked.name,
    updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
    revision,
    updatedAt: Date.now()
  });
  let semantic: "queued" | "unsupported" | "enqueue-failed" = "unsupported";
  let semanticDetail: string | undefined;
  try {
    semantic = await enqueueSemanticSync({
      ref: { kind: `externalFile::${found.item.subkind}`, id: found.row._id }
    }) === null ? "unsupported" : "queued";
  } catch (error) {
    semantic = "enqueue-failed";
    semanticDetail = (error instanceof Error ? error.message : String(error)).slice(0, 400);
  }
  return {
    accepted: true,
    externalFileId: asked.externalFileId,
    revision,
    semantic,
    ...(semanticDetail === undefined ? {} : { semanticDetail })
  };
};
