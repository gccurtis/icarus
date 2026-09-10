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
  normalizeExternalDirectoryPath
} from "$representation/data/behavior/external/file";

const record = (value: unknown, procedure: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`external-files/${procedure}: input is an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`external-files/${procedure}: input is one plain data object`);
  }
  return value as Record<string, unknown>;
};

const exact = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  procedure: string
) => {
  const missing = required.find((key) => !Object.hasOwn(value, key));
  if (missing !== undefined) {
    throw new Error(`external-files/${procedure}: missing field '${missing}'`);
  }
  const accepted = [...required, ...optional];
  const unexpected = Reflect.ownKeys(value).find((key) =>
    typeof key !== "string" ||
    !accepted.includes(key) ||
    (() => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable;
    })()
  );
  if (unexpected !== undefined) {
    throw new Error(`external-files/${procedure}: unexpected field '${String(unexpected)}' or non-data shape`);
  }
};

/** One dense undecorated array; inspect descriptors before reading an element. */
const exactArray = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.length + 1 ||
    keys.some((key, index) => key !== (index < value.length ? String(index) : "length"))
  ) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor &&
      (key === "length" ? !descriptor.enumerable : descriptor.enumerable);
  });
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
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`external-files/${procedure}: baseRevision is a positive safe integer`);
  }
  return value as number;
};

export const displayName = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("external file name is text");
  const normalized = value.normalize("NFC");
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error("external file name cannot contain control characters");
  }
  const name = normalized.trim();
  if (
    name.length === 0 ||
    name.length > 240 ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("external file name is 1 to 240 characters without path separators");
  }
  return name;
};

export const validateReadExternalFile = (input: unknown): ReadExternalFileInput => {
  const candidate = record(input, "read");
  exact(candidate, ["externalFileId"], [], "read");
  return { externalFileId: externalFileId(candidate.externalFileId, "read") };
};

export const validateRenameExternalFile = (input: unknown): RenameExternalFileInput => {
  const candidate = record(input, "rename");
  exact(candidate, ["externalFileId", "baseRevision", "name"], [], "rename");
  const name = displayName(candidate.name);
  if (name !== candidate.name) {
    throw new Error("external-files/rename: name is already canonical");
  }
  return {
    externalFileId: externalFileId(candidate.externalFileId, "rename"),
    baseRevision: baseRevision(candidate.baseRevision, "rename"),
    name
  };
};

export const validateRemoveExternalFile = (input: unknown): RemoveExternalFileInput => {
  const candidate = record(input, "remove");
  exact(candidate, ["externalFileId", "baseRevision"], [], "remove");
  return {
    externalFileId: externalFileId(candidate.externalFileId, "remove"),
    baseRevision: baseRevision(candidate.baseRevision, "remove")
  };
};

const fileValue = (value: unknown): value is File => value instanceof File;

const currentFileValue = (value: unknown): value is File => {
  if (!fileValue(value)) return false;
  try {
    return displayName(value.name) === value.name;
  } catch {
    return false;
  }
};

const currentDirectory = (value: unknown, procedure: string): string => {
  if (typeof value !== "string") {
    throw new Error(`external-files/${procedure}: directory is text`);
  }
  const directory = normalizeExternalDirectoryPath(value);
  if (directory !== value) {
    throw new Error(`external-files/${procedure}: directory is already canonical`);
  }
  return directory;
};

export const validateRelocateExternalFile = (input: unknown): RelocateExternalFileInput => {
  const candidate = record(input, "relocate");
  exact(
    candidate,
    ["externalFileId", "baseRevision", "destinationDirectory"],
    [],
    "relocate"
  );
  return {
    externalFileId: externalFileId(candidate.externalFileId, "relocate"),
    baseRevision: baseRevision(candidate.baseRevision, "relocate"),
    destinationDirectory: currentDirectory(candidate.destinationDirectory, "relocate")
  };
};

export const validateRelocateExternalDirectory = (
  input: unknown
): RelocateExternalDirectoryInput => {
  const candidate = record(input, "relocate-directory");
  exact(
    candidate,
    ["sourceDirectory", "destinationDirectory", "baseRevisionToken"],
    [],
    "relocate-directory"
  );
  if (
    typeof candidate.baseRevisionToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.baseRevisionToken)
  ) {
    throw new Error("external-files/relocate-directory: baseRevisionToken is canonical");
  }
  return {
    sourceDirectory: currentDirectory(candidate.sourceDirectory, "relocate-directory source"),
    destinationDirectory: currentDirectory(
      candidate.destinationDirectory,
      "relocate-directory destination"
    ),
    baseRevisionToken: candidate.baseRevisionToken
  };
};

export const validateReuploadExternalFile = (input: unknown): ReuploadExternalFileInput => {
  const candidate = record(input, "reupload");
  exact(candidate, ["id", "externalFileId", "baseRevision", "file"], [], "reupload");
  if (candidate.id !== "reupload") {
    throw new Error("external-files/reupload: id is reupload");
  }
  if (!currentFileValue(candidate.file)) {
    throw new Error("external-files/reupload: file is one File with a canonical name");
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
  exact(
    candidate,
    ["externalFileId", "baseRevision", "semanticContext"],
    [],
    "update-context"
  );
  if (typeof candidate.semanticContext !== "string") {
    throw new Error("external-files/update-context: semanticContext is text");
  }
  const semanticContext = candidate.semanticContext.trim().normalize("NFC");
  if (semanticContext.length > 4_000 || semanticContext.includes("\u0000")) {
    throw new Error("external-files/update-context: semanticContext is at most 4,000 characters");
  }
  if (semanticContext !== candidate.semanticContext) {
    throw new Error("external-files/update-context: semanticContext is already canonical");
  }
  return {
    externalFileId: externalFileId(candidate.externalFileId, "update-context"),
    baseRevision: baseRevision(candidate.baseRevision, "update-context"),
    semanticContext
  };
};

export const validateUploadExternalFiles = (input: unknown): UploadExternalFilesInput => {
  const candidate = record(input, "upload");
  exact(candidate, ["id", "files"], ["relativePaths"], "upload");
  if (candidate.id !== "files" && candidate.id !== "folder") {
    throw new Error("external-files/upload: id is files or folder");
  }
  if (!exactArray(candidate.files) || !candidate.files.every(fileValue)) {
    throw new Error("external-files/upload: files is a File array");
  }
  if (candidate.id === "folder" && candidate.relativePaths === undefined) {
    throw new Error("external-files/upload: a folder requires one relative path per file");
  }
  if (Object.hasOwn(candidate, "relativePaths") && candidate.relativePaths === undefined) {
    throw new Error("external-files/upload: absent relativePaths is omitted");
  }
  if (
    candidate.relativePaths !== undefined &&
    (!exactArray(candidate.relativePaths) ||
      !candidate.relativePaths.every((path) => typeof path === "string" && path.length > 0) ||
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
