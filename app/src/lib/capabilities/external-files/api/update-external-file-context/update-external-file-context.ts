import { asId } from "$representation/data/behavior/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync, retireSemanticResource } from "$capabilities/semantic-overlay";

import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { externalFileIn } from "$capabilities/external-files/api/shared/rows";
import { validateUpdateExternalFileContext } from "$capabilities/external-files/api/update-external-file-context/validate-update-external-file-context";
import type { UpdateExternalFileContextResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

/** Replaces optional authored meaning for a material-bearing External file. */
export const updateExternalFileContext = async (
  input: unknown
): Promise<UpdateExternalFileContextResult> => {
  const scope = await requireScope();
  const asked = validateUpdateExternalFileContext(input);
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
    if (asked.semanticContext === (found.item.semanticContext ?? "")) return {
      accepted: true,
      externalFileId: found.row._id,
      revision: found.item.revision,
      semantic: found.item.semantic.material.eligible ? "queued" : "unsupported"
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

    const { _id, _creationTime, semanticContext: _context, ...held } = found.row;
    void _id;
    void _creationTime;
    void _context;
    const revision = found.item.revision + 1;
    model.store.update(`externalFiles.${found.row._id}`, {
      ...held,
      ...(asked.semanticContext === "" ? {} : { semanticContext: asked.semanticContext }),
      updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
      revision,
      updatedAt: Date.now()
    });
    recordExternalFileHistory(model, scope, {
      event: "context-updated",
      externalFileId: found.row._id,
      name: found.item.name,
      relativePath: found.item.relativePath,
      detail: asked.semanticContext === "" ? "Dataset context cleared" : "Dataset context updated"
    });
    let semantic: "queued" | "unsupported" | "enqueue-failed" = "unsupported";
    let semanticDetail: string | undefined;
    try {
      semantic = await enqueueSemanticSync({
        ref: { kind: `externalFile::${found.item.subkind}`, id: found.row._id }
      }) === null ? "unsupported" : "queued";
    } catch (error) {
      semantic = "enqueue-failed";
      semanticDetail = failure(error);
    }
    return {
      accepted: true,
      externalFileId: found.row._id,
      revision,
      semantic,
      ...(semanticDetail === undefined ? {} : { semanticDetail })
    };
  } finally {
    release();
  }
};
