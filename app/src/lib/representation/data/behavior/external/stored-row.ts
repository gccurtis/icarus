import {
  hasExactFields,
  isStoredActor,
  isStoredIdentifier,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isExternalFileSubkind } from "$representation/data/behavior/core/resource";
import type { TableRow } from "$representation/store/tables";

const origin = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "upload") return hasExactFields(held, ["kind"]);
  return held.kind === "connector" &&
    hasExactFields(held, ["kind", "connectorId", "sourceId"]) &&
    isStoredRowId(held.connectorId, "connectors") && isStoredIdentifier(held.sourceId);
};

/** Exact current external-file metadata; native bytes remain in the storage model. */
export const isStoredExternalFile = (
  value: unknown
): value is TableRow<"externalFiles"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "name", "mediaType", "subkind", "storageId",
    "hash", "origin", "createdBy", "updatedAt"
  ]) && isStoredRowId(row._id, "externalFiles") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredText(row.name, 10_000) &&
    row.name.length > 0 && isStoredText(row.mediaType, 1_000) &&
    isExternalFileSubkind(row.subkind) &&
    isStoredRowId(row.storageId, "_storage") && isStoredText(row.hash, 1_000) &&
    row.hash.length > 0 && origin(row.origin) && isStoredActor(row.createdBy) &&
    isStoredTime(row.updatedAt);
};
