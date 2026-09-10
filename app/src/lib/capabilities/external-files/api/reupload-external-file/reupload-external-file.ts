import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { replaceExternalFileIn } from "$capabilities/external-files/api/shared/mutations";
import {
  admitNativeFile,
  claimExternalPublication,
  cleanupExternalBlobIfUnreferenced,
  discardExternalPublication,
  releaseExternalBlobClaim,
  settleExternalPublicationAfterStoreFailure
} from "$capabilities/external-files/api/shared/native-file";
import { externalFileIn, externalFileRowIn } from "$capabilities/external-files/api/shared/rows";
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
  const preliminary = externalFileIn(model, scope, asked.externalFileId);
  if (preliminary === null) return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "not-found",
    revision: null,
    detail: "No file in this project has that id."
  };
  if ("unavailable" in preliminary) return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "corrupt",
    revision: null,
    detail: preliminary.detail
  };
  if (asked.file.size > limits.maxFileBytes) return {
    accepted: false,
    externalFileId: asked.externalFileId,
    reason: "file-too-large",
    revision: preliminary.item.revision,
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
      revision: preliminary.item.revision,
      detail: failure(error)
    };
  }

  const native = admitNativeFile(bytes, asked.file.type, preliminary.item.name);
  const release = await model.externalFileStorage.acquireMutation();
  try {
    let receipt;
    try {
      receipt = await model.externalFileStorage.put({
        storageId: native.storageId,
        hash: native.hash,
        size: native.size,
        bytes,
        maxBytes: limits.maxFileBytes
      });
    } catch (error) {
      return {
        accepted: false,
        externalFileId: asked.externalFileId,
        reason: "storage-failed",
        revision: preliminary.item.revision,
        detail: failure(error)
      };
    }

    try {
      const committed = model.store.transaction((unit) => {
        const row = externalFileRowIn(
          unit,
          scope.projectId,
          asked.externalFileId,
          limits.maxPathBytes
        );
        if (row === null) return { kind: "not-found" as const };
        if (row.revision !== asked.baseRevision) {
          return { kind: "stale" as const, revision: row.revision };
        }
        const changed = replaceExternalFileIn(model, unit, scope, row, {
          storageId: receipt.storageId,
          hash: receipt.hash,
          size: receipt.size,
          mediaType: native.mediaType,
          subkind: native.subkind
        }, {
          event: "re-uploaded",
          detail: `${asked.file.name} · ${receipt.size} bytes · revision ${row.revision + 1}`
        }, Date.now());
        return { kind: "changed" as const, previous: row, ...changed };
      });

      if (committed.kind !== "changed") {
        await discardExternalPublication(model, receipt);
        await cleanupExternalBlobIfUnreferenced(model, receipt);
        return committed.kind === "not-found"
          ? {
              accepted: false,
              externalFileId: asked.externalFileId,
              reason: "not-found",
              revision: null,
              detail: "No file in this project has that id."
            }
          : {
              accepted: false,
              externalFileId: asked.externalFileId,
              reason: "stale",
              revision: committed.revision,
              detail: `Authored against revision ${asked.baseRevision}; the file is at ${committed.revision}.`
            };
      }

      await claimExternalPublication(model, receipt, committed.row._id);
      const previousReference = {
        storageId: committed.previous.storageId,
        hash: committed.previous.hash,
        size: committed.previous.size
      };
      const sameBlob = committed.previous.storageId === committed.row.storageId;
      const released = sameBlob || await releaseExternalBlobClaim(
        model,
        committed.previous._id,
        previousReference
      );
      const previousBlob = released
        ? await cleanupExternalBlobIfUnreferenced(model, previousReference)
        : "retained-after-error";
      return {
        accepted: true,
        externalFileId: committed.row._id,
        revision: committed.row.revision,
        size: committed.row.size,
        mediaType: committed.row.mediaType,
        subkind: committed.row.subkind,
        semantic: committed.semantic,
        previousBlob
      };
    } catch (error) {
      await settleExternalPublicationAfterStoreFailure(model, receipt);
      return {
        accepted: false,
        externalFileId: asked.externalFileId,
        reason: "store-failed",
        revision: asked.baseRevision,
        detail: failure(error)
      };
    }
  } finally {
    release();
  }
};
