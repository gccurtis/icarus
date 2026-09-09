import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { DEFAULT_FONT_SIZE } from "$app-views/categories/spreadsheet-editor/procedures/format-options";
import { paintOf, sizeOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT
} from "$app-views/categories/spreadsheet-editor/procedures/structure";
import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

const GLYPH = 7.2;
const PADDING = 18;

export const resizedColumn = (
  grid: Grid,
  id: string,
  width: number
): SpreadsheetOp | undefined => {
  const held = grid.columns.find((column) => column.id === id);
  if (held === undefined) return undefined;
  const next = Math.max(24, Math.round(width));
  if ((held.width ?? DEFAULT_COLUMN_WIDTH) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: `columns/${id}/width`,
    value: next,
    was: held.width ?? null
  };
};

export const resizedRow = (
  grid: Grid,
  id: string,
  height: number
): SpreadsheetOp | undefined => {
  const held = grid.rows.find((row) => row.id === id);
  if (held === undefined) return undefined;
  const next = Math.max(16, Math.round(height));
  if ((held.height ?? DEFAULT_ROW_HEIGHT) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: `rows/${id}/height`,
    value: next,
    was: held.height ?? null
  };
};

export const fittedColumn = (
  sheet: LiveSheet,
  grid: Grid,
  id: string
): SpreadsheetOp | undefined => {
  let longest = 0;
  for (const cell of Object.values(sheet.cells)) {
    if (cell.columnId !== id) continue;
    const ref = { rowId: cell.rowId, columnId: cell.columnId };
    const paint = paintOf(sheet.body, grid, ref, cell);
    const text = displayOf(cell.value, paint.format.valueFormat) || (cell.expression ?? "");
    const glyph = (GLYPH * (sizeOf(paint) ?? DEFAULT_FONT_SIZE)) / DEFAULT_FONT_SIZE;
    longest = Math.max(longest, text.length * glyph);
  }
  return resizedColumn(grid, id, Math.min(480, Math.max(48, Math.round(longest + PADDING))));
};

export const fittedRow = (
  sheet: LiveSheet,
  grid: Grid,
  id: string
): SpreadsheetOp | undefined => {
  let tallest = DEFAULT_FONT_SIZE;
  for (const cell of Object.values(sheet.cells)) {
    if (cell.rowId !== id) continue;
    const paint = paintOf(
      sheet.body,
      grid,
      { rowId: cell.rowId, columnId: cell.columnId },
      cell
    );
    tallest = Math.max(tallest, sizeOf(paint) ?? DEFAULT_FONT_SIZE);
  }
  return resizedRow(grid, id, Math.max(DEFAULT_ROW_HEIGHT, Math.round(tallest * 1.4 + 8)));
};
