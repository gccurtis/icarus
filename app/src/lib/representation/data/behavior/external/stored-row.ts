import {
  externalFileNameIn,
  fileSubkindFor,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import {
  hasExactFields,
  isStoredActor,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isExternalFileSubkind } from "$representation/data/behavior/core/resource";
import type { ExternalFile } from "$representation/store/tables";

const REQUIRED_FIELDS = [
  "_id",
  "_creationTime",
  "projectId",
  "name",
  "originalName",
  "relativePath",
  "mediaType",
  "subkind",
  "storageId",
  "hash",
  "size",
  "origin",
  "createdBy",
  "updatedBy",
  "revision",
  "updatedAt"
] as const;

const OPTIONAL_FIELDS = ["semanticContext"] as const;

const currentName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 240 &&
  value === value.trim() &&
  value === value.normalize("NFC") &&
  !value.includes("/") &&
  !value.includes("\\") &&
  !/[\u0000-\u001f\u007f]/u.test(value);

const currentMediaType = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 200 &&
  value === value.trim() &&
  /^[\x20-\x7e]+$/u.test(value);

const currentOrigin = (value: unknown): boolean => {
  const origin = storedFields(value);
  if (origin === undefined) return false;
  if (origin.kind === "upload") return hasExactFields(origin, ["kind"]);
  return origin.kind === "connector" &&
    hasExactFields(origin, ["kind", "connectorId", "sourceId"]) &&
    isStoredRowId(origin.connectorId, "connectors") &&
    isStoredIdentifier(origin.sourceId);
};

const currentSemanticContext = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 4_000 &&
  value === value.trim() &&
  value === value.normalize("NFC") &&
  !value.includes("\u0000");

const exactFieldError = (row: Record<string, unknown>): Error => {
  const missing = REQUIRED_FIELDS.find((field) => !Object.hasOwn(row, field));
  if (missing !== undefined) {
    return new Error(`external file is missing required field '${missing}'`);
  }
  const unexpected = Object.keys(row).find(
    (field) => !REQUIRED_FIELDS.includes(field as never) && !OPTIONAL_FIELDS.includes(field as never)
  );
  return new Error(
    unexpected === undefined
      ? "external file does not have the exact current fields"
      : `external file has unexpected field '${unexpected}'`
  );
};

/** Admits the sole represented external-file row shape. */
export const admitStoredExternalFile = (value: unknown): ExternalFile => {
  const row = storedFields(value);
  if (row === undefined) throw new Error("external file is an object");
  if (!hasExactFields(row, REQUIRED_FIELDS, OPTIONAL_FIELDS)) throw exactFieldError(row);
  if (!isStoredRowId(row._id, "externalFiles")) throw new Error("external file id is canonical");
  if (!isStoredTime(row._creationTime)) throw new Error("external file creation time is current");
  if (!isStoredRowId(row.projectId, "projects")) throw new Error("external file project id is canonical");
  if (!currentName(row.name)) throw new Error("external file name is canonical");
  if (!currentName(row.originalName)) throw new Error("external file original name is canonical");
  if (typeof row.relativePath !== "string") throw new Error("external file relative path is text");
  let relativePath: string;
  try {
    relativePath = normalizeExternalRelativePath(row.relativePath);
  } catch {
    throw new Error("external file relative path is canonical");
  }
  if (relativePath !== row.relativePath) throw new Error("external file relative path is canonical");
  if (externalFileNameIn(relativePath) !== row.name) {
    throw new Error("external file path leaf must equal its name");
  }
  if (!currentMediaType(row.mediaType)) throw new Error("external file media type is canonical");
  if (!isExternalFileSubkind(row.subkind)) throw new Error("external file subkind is current");
  if (fileSubkindFor(row.mediaType, row.name) !== row.subkind) {
    throw new Error("external file subkind agrees with its media type and name");
  }
  if (typeof row.hash !== "string" || !/^[a-f0-9]{64}$/u.test(row.hash)) {
    throw new Error("external file hash is lowercase SHA-256");
  }
  if (!isStoredRowId(row.storageId, "_storage") || row.storageId !== `_storage:${row.hash}`) {
    throw new Error("external file storage id matches its hash");
  }
  if (!isStoredNatural(row.size)) throw new Error("external file size is a non-negative safe integer");
  if (!currentOrigin(row.origin)) throw new Error("external file origin is current");
  if (!isStoredActor(row.createdBy)) throw new Error("external file createdBy actor is current");
  if (!isStoredActor(row.updatedBy)) throw new Error("external file updatedBy actor is current");
  if (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1) {
    throw new Error("external file revision is a positive safe integer");
  }
  if (!isStoredTime(row.updatedAt)) throw new Error("external file update time is current");
  if (row.semanticContext !== undefined) {
    if (row.subkind !== "data") throw new Error("only a data file has semantic context");
    if (!currentSemanticContext(row.semanticContext)) {
      throw new Error("external file semantic context is canonical bounded text");
    }
  }
  return row as unknown as ExternalFile;
};

export const isStoredExternalFile = (value: unknown): value is ExternalFile => {
  try {
    admitStoredExternalFile(value);
    return true;
  } catch {
    return false;
  }
};
