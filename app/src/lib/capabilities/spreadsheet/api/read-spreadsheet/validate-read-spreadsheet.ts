import type { ReadSpreadsheetInput } from "$capabilities/spreadsheet/types/read-spreadsheet";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

export const validateReadSpreadsheet = (input: unknown): ReadSpreadsheetInput => {
  const fields = storedFields(input);
  if (fields === undefined) {
    throw new Error("spreadsheet/read-spreadsheet: an exact data object is required");
  }
  if (!Object.hasOwn(fields, "resourceId")) {
    throw new Error("spreadsheet/read-spreadsheet: resourceId is required");
  }
  if (!hasExactFields(fields, ["resourceId"])) {
    throw new Error("spreadsheet/read-spreadsheet: resourceId is the only current field");
  }
  if (!isStoredRowId(fields.resourceId, "spreadsheets")) {
    throw new Error(
      "spreadsheet/read-spreadsheet: resourceId must be one current spreadsheets row id"
    );
  }

  return { resourceId: fields.resourceId };
};
