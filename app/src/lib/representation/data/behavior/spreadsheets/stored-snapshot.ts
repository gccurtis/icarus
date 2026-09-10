import {
  hasExactFields,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredSpreadsheetBody } from "$representation/data/behavior/spreadsheets/stored-body";
import type { TableRow } from "$representation/store/tables";

/** Exact current spreadsheet snapshot admission, including its complete body. */
export const isStoredSpreadsheetSnapshot = (
  value: unknown
): value is TableRow<"spreadsheetSnapshots"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "resourceId", "revision", "role", "part", "body", "at"
  ]) && isStoredRowId(row._id, "spreadsheetSnapshots") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredRowId(row.resourceId, "spreadsheets") &&
    isStoredNatural(row.revision) &&
    (row.role === "base" || row.role === "leader" || row.role === "checkpoint") &&
    isStoredNatural(row.part) && isStoredSpreadsheetBody(row.body) && isStoredTime(row.at);
};
