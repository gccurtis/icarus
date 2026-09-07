import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  indexOf,
  labelOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { shownOf, type SheetFacts } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { displayOf, errorOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type FormulaRow = {
  readonly ref: CellRef;
  readonly cell: SheetCell;
  readonly label: string;
  readonly shows: string;
  readonly expression: string;
  readonly error: string | undefined;
};

const ordered = (grid: Grid, a: CellRef, b: CellRef): number => {
  const left = indexOf(grid, a);
  const right = indexOf(grid, b);
  return (left?.row ?? 0) - (right?.row ?? 0) || (left?.column ?? 0) - (right?.column ?? 0);
};

export const formulaRows = (sheet: LiveSheet, facts: SheetFacts): FormulaRow[] => {
  const grid = facts.grid;
  return Object.values(sheet.cells)
    .filter((cell) => cell.expression !== undefined)
    .map((cell) => {
      const ref = { rowId: cell.rowId, columnId: cell.columnId };
      const paint = paintOf(sheet.body, grid, ref, cell);
      const shown = displayOf(cell.value, paint.format.valueFormat);
      const failure = errorOf(cell);
      return {
        ref,
        cell,
        label: labelOf(grid, ref),
        shows: failure ?? (shown === "" ? "not evaluated yet" : shown),
        expression: shownOf(facts, cell),
        error: failure
      };
    })
    .filter((row) => indexOf(grid, row.ref) !== undefined)
    .sort((a, b) => ordered(grid, a.ref, b.ref));
};

export const matchesFilter = (row: FormulaRow, filter: string): boolean => {
  const needle = filter.trim().toLowerCase();
  if (needle === "") return true;
  return (
    row.label.toLowerCase().includes(needle) ||
    row.expression.toLowerCase().includes(needle) ||
    row.shows.toLowerCase().includes(needle)
  );
};
