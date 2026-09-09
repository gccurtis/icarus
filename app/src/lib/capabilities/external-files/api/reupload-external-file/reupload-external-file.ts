import { asId } from "$representation/data/behavior/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync, retireSemanticResource } from "$capabilities/semantic-overlay";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import {
  admitNativeFile,
  releaseUnclaimedNativeFile
} from "$capabilities/external-files/api/shared/native-file";
import { externalFileIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { validateReuploadExternalFile } from "$capabilities/external-files/api/reupload-external-file/validate-reupload-external-file";
import type { ReuploadExternalFileResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const reuploadExternalFile = async (
  input: unknown
): Promise<ReuploadExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateReuploadExternalFile(input);
  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);
  if (asked.file.size > limits.maxFileBytes) return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "file-too-large",
    revision: asked.baseRevision,
    detail: `A file can contain at most ${limits.maxFileBytes} bytes.`
  };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await asked.file.arrayBuffer());
    if (bytes.byteLength !== asked.file.size || bytes.byteLength > limits.maxFileBytes) {
      throw new Error("The received bytes do not match the declared bounded file size.");
    }
  } catch (error) {
    return {
      accepted: false,
      externalFileId: asked.externalFileId,
      reason: "read-failed",
      revision: asked.baseRevision,
      detail: failure(error)
    };
  }

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

    const native = admitNativeFile(bytes, asked.file.type, found.item.name);
    let receipt;
    try {
      receipt = await model.externalFileStorage.put({
        ...native,
        bytes,
        maxBytes: limits.maxFileBytes
      });
    } catch (error) {
      return {
        accepted: false,
        externalFileId: asked.externalFileId,
        reason: "storage-failed",
        revision: found.item.revision,
        detail: failure(error)
      };
    }

    try {
      await retireSemanticResource({
        ref: { kind: `externalFile::${found.item.subkind}`, id: found.row._id }
      });
    } catch (error) {
      await releaseUnclaimedNativeFile(model, receipt);
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
    try {
      model.store.update(`externalFiles.${found.row._id}`, {
        ...held,
        storageId: receipt.storageId,
        hash: receipt.hash,
        size: receipt.size,
        mediaType: native.mediaType,
        subkind: native.subkind,
        updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
        revision,
        updatedAt: Date.now()
      });
    } catch (error) {
      await releaseUnclaimedNativeFile(model, receipt);
      try {
        await enqueueSemanticSync({
          ref: { kind: `externalFile::${found.item.subkind}`, id: found.row._id }
        });
      } catch {
        // The source row remains authoritative; a later backfill can recover semantics.
      }
      return {
        accepted: false,
        externalFileId: asked.externalFileId,
        reason: "store-failed",
        revision: found.item.revision,
        detail: failure(error)
      };
    }

    recordExternalFileHistory(model, scope, {
      event: "re-uploaded",
      externalFileId: found.row._id,
      name: found.item.name,
      relativePath: found.item.relativePath,
      detail: `${asked.file.name} · ${receipt.size} bytes · revision ${revision}`
    });

    let semantic: "queued" | "unsupported" | "enqueue-failed" = "unsupported";
    let semanticDetail: string | undefined;
    try {
      semantic = await enqueueSemanticSync({
        ref: { kind: `externalFile::${native.subkind}`, id: found.row._id }
      }) === null ? "unsupported" : "queued";
    } catch (error) {
      semantic = "enqueue-failed";
      semanticDetail = failure(error);
    }

    let previousBlob: Extract<ReuploadExternalFileResult, { accepted: true }>["previousBlob"] =
      "shared";
    if (found.row.hash !== receipt.hash) {
      const shared = rowsOf(model.store, "externalFiles").some((row) => row.hash === found.row.hash);
      if (!shared) {
        try {
          previousBlob = await model.externalFileStorage.remove({
            storageId: found.row.storageId,
            hash: found.row.hash,
            ...(found.item.size === null ? {} : { size: found.item.size })
          }) ? "removed" : "already-missing";
        } catch {
          previousBlob = "retained-after-error";
        }
      }
    }
    return {
      accepted: true,
      externalFileId: found.row._id,
      revision,
      size: receipt.size,
      mediaType: native.mediaType,
      subkind: native.subkind,
      semantic,
      ...(semanticDetail === undefined ? {} : { semanticDetail }),
      previousBlob
    };
  } finally {
    release();
  }
};
