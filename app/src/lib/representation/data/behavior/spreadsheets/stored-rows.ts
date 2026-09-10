import { isStoredChangeSet } from "$representation/data/behavior/core/stored-change-set";
import {
  isStoredEditableRow,
  isStoredSnapshotRow
} from "$representation/data/behavior/core/stored-editor-row";
import { isStoredSpreadsheetBody } from "$representation/data/behavior/spreadsheets/stored-body";
import type { TableRow } from "$representation/store/tables";

export const isStoredSpreadsheet = (value: unknown): value is TableRow<"spreadsheets"> =>
  isStoredEditableRow(value, "spreadsheets");

export const isStoredSpreadsheetSnapshotRow = (
  value: unknown
): value is TableRow<"spreadsheetSnapshots"> =>
  isStoredSnapshotRow(
    value,
    "spreadsheetSnapshots",
    "spreadsheets",
    isStoredSpreadsheetBody
  );

export const isStoredSpreadsheetChangeSet = (
  value: unknown
): value is TableRow<"spreadsheetChangeSets"> =>
  isStoredChangeSet(value, {
    table: "spreadsheetChangeSets",
    resourceTable: "spreadsheets",
    setTargets: ["cell", "mark", "formatRule", "sheet"],
    listTargets: ["gridRow", "gridColumn", "formatRule", "mark", "sheet"],
    moveTargets: ["gridRow", "gridColumn"],
    text: false,
    setTargetOptional: false
  });
