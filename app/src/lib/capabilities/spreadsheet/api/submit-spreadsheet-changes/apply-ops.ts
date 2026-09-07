import { applyOps as applySpreadsheetOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export const applyOps = (sheet: LiveSheet, ops: readonly SpreadsheetOp[]): LiveSheet => {
  try {
    return applySpreadsheetOps(sheet, ops);
  } catch (error) {
    throw new Error(
      `spreadsheet/submit-spreadsheet-changes ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
