import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  indexOf,
  keyOf,
  refsIn,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { formatNumber } from "$app-views/categories/spreadsheet-editor/procedures/values";

export const usedRect = (sheet: LiveSheet, grid: Grid): Rect | undefined => {
  let top = Infinity;
  let left = Infinity;
  let bottom = -1;
  let right = -1;
  for (const cell of Object.values(sheet.cells)) {
    const at = indexOf(grid, { rowId: cell.rowId, columnId: cell.columnId });
    if (at === undefined) continue;
    top = Math.min(top, at.row);
    left = Math.min(left, at.column);
    bottom = Math.max(bottom, at.row);
    right = Math.max(right, at.column);
  }
  return bottom === -1 ? undefined : { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 };
};

export const populatedCount = (sheet: LiveSheet, grid: Grid): number =>
  Object.values(sheet.cells).filter(
    (cell) => indexOf(grid, { rowId: cell.rowId, columnId: cell.columnId }) !== undefined
  ).length;

export const formulaCount = (sheet: LiveSheet): number =>
  Object.values(sheet.cells).filter((cell) => cell.expression !== undefined).length;

export type Aggregate = {
  readonly cells: number;
  readonly filled: number;
  readonly numbers: number;
  readonly sum: number;
  readonly average: number | undefined;
  readonly deviation: number | undefined;
  readonly min: number | undefined;
  readonly max: number | undefined;
};

export const aggregateOf = (sheet: LiveSheet, grid: Grid, rects: readonly Rect[]): Aggregate => {
  const seen = new Set<string>();
  let filled = 0;
  const numbers: number[] = [];
  for (const rect of rects) {
    for (const ref of refsIn(grid, rect)) {
      const key = keyOf(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      const held = sheet.cells[key];
      if (held === undefined || held.value.kind === "empty") continue;
      filled += 1;
      if (held.value.kind === "number") numbers.push(held.value.value);
    }
  }
  const sum = numbers.reduce((total, value) => total + value, 0);
  const average = numbers.length === 0 ? undefined : sum / numbers.length;
  const deviation =
    average === undefined
      ? undefined
      : Math.sqrt(numbers.reduce((total, value) => total + (value - average) ** 2, 0) / numbers.length);
  return {
    cells: seen.size,
    filled,
    numbers: numbers.length,
    sum,
    average,
    deviation,
    min: numbers.length === 0 ? undefined : Math.min(...numbers),
    max: numbers.length === 0 ? undefined : Math.max(...numbers)
  };
};

export const figure = (value: number): string =>
  Number.isInteger(value) ? formatNumber(value, "#,##0") : formatNumber(value, "#,##0.00");
