import {
  externalFileNameIn,
  externalPathsConflict,
  externalRelativePathWithin
} from "$representation/data/behavior/external/file";

import { admitNativeFile } from "$capabilities/external-files/api/shared/native-file";
import { displayName } from "$capabilities/external-files/api/shared/validation";
import type { AdmittedUploadFile } from "$capabilities/external-files/api/upload-external-files/contracts";
import {
  failureDetail,
  rejectUpload
} from "$capabilities/external-files/api/upload-external-files/outcomes";
import type { ExternalFilesLimits } from "$capabilities/external-files/types/shared";
import type {
  RejectedExternalFile,
  UploadExternalFilesInput
} from "$capabilities/external-files/types/upload";

export const rejectInvalidBatch = (
  request: UploadExternalFilesInput,
  limits: ExternalFilesLimits
): readonly RejectedExternalFile[] | undefined => {
  if (request.files.length === 0) {
    return [rejectUpload({ name: "No file selected" }, "empty", "Choose at least one file.")];
  }
  if (request.files.length > limits.maxFiles) {
    return request.files.map((file) => rejectUpload(
      file,
      "too-many-files",
      `A batch can contain at most ${limits.maxFiles} files.`
    ));
  }
  const bytes = request.files.reduce((total, file) => total + file.size, 0);
  if (!Number.isSafeInteger(bytes) || bytes > limits.maxBatchBytes) {
    return request.files.map((file) => rejectUpload(
      file,
      "batch-too-large",
      `A batch can contain at most ${limits.maxBatchBytes} bytes.`
    ));
  }
  return undefined;
};

type AdmittedNames = Pick<AdmittedUploadFile, "name" | "originalName" | "relativePath">;

const admitNames = (
  file: File,
  suppliedPath: string | undefined,
  maxPathBytes: number
): AdmittedNames => {
  const authoredPath = suppliedPath === undefined ? file.name : suppliedPath;
  const relativePath = externalRelativePathWithin(authoredPath, maxPathBytes);
  if (relativePath !== authoredPath) {
    throw new Error("an external file path must already be canonical");
  }
  const pathName = externalFileNameIn(relativePath);
  const name = displayName(pathName);
  if (name !== pathName) {
    throw new Error("an external file path leaf must already be canonical");
  }
  const originalName = displayName(file.name);
  if (originalName !== file.name) {
    throw new Error("an external file name must already be canonical");
  }
  return { name, originalName, relativePath };
};

export const admitUploadFile = async (
  file: File,
  suppliedPath: string | undefined,
  seenPaths: Set<string>,
  limits: ExternalFilesLimits
): Promise<AdmittedUploadFile | RejectedExternalFile> => {
  if (file.size > limits.maxFileBytes) {
    return rejectUpload(
      file,
      "file-too-large",
      `A file can contain at most ${limits.maxFileBytes} bytes.`
    );
  }

  let names: AdmittedNames;
  try {
    names = admitNames(file, suppliedPath, limits.maxPathBytes);
  } catch (error) {
    return rejectUpload(file, "invalid-path", failureDetail(error));
  }
  if (seenPaths.has(names.relativePath)) {
    return rejectUpload(
      file,
      "duplicate-path",
      "The normalized relative path appears more than once in this batch.",
      names.relativePath
    );
  }
  if ([...seenPaths].some((path) => externalPathsConflict(path, names.relativePath))) {
    return rejectUpload(
      file,
      "path-conflict",
      "A file path cannot also be another file's directory in this batch.",
      names.relativePath
    );
  }
  seenPaths.add(names.relativePath);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || bytes.byteLength > limits.maxFileBytes) {
      throw new Error("The received bytes do not match the declared bounded file size.");
    }
    return {
      status: "admitted",
      source: file,
      bytes,
      ...names,
      native: admitNativeFile(bytes, file.type, names.name)
    };
  } catch (error) {
    return rejectUpload(file, "read-failed", failureDetail(error), names.relativePath);
  }
};
