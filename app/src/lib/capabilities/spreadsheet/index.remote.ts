import { command, query } from "$app/server";

import { readSpreadsheet as readSpreadsheetProcedure } from "$capabilities/spreadsheet/api/read-spreadsheet/read-spreadsheet";
import { submitSpreadsheetChanges as submitSpreadsheetChangesProcedure } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/submit-spreadsheet-changes";

export const readSpreadsheet = query("unchecked", readSpreadsheetProcedure);
export const submitSpreadsheetChanges = command("unchecked", submitSpreadsheetChangesProcedure);

export type {
  ReadSpreadsheetInput,
  ReadSpreadsheetResult
} from "$capabilities/spreadsheet/types/read-spreadsheet";
export type {
  SubmitSpreadsheetChangesInput,
  SubmitSpreadsheetChangesResult
} from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";
