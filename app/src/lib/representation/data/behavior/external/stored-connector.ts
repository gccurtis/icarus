import {
  hasExactFields,
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const request = (value: unknown): boolean => {
  const held = storedFields(value);
  const headers = storedFields(held?.headers);
  return held !== undefined &&
    hasExactFields(held, ["url", "method"], ["headers", "body"]) &&
    isStoredText(held.url, 10_000) && held.url.length > 0 &&
    (held.method === "GET" || held.method === "POST") &&
    (held.headers === undefined || (
      headers !== undefined && Object.entries(headers).every(
        ([name, content]) => name.length > 0 && name.length <= 500 && isStoredText(content, 10_000)
      )
    )) &&
    (held.body === undefined || isStoredText(held.body));
};

const configuration = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "provider") {
    return hasExactFields(held, ["kind", "provider", "selection"]) &&
      (
        held.provider === "microsoftGraph" || held.provider === "googleDrive" ||
        held.provider === "dropbox" || held.provider === "notion" || held.provider === "s3"
      ) &&
      isStoredText(held.selection, 10_000) && held.selection.length > 0;
  }
  const output = storedFields(held.output);
  return held.kind === "api" &&
    hasExactFields(held, ["kind", "request", "output"]) &&
    request(held.request) &&
    output !== undefined &&
    hasExactFields(output, ["name", "mediaType"]) &&
    isStoredText(output.name, 500) && output.name.length > 0 &&
    isStoredText(output.mediaType, 500) && output.mediaType.length > 0;
};

const credential = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    hasExactFields(held, ["secret", "keyVersion", "scopes"], ["expiresAt"]) &&
    isStoredText(held.secret) && held.secret.length > 0 &&
    isStoredNatural(held.keyVersion) && held.keyVersion >= 1 &&
    (held.expiresAt === undefined || isStoredTime(held.expiresAt)) &&
    Array.isArray(held.scopes) &&
    held.scopes.every((scope) => isStoredText(scope, 500) && scope.length > 0) &&
    new Set(held.scopes).size === held.scopes.length;
};

/** One exact current connector row, including its closed configuration union. */
export const isStoredConnector = (value: unknown): value is TableRow<"connectors"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "name", "configuration", "createdBy", "updatedAt"],
      ["credential", "refreshIntervalMs"]
    ) &&
    isStoredRowId(row._id, "connectors") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.name, 500) && row.name.trim().length > 0 &&
    configuration(row.configuration) &&
    (row.credential === undefined || credential(row.credential)) &&
    (row.refreshIntervalMs === undefined || (
      isStoredNatural(row.refreshIntervalMs) && row.refreshIntervalMs > 0
    )) &&
    isStoredActor(row.createdBy) &&
    isStoredTime(row.updatedAt);
};
