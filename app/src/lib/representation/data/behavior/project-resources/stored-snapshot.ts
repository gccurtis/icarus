import { isStoredDocumentBody } from "$representation/data/behavior/documents/stored-body";
import { isStoredPresentationBody } from "$representation/data/behavior/presentations/stored-body";
import { isStoredSpreadsheetBody } from "$representation/data/behavior/spreadsheets/stored-body";
import {
  hasExactFields,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableName, TableRow } from "$representation/store/tables";

export type SnapshotTable =
  | "documentSnapshots"
  | "presentationSnapshots"
  | "spreadsheetSnapshots";

export type StoredSnapshot =
  | TableRow<"documentSnapshots">
  | TableRow<"presentationSnapshots">
  | TableRow<"spreadsheetSnapshots">;

const TARGETS: Record<SnapshotTable, string> = {
  documentSnapshots: "documents",
  presentationSnapshots: "presentations",
  spreadsheetSnapshots: "spreadsheets"
};

const currentRole = (value: unknown): boolean =>
  value === "base" || value === "leader" || value === "checkpoint";

export const isStoredSnapshot = (
  value: unknown,
  table: SnapshotTable
): value is StoredSnapshot => {
  const row = storedFields(value);
  if (
    row === undefined ||
    !hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "resourceId", "revision", "role", "part", "body", "at"]
    ) ||
    !isStoredRowId(row._id, table) ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredRowId(row.resourceId, TARGETS[table] as "documents" | "presentations" | "spreadsheets") ||
    !isStoredNatural(row.revision) ||
    !currentRole(row.role) ||
    !isStoredNatural(row.part) ||
    !isStoredTime(row.at)
  ) return false;
  if (table === "documentSnapshots") return isStoredDocumentBody(row.body);
  if (table === "presentationSnapshots") return isStoredPresentationBody(row.body);
  return isStoredSpreadsheetBody(row.body);
};

export const snapshotTable = (value: TableName | undefined): SnapshotTable | undefined =>
  value === "documentSnapshots" || value === "presentationSnapshots" || value === "spreadsheetSnapshots"
    ? value
    : undefined;
