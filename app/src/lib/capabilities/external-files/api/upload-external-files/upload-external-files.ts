import { asId } from "$representation/data/behavior/core/id";
import {
  externalFileNameIn,
  fileSubkindFor,
  mediaTypeForExternalBytes,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { MaterialContentReceipt } from "$model/server/material-content/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { enqueueSemanticSync } from "$capabilities/semantic-overlay";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { externalFileIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { displayName } from "$capabilities/external-files/api/shared/validation";
import { validateUploadExternalFiles } from "$capabilities/external-files/api/upload-external-files/validate-upload-external-files";
import type {
  RejectedExternalFile,
  UploadExternalFileOutcome,
  UploadExternalFilesResult,
  UploadedExternalFile
} from "$capabilities/external-files/types/external-files";

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

const summarize = (outcomes: readonly UploadExternalFileOutcome[]): UploadExternalFilesResult => ({
  outcomes,
  uploaded: outcomes.filter((entry) => entry.status === "uploaded").length,
  reused: outcomes.filter((entry) => entry.status === "reused").length,
  rejected: outcomes.filter((entry) => entry.status === "rejected").length
});

const rejected = (
  file: Pick<File, "name">,
  reason: RejectedExternalFile["reason"],
  detail: string,
  relativePath?: string
): RejectedExternalFile => ({
  status: "rejected",
  name: file.name || "Unnamed file",
  ...(relativePath === undefined ? {} : { relativePath }),
  reason,
  detail
});

/** Best-effort compensation for a blob written before its represented row exists. */
const releaseUnclaimed = async (
  model: ServerModel,
  receipt: MaterialContentReceipt
): Promise<void> => {
  if (
    receipt.reused ||
    rowsOf(model.store, "externalFiles").some((row) => row.hash === receipt.hash)
  ) return;
  try {
    await model.materialContent.remove(receipt);
  } catch {
    // A content-addressed orphan is safer than converting one rejected file
    // into a failed batch. A later successful upload can reclaim the same hash.
  }
};

export const uploadExternalFiles = async (input: unknown): Promise<UploadExternalFilesResult> => {
  const scope = await requireScope();
  const asked = validateUploadExternalFiles(input);
  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);
  if (asked.files.length === 0) {
    return summarize([rejected({ name: "No file selected" }, "empty", "Choose at least one file.")]);
  }
  if (asked.files.length > limits.maxFiles) {
    return summarize(asked.files.map((file) => rejected(
      file,
      "too-many-files",
      `A batch can contain at most ${limits.maxFiles} files.`
    )));
  }
  const declaredTotal = asked.files.reduce((total, file) => total + file.size, 0);
  if (!Number.isSafeInteger(declaredTotal) || declaredTotal > limits.maxBatchBytes) {
    return summarize(asked.files.map((file) => rejected(
      file,
      "batch-too-large",
      `A batch can contain at most ${limits.maxBatchBytes} bytes.`
    )));
  }

  const outcomes: UploadExternalFileOutcome[] = [];
  const seenPaths = new Set<string>();
  for (let index = 0; index < asked.files.length; index += 1) {
    const file = asked.files[index];
    if (file.size > limits.maxFileBytes) {
      outcomes.push(rejected(
        file,
        "file-too-large",
        `A file can contain at most ${limits.maxFileBytes} bytes.`
      ));
      continue;
    }

    let relativePath: string;
    let name: string;
    try {
      relativePath = normalizeExternalRelativePath(asked.relativePaths?.[index] || file.name);
      if (new TextEncoder().encode(relativePath).byteLength > limits.maxPathBytes) {
        throw new Error(`an external file path exceeds ${limits.maxPathBytes} UTF-8 bytes`);
      }
      name = displayName(externalFileNameIn(relativePath));
    } catch (error) {
      outcomes.push(rejected(file, "invalid-path", safeFailure(error)));
      continue;
    }
    if (seenPaths.has(relativePath)) {
      outcomes.push(rejected(
        file,
        "duplicate-path",
        "The normalized relative path appears more than once in this batch.",
        relativePath
      ));
      continue;
    }
    seenPaths.add(relativePath);

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength !== file.size || bytes.byteLength > limits.maxFileBytes) {
        throw new Error("The received bytes do not match the declared bounded file size.");
      }
    } catch (error) {
      outcomes.push(rejected(file, "read-failed", safeFailure(error), relativePath));
      continue;
    }
    const mediaType = mediaTypeForExternalBytes(bytes, file.type, name);
    const subkind = fileSubkindFor(mediaType, name);
    const releaseStorage = await model.materialContent.acquireMutation();
    try {
      let receipt: MaterialContentReceipt;
      try {
        receipt = await model.materialContent.put({ bytes, maxBytes: limits.maxFileBytes });
      } catch (error) {
        outcomes.push(rejected(file, "storage-failed", safeFailure(error), relativePath));
        continue;
      }
      const existing = rowsOf(model.store, "externalFiles").find((row) => {
        if (row.projectId !== scope.projectId) return false;
        const held = row.relativePath ?? row.originalName ?? row.name;
        try {
          return normalizeExternalRelativePath(held) === relativePath;
        } catch {
          return false;
        }
      });
      if (existing !== undefined) {
        if (existing.hash !== receipt.hash) {
          await releaseUnclaimed(model, receipt);
          outcomes.push(rejected(
            file,
            "path-conflict",
            "That relative path already names a different file in this project.",
            relativePath
          ));
          continue;
        }
        const admitted = externalFileIn(model, scope, existing._id);
        if (admitted === null || "unavailable" in admitted) {
          await releaseUnclaimed(model, receipt);
          outcomes.push(rejected(
            file,
            "path-conflict",
            "That relative path is reserved by file metadata that cannot be safely read.",
            relativePath
          ));
          continue;
        }
        const revision = admitted.item.revision;
        let semantic: UploadedExternalFile["semantic"] = "unsupported";
        let semanticDetail: string | undefined;
        try {
          semantic = await enqueueSemanticSync({
            ref: { kind: `externalFile::${subkind}`, id: existing._id }
          }) === null ? "unsupported" : "queued";
        } catch (error) {
          semantic = "enqueue-failed";
          semanticDetail = safeFailure(error);
        }
        outcomes.push({
          status: "reused",
          externalFileId: admitted.row._id,
          name: admitted.item.name,
          relativePath,
          size: receipt.size,
          mediaType: admitted.item.mediaType,
          subkind: admitted.item.subkind,
          revision,
          semantic,
          ...(semanticDetail === undefined ? {} : { semanticDetail })
        });
        continue;
      }

      const at = Date.now();
      let externalFileId: Id<"externalFiles">;
      try {
        const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
        externalFileId = model.store.create("externalFiles", {
          projectId: asId<"projects">(scope.projectId),
          name,
          originalName: displayName(file.name),
          relativePath,
          mediaType,
          subkind,
          storageId: receipt.storageId,
          hash: receipt.hash,
          size: receipt.size,
          origin: { kind: "upload" },
          createdBy: actor,
          updatedBy: actor,
          revision: 1,
          updatedAt: at
        });
      } catch (error) {
        await releaseUnclaimed(model, receipt);
        outcomes.push(rejected(file, "store-failed", safeFailure(error), relativePath));
        continue;
      }

      let semantic: UploadedExternalFile["semantic"] = "unsupported";
      let semanticDetail: string | undefined;
      try {
        semantic = await enqueueSemanticSync({
          ref: { kind: `externalFile::${subkind}`, id: externalFileId }
        }) === null ? "unsupported" : "queued";
      } catch (error) {
        semantic = "enqueue-failed";
        semanticDetail = safeFailure(error);
      }
      outcomes.push({
        status: "uploaded",
        externalFileId,
        name,
        relativePath,
        size: receipt.size,
        mediaType,
        subkind,
        revision: 1,
        semantic,
        ...(semanticDetail === undefined ? {} : { semanticDetail })
      });
    } finally {
      releaseStorage();
    }
  }
  return summarize(outcomes);
};
