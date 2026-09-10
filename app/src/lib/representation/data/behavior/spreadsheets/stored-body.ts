import { isStoredCellFormat, isStoredPageSetup, isStoredSpreadsheetStyles } from "$representation/data/behavior/content/stored-format";
import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredNatural,
  storedFields
} from "$representation/data/behavior/core/stored";
import type {
  CellRange,
  CellRef
} from "$representation/data/types/content/formula-value";
import type {
  FormatRule,
  GridColumn,
  GridRow,
  SheetPrint,
  SpreadsheetBody
} from "$representation/data/types/spreadsheets/body";

const isStoredCellRef = (value: unknown): value is CellRef => {
  const ref = storedFields(value);
  return ref !== undefined &&
    hasExactFields(ref, ["rowId", "columnId"]) &&
    isStoredIdentifier(ref.rowId) &&
    isStoredIdentifier(ref.columnId);
};

const isStoredCellRange = (value: unknown): value is CellRange => {
  const range = storedFields(value);
  return range !== undefined &&
    hasExactFields(range, ["from", "to"]) &&
    isStoredCellRef(range.from) &&
    isStoredCellRef(range.to);
};

const isStoredRow = (value: unknown): value is GridRow => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, ["id", "order"], ["height"]) &&
    isStoredIdentifier(row.id) &&
    isStoredFinite(row.order) &&
    (row.height === undefined || isStoredFinite(row.height));
};

const isStoredColumn = (value: unknown): value is GridColumn => {
  const column = storedFields(value);
  return column !== undefined &&
    hasExactFields(column, ["id", "order"], ["width"]) &&
    isStoredIdentifier(column.id) &&
    isStoredFinite(column.order) &&
    (column.width === undefined || isStoredFinite(column.width));
};

const isStoredFormatRule = (value: unknown): value is FormatRule => {
  const rule = storedFields(value);
  return rule !== undefined &&
    hasExactFields(rule, ["id", "from", "to"], ["style", "format"]) &&
    isStoredIdentifier(rule.id) &&
    isStoredCellRef(rule.from) &&
    isStoredCellRef(rule.to) &&
    (rule.style === undefined || isStoredIdentifier(rule.style)) &&
    (rule.format === undefined || isStoredCellFormat(rule.format));
};

const isStoredPrint = (value: unknown): value is SheetPrint => {
  const print = storedFields(value);
  return print !== undefined &&
    hasExactFields(
      print,
      ["page"],
      ["area", "repeatRows", "repeatColumns", "scale", "gridlines", "headings"]
    ) &&
    isStoredPageSetup(print.page) &&
    (print.area === undefined || isStoredCellRange(print.area)) &&
    (print.repeatRows === undefined || (
      Array.isArray(print.repeatRows) &&
      print.repeatRows.every((rowId) => isStoredIdentifier(rowId))
    )) &&
    (print.repeatColumns === undefined || (
      Array.isArray(print.repeatColumns) &&
      print.repeatColumns.every((columnId) => isStoredIdentifier(columnId))
    )) &&
    (print.scale === undefined ||
      print.scale === "fit-width" ||
      print.scale === "fit-page" ||
      isStoredFinite(print.scale)) &&
    (print.gridlines === undefined || typeof print.gridlines === "boolean") &&
    (print.headings === undefined || typeof print.headings === "boolean");
};

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

/** Exact current spreadsheet body admission; malformed partial bodies are unavailable. */
export const isStoredSpreadsheetBody = (value: unknown): value is SpreadsheetBody => {
  const body = storedFields(value);
  if (
    body === undefined ||
    !hasExactFields(
      body,
      ["rows", "columns", "rowPartCounts", "formatRules", "print", "styles"],
      ["frozenRows", "frozenColumns"]
    ) ||
    !Array.isArray(body.rows) ||
    !body.rows.every(isStoredRow) ||
    !Array.isArray(body.columns) ||
    !body.columns.every(isStoredColumn) ||
    !Array.isArray(body.rowPartCounts) ||
    !body.rowPartCounts.every(isStoredNatural) ||
    body.rowPartCounts.reduce((total, count) => total + count, 0) !== body.rows.length ||
    !Array.isArray(body.formatRules) ||
    !body.formatRules.every(isStoredFormatRule) ||
    !isStoredPrint(body.print) ||
    !isStoredSpreadsheetStyles(body.styles) ||
    (body.frozenRows !== undefined && !isStoredNatural(body.frozenRows)) ||
    (body.frozenColumns !== undefined && !isStoredNatural(body.frozenColumns))
  ) return false;

  const rowIds = body.rows.map((row) => row.id);
  const columnIds = body.columns.map((column) => column.id);
  const print = body.print;
  const styles = Object.keys((body.styles as SpreadsheetBody["styles"]).styles);
  const rangeExists = (range: CellRange): boolean =>
    rowIds.includes(range.from.rowId) &&
    rowIds.includes(range.to.rowId) &&
    columnIds.includes(range.from.columnId) &&
    columnIds.includes(range.to.columnId);
  return unique(rowIds) &&
    unique(columnIds) &&
    unique(body.formatRules.map((rule) => rule.id)) &&
    body.formatRules.every(
      (rule) => rangeExists(rule) && (rule.style === undefined || styles.includes(rule.style))
    ) &&
    (print.area === undefined || rangeExists(print.area)) &&
    (body.frozenRows === undefined || body.frozenRows <= rowIds.length) &&
    (body.frozenColumns === undefined || body.frozenColumns <= columnIds.length) &&
    (print.repeatRows === undefined || print.repeatRows.every((id) => rowIds.includes(id))) &&
    (print.repeatColumns === undefined || print.repeatColumns.every((id) => columnIds.includes(id)));
};
