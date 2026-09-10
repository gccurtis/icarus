import {
  externalFileNameIn,
  externalRelativePathWithin,
  fileSubkindFor
} from "$representation/data/behavior/external/file";
import type { Actor } from "$representation/data/types/core/actor";
import type { ExternalFileOrigin, FileSubkind } from "$representation/data/types/external/file";
import type { ExternalFile } from "$representation/store/tables";

const FIELDS = new Set([
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
  "semanticContext",
  "revision",
  "updatedAt"
]);

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is an object`);
  }
  return value as Record<string, unknown>;
};

const exactFields = (value: Record<string, unknown>): void => {
  const unexpected = Object.keys(value).find((field) => !FIELDS.has(field));
  if (unexpected !== undefined) throw new Error(`external file has unexpected field '${unexpected}'`);
  const missing = [...FIELDS]
    .filter((field) => field !== "semanticContext")
    .find((field) => !(field in value));
  if (missing !== undefined) throw new Error(`external file is missing required field '${missing}'`);
};

const canonicalRowId = (value: unknown, table: string): string => {
  const prefix = `${table}:`;
  if (
    typeof value !== "string" ||
    !value.startsWith(prefix) ||
    value.length <= prefix.length ||
    value.length > 500 ||
    /[.:\s]/.test(value.slice(prefix.length))
  ) throw new Error(`external file ${table} id is canonical`);
  return value;
};

/** Project and actor ids are opaque Store identities; current rows need not use a table prefix. */
const opaqueIdentity = (value: unknown, label: string): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 500 ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    /[\u0000-\u001f\u007f\s]/.test(value)
  ) throw new Error(`${label} is a canonical bounded identity`);
  return value;
};

const finiteTime = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is finite and non-negative`);
  }
  return value;
};

const positiveRevision = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error("external file revision is a positive safe integer");
  }
  return value as number;
};

const size = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("external file size is a non-negative safe integer");
  }
  return value as number;
};

const name = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new Error(`${label} is text`);
  if (
    value.length === 0 ||
    value.length > 240 ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    value.includes("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) throw new Error(`${label} is canonical and contains no path or control characters`);
  return value;
};

const actor = (value: unknown): Actor => {
  const held = record(value, "external file actor");
  if (held.kind === "system" && Object.keys(held).length === 1) return { kind: "system" };
  const identity = held.kind === "user"
    ? ["userId", "users"]
    : held.kind === "connector"
      ? ["connectorId", "connectors"]
      : held.kind === "agent"
        ? ["taskId", "agentTasks"]
        : undefined;
  if (identity === undefined || Object.keys(held).length !== 2) {
    throw new Error("external file actor is represented");
  }
  opaqueIdentity(held[identity[0]], `external file ${identity[1]} id`);
  return held as Actor;
};

const origin = (value: unknown): ExternalFileOrigin => {
  const held = record(value, "external file origin");
  if (held.kind === "upload" && Object.keys(held).length === 1) return { kind: "upload" };
  if (
    held.kind !== "connector" ||
    Object.keys(held).length !== 3 ||
    typeof held.sourceId !== "string" ||
    held.sourceId.length === 0 ||
    held.sourceId.length > 500 ||
    held.sourceId !== held.sourceId.trim()
  ) throw new Error("external file origin is represented");
  opaqueIdentity(held.connectorId, "external file connectors id");
  return held as ExternalFileOrigin;
};

const subkind = (value: unknown): FileSubkind => {
  if (
    value !== "text" &&
    value !== "code" &&
    value !== "data" &&
    value !== "image" &&
    value !== "audio" &&
    value !== "video" &&
    value !== "unknown"
  ) throw new Error("external file subkind is current and represented");
  return value;
};

/** Admits the one current External row schema; no defaults or migrations exist. */
export const admitExternalFileRow = (value: unknown, maxPathBytes: number): ExternalFile => {
  const held = record(value, "external file");
  exactFields(held);
  const id = canonicalRowId(held._id, "externalFiles");
  const projectId = opaqueIdentity(held.projectId, "external file project id");
  const currentName = name(held.name, "external file name");
  name(held.originalName, "external file original name");
  if (typeof held.relativePath !== "string") {
    throw new Error("external file relative path is text");
  }
  const relativePath = externalRelativePathWithin(held.relativePath, maxPathBytes);
  if (externalFileNameIn(relativePath) !== currentName) {
    throw new Error("external file path leaf must equal its name");
  }
  if (
    typeof held.mediaType !== "string" ||
    held.mediaType.length === 0 ||
    held.mediaType.length > 200 ||
    held.mediaType !== held.mediaType.trim() ||
    !/^[\x20-\x7e]+$/.test(held.mediaType)
  ) throw new Error("external file media type is bounded ASCII text");
  const hash = typeof held.hash === "string" && /^[a-f0-9]{64}$/.test(held.hash)
    ? held.hash
    : undefined;
  if (hash === undefined) throw new Error("external file hash is lowercase SHA-256");
  if (held.storageId !== `_storage:${hash}`) {
    throw new Error("external file storage id matches its SHA-256 hash");
  }
  const currentSubkind = subkind(held.subkind);
  if (fileSubkindFor(held.mediaType, currentName) !== currentSubkind) {
    throw new Error("external file subkind agrees with its admitted media type and name");
  }
  size(held.size);
  positiveRevision(held.revision);
  finiteTime(held._creationTime, "external file creation time");
  finiteTime(held.updatedAt, "external file update time");
  actor(held.createdBy);
  actor(held.updatedBy);
  origin(held.origin);
  if (
    held.semanticContext !== undefined &&
    (typeof held.semanticContext !== "string" ||
      held.semanticContext.length === 0 ||
      held.semanticContext.length > 4_000 ||
      held.semanticContext !== held.semanticContext.trim() ||
      held.semanticContext !== held.semanticContext.normalize("NFC") ||
      held.semanticContext.includes("\u0000"))
  ) throw new Error("external file semantic context is canonical bounded text");
  void id;
  void projectId;
  return held as unknown as ExternalFile;
};
