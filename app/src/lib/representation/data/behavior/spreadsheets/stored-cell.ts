import {
  currentFormulaValue,
  currentMark
} from "$representation/data/behavior/content/admission";
import { isStoredCellFormat } from "$representation/data/behavior/content/stored-format";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const TOKENS = [
  "#DIV/0!", "#VALUE!", "#NAME?", "#REF!", "#NUM!", "#N/A", "#NULL!",
  "#ERROR!", "#CYCLE!", "#FIELD?", "#INDEX!", "#SHAPE!"
] as const;

const isStoredCellRef = (value: unknown): boolean => {
  const ref = storedFields(value);
  return ref !== undefined &&
    hasExactFields(ref, ["rowId", "columnId"]) &&
    isStoredIdentifier(ref.rowId) &&
    isStoredIdentifier(ref.columnId);
};

const isStoredFailure = (value: unknown): boolean => {
  const failure = storedFields(value);
  if (
    failure === undefined ||
    !hasExactFields(failure, ["token"], ["word", "at"]) ||
    !TOKENS.includes(failure.token as typeof TOKENS[number]) ||
    (failure.word !== undefined && !isStoredText(failure.word, 10_000))
  ) return false;
  if (failure.at === undefined) return true;
  const origin = storedFields(failure.at);
  return origin !== undefined &&
    hasExactFields(origin, ["resourceId", "rowId", "columnId"]) &&
    isStoredRowId(origin.resourceId, "spreadsheets") &&
    isStoredIdentifier(origin.rowId) &&
    isStoredIdentifier(origin.columnId);
};

export const isStoredSheetCell = (value: unknown): value is TableRow<"sheetCells"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "resourceId", "rowOrder", "rowId",
        "columnId", "value"
      ],
      [
        "expression", "anchors", "formulaId", "failure", "marks", "format", "mergedTo",
        "spillTo"
      ]
    ) &&
    isStoredRowId(row._id, "sheetCells") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.resourceId, "spreadsheets") &&
    isStoredFinite(row.rowOrder) &&
    isStoredIdentifier(row.rowId) &&
    isStoredIdentifier(row.columnId) &&
    currentFormulaValue(row.value) &&
    (row.expression === undefined || isStoredText(row.expression, 10_000)) &&
    (row.anchors === undefined || (
      Array.isArray(row.anchors) && row.anchors.every((anchor) => isStoredText(anchor, 100))
    )) &&
    (row.formulaId === undefined || isStoredRowId(row.formulaId, "formulas")) &&
    (row.failure === undefined || isStoredFailure(row.failure)) &&
    (row.marks === undefined || (
      Array.isArray(row.marks) && row.marks.every(currentMark)
    )) &&
    (row.format === undefined || isStoredCellFormat(row.format)) &&
    (row.mergedTo === undefined || isStoredCellRef(row.mergedTo)) &&
    (row.spillTo === undefined || isStoredCellRef(row.spillTo));
};
