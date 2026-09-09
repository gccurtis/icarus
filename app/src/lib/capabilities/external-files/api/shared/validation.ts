import type {
  ReadExternalFileInput,
  RelocateExternalDirectoryInput,
  RelocateExternalFileInput,
  RemoveExternalFileInput,
  ReuploadExternalFileInput,
  RenameExternalFileInput,
  UpdateExternalFileContextInput,
  UploadExternalFilesInput
} from "$capabilities/external-files/types/external-files";
import {
  normalizeExternalDirectoryPath,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";

const record = (value: unknown, procedure: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`external-files/${procedure}: input is an object`);
  }
  return value as Record<string, unknown>;
};

const only = (value: Record<string, unknown>, accepted: readonly string[], procedure: string) => {
  const unexpected = Object.keys(value).find((key) => !accepted.includes(key));
  if (unexpected !== undefined) {
    throw new Error(`external-files/${procedure}: unexpected field '${unexpected}'`);
  }
};

export const externalFileId = (value: unknown, procedure: string): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith("externalFiles:") ||
    value.length <= "externalFiles:".length ||
    value.length > 500 ||
    /[.:\s]/.test(value.slice("externalFiles:".length))
  ) {
    throw new Error(`external-files/${procedure}: externalFileId is canonical`);
  }
  return value;
};

export const baseRevision = (value: unknown, procedure: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`external-files/${procedure}: baseRevision is a non-negative safe integer`);
  }
  return value as number;
};

export const displayName = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("external file name is text");
  const name = value.trim().normalize("NFC");
  if (
    name.length === 0 ||
    name.length > 240 ||
    name.includes("\u0000") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("external file name is 1 to 240 characters without path separators");
  }
  return name;
};

export const validateReadExternalFile = (input: unknown): ReadExternalFileInput => {
  const candidate = record(input, "read");
  only(candidate, ["externalFileId"], "read");
  return { externalFileId: externalFileId(candidate.externalFileId, "read") };
};

export const validateRenameExternalFile = (input: unknown): RenameExternalFileInput => {
  const candidate = record(input, "rename");
  only(candidate, ["externalFileId", "baseRevision", "name"], "rename");
  return {
    externalFileId: externalFileId(candidate.externalFileId, "rename"),
    baseRevision: baseRevision(candidate.baseRevision, "rename"),
    name: displayName(candidate.name)
  };
};

export const validateRemoveExternalFile = (input: unknown): RemoveExternalFileInput => {
  const candidate = record(input, "remove");
  only(candidate, ["externalFileId", "baseRevision"], "remove");
  return {
    externalFileId: externalFileId(candidate.externalFileId, "remove"),
    baseRevision: baseRevision(candidate.baseRevision, "remove")
  };
};

const fileValue = (value: unknown): value is File => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const file = value as Partial<File>;
  return (
    typeof file.name === "string" &&
    typeof file.type === "string" &&
    typeof file.size === "number" &&
    typeof file.arrayBuffer === "function"
  );
};

export const validateRelocateExternalFile = (input: unknown): RelocateExternalFileInput => {
  const candidate = record(input, "relocate");
  only(candidate, ["externalFileId", "baseRevision", "relativePath"], "relocate");
  if (typeof candidate.relativePath !== "string") {
    throw new Error("external-files/relocate: relativePath is text");
  }
  return {
    externalFileId: externalFileId(candidate.externalFileId, "relocate"),
    baseRevision: baseRevision(candidate.baseRevision, "relocate"),
    relativePath: normalizeExternalRelativePath(candidate.relativePath)
  };
};

export const validateRelocateExternalDirectory = (
  input: unknown
): RelocateExternalDirectoryInput => {
  const candidate = record(input, "relocate-directory");
  only(candidate, ["path", "destination", "baseRevisionToken"], "relocate-directory");
  if (typeof candidate.path !== "string" || typeof candidate.destination !== "string") {
    throw new Error("external-files/relocate-directory: paths are text");
  }
  if (
    typeof candidate.baseRevisionToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.baseRevisionToken)
  ) {
    throw new Error("external-files/relocate-directory: baseRevisionToken is canonical");
  }
  return {
    path: normalizeExternalDirectoryPath(candidate.path),
    destination: normalizeExternalDirectoryPath(candidate.destination),
    baseRevisionToken: candidate.baseRevisionToken
  };
};

export const validateReuploadExternalFile = (input: unknown): ReuploadExternalFileInput => {
  const candidate = record(input, "reupload");
  only(candidate, ["id", "externalFileId", "baseRevision", "file"], "reupload");
  if (candidate.id !== "reupload") {
    throw new Error("external-files/reupload: id is reupload");
  }
  if (!fileValue(candidate.file)) {
    throw new Error("external-files/reupload: file is one File");
  }
  return {
    id: "reupload",
    externalFileId: externalFileId(candidate.externalFileId, "reupload"),
    baseRevision: baseRevision(candidate.baseRevision, "reupload"),
    file: candidate.file
  };
};

export const validateUpdateExternalFileContext = (
  input: unknown
): UpdateExternalFileContextInput => {
  const candidate = record(input, "update-context");
  only(candidate, ["externalFileId", "baseRevision", "semanticContext"], "update-context");
  if (typeof candidate.semanticContext !== "string") {
    throw new Error("external-files/update-context: semanticContext is text");
  }
  const semanticContext = candidate.semanticContext.trim().normalize("NFC");
  if (semanticContext.length > 4_000 || semanticContext.includes("\u0000")) {
    throw new Error("external-files/update-context: semanticContext is at most 4,000 characters");
  }
  return {
    externalFileId: externalFileId(candidate.externalFileId, "update-context"),
    baseRevision: baseRevision(candidate.baseRevision, "update-context"),
    semanticContext
  };
};

export const validateUploadExternalFiles = (input: unknown): UploadExternalFilesInput => {
  const candidate = record(input, "upload");
  only(candidate, ["id", "files", "relativePaths"], "upload");
  if (candidate.id !== "files" && candidate.id !== "folder") {
    throw new Error("external-files/upload: id is files or folder");
  }
  if (!Array.isArray(candidate.files) || !candidate.files.every(fileValue)) {
    throw new Error("external-files/upload: files is a File array");
  }
  if (
    candidate.relativePaths !== undefined &&
    (!Array.isArray(candidate.relativePaths) ||
      !candidate.relativePaths.every((path) => typeof path === "string") ||
      candidate.relativePaths.length !== candidate.files.length)
  ) {
    throw new Error("external-files/upload: relativePaths aligns with files");
  }
  return {
    id: candidate.id,
    files: candidate.files,
    ...(candidate.relativePaths === undefined
      ? {}
      : { relativePaths: candidate.relativePaths as string[] })
  };
};
