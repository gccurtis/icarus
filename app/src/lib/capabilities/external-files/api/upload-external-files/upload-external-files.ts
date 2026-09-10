import { asId } from "$representation/data/behavior/core/id";
import {
  externalFileNameIn,
  externalRelativePathWithin
} from "$representation/data/behavior/external/file";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import {
  createExternalFileIn,
  externalPathIsAvailable
} from "$capabilities/external-files/api/shared/mutations";
import {
  admitNativeFile,
  claimExternalPublication,
  cleanupExternalBlobIfUnreferenced,
  discardExternalPublication,
  settleExternalPublicationAfterStoreFailure
} from "$capabilities/external-files/api/shared/native-file";
import { externalFileRowIn } from "$capabilities/external-files/api/shared/rows";
import { displayName } from "$capabilities/external-files/api/shared/validation";
import { validateUploadExternalFiles } from "$capabilities/external-files/api/upload-external-files/validate-upload-external-files";
import type {
  RejectedExternalFile,
  UploadExternalFileOutcome,
  UploadExternalFilesResult
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
    let originalName: string;
    try {
      relativePath = externalRelativePathWithin(
        asked.relativePaths?.[index] || file.name,
        limits.maxPathBytes
      );
      const pathName = externalFileNameIn(relativePath);
      name = displayName(pathName);
      if (name !== pathName) {
        throw new Error("an external file path leaf must already be canonical");
      }
      originalName = displayName(file.name);
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

    const native = admitNativeFile(bytes, file.type, name);
    const releaseStorage = await model.externalFileStorage.acquireMutation();
    try {
      let receipt;
      try {
        receipt = await model.externalFileStorage.put({
          ...native,
          bytes,
          maxBytes: limits.maxFileBytes
        });
      } catch (error) {
        outcomes.push(rejected(file, "storage-failed", safeFailure(error), relativePath));
        continue;
      }

      try {
        const committed = model.store.transaction((unit) => {
          const existing = unit.read("externalFiles");
          const occupied = existing?.kind === "table" && existing.table === "externalFiles"
            ? existing.rows.find(
                (row) => row.projectId === scope.projectId && row.relativePath === relativePath
              )
            : undefined;
          if (occupied !== undefined) {
            const row = externalFileRowIn(
              unit,
              scope.projectId,
              occupied._id,
              limits.maxPathBytes
            );
            if (row === null || row.hash !== receipt.hash) return { kind: "conflict" as const };
            return { kind: "reused" as const, row };
          }
          if (!externalPathIsAvailable(unit, scope.projectId, relativePath)) {
            return { kind: "conflict" as const };
          }
          const at = Date.now();
          const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
          return {
            kind: "created" as const,
            ...createExternalFileIn(model, unit, scope, {
              projectId: asId<"projects">(scope.projectId),
              name,
              originalName,
              relativePath,
              mediaType: native.mediaType,
              subkind: native.subkind,
              storageId: receipt.storageId,
              hash: receipt.hash,
              size: receipt.size,
              origin: { kind: "upload" },
              createdBy: actor,
              updatedBy: actor,
              revision: 1,
              updatedAt: at
            }, {
              event: "uploaded",
              detail: `${receipt.size} bytes · ${native.mediaType}`
            })
          };
        });

        if (committed.kind === "conflict") {
          await discardExternalPublication(model, receipt);
          await cleanupExternalBlobIfUnreferenced(model, receipt);
          outcomes.push(rejected(
            file,
            "path-conflict",
            "That relative path already names a different file in this project. Select it and use Re-upload to replace its contents without changing its identity.",
            relativePath
          ));
          continue;
        }
        if (committed.kind === "reused") {
          await claimExternalPublication(model, receipt, committed.row._id);
          outcomes.push({
            status: "reused",
            externalFileId: committed.row._id,
            name: committed.row.name,
            relativePath: committed.row.relativePath,
            size: committed.row.size,
            mediaType: committed.row.mediaType,
            subkind: committed.row.subkind,
            revision: committed.row.revision,
            semantic: committed.row.subkind === "audio" ||
              committed.row.subkind === "video" ||
              committed.row.subkind === "unknown"
              ? "unsupported"
              : "queued"
          });
          continue;
        }
        await claimExternalPublication(model, receipt, committed.row._id);
        outcomes.push({
          status: "uploaded",
          externalFileId: committed.row._id,
          name: committed.row.name,
          relativePath: committed.row.relativePath,
          size: committed.row.size,
          mediaType: committed.row.mediaType,
          subkind: committed.row.subkind,
          revision: committed.row.revision,
          semantic: committed.semantic
        });
      } catch (error) {
        await settleExternalPublicationAfterStoreFailure(model, receipt);
        outcomes.push(rejected(file, "store-failed", safeFailure(error), relativePath));
      }
    } finally {
      releaseStorage();
    }
  }
  return summarize(outcomes);
};
