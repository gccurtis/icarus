import { cellKey, splitCellKey } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { CellRange, CellRef } from "$representation/data/types/content/formula-value";
import type { GridColumn, GridRow, SpreadsheetBody } from "$representation/data/types/spreadsheets/body";

/**
 * Where a cell sits, and what it is called.
 *
 * A body stores rows and columns with ids and an order; everything anybody wants
 * to say about position is derived from that here, once, so a view and a
 * capability answer the same way. `A1` is a label this file computes and never
 * something it stores.
 */
export type Rect = {
  readonly row: number;
  readonly column: number;
  readonly rows: number;
  readonly columns: number;
};

export type Grid = {
  readonly rows: readonly GridRow[];
  readonly columns: readonly GridColumn[];
  readonly rowAt: ReadonlyMap<string, number>;
  readonly columnAt: ReadonlyMap<string, number>;
};

export const EMPTY_GRID: Grid = { rows: [], columns: [], rowAt: new Map(), columnAt: new Map() };

export const gridOf = (body: SpreadsheetBody | undefined): Grid => {
  if (body === undefined) return EMPTY_GRID;
  const rows = [...body.rows].sort((a, b) => a.order - b.order);
  const columns = [...body.columns].sort((a, b) => a.order - b.order);
  return {
    rows,
    columns,
    rowAt: new Map(rows.map((row, index) => [row.id, index])),
    columnAt: new Map(columns.map((column, index) => [column.id, index]))
  };
};

export const columnLabel = (index: number): string => {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

export const columnIndexOf = (label: string): number | undefined => {
  if (!/^[A-Za-z]{1,3}$/.test(label)) return undefined;
  let n = 0;
  for (const char of label.toUpperCase()) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
};

export const keyOf = (ref: CellRef): string => cellKey(ref.rowId, ref.columnId);

export const refOfKey = (key: string): CellRef | undefined => splitCellKey(key);

export const sameRef = (a: CellRef | undefined, b: CellRef | undefined): boolean =>
  a !== undefined && b !== undefined && a.rowId === b.rowId && a.columnId === b.columnId;

export const refAt = (grid: Grid, row: number, column: number): CellRef | undefined => {
  const held = grid.rows[row];
  const across = grid.columns[column];
  return held === undefined || across === undefined
    ? undefined
    : { rowId: held.id, columnId: across.id };
};

export const indexOf = (
  grid: Grid,
  ref: CellRef
): { readonly row: number; readonly column: number } | undefined => {
  const row = grid.rowAt.get(ref.rowId);
  const column = grid.columnAt.get(ref.columnId);
  return row === undefined || column === undefined ? undefined : { row, column };
};

export const labelOf = (grid: Grid, ref: CellRef): string => {
  const at = indexOf(grid, ref);
  return at === undefined ? "?" : `${columnLabel(at.column)}${at.row + 1}`;
};

export const rectOf = (grid: Grid, range: CellRange): Rect | undefined => {
  const from = indexOf(grid, range.from);
  const to = indexOf(grid, range.to);
  if (from === undefined || to === undefined) return undefined;
  return {
    row: Math.min(from.row, to.row),
    column: Math.min(from.column, to.column),
    rows: Math.abs(from.row - to.row) + 1,
    columns: Math.abs(from.column - to.column) + 1
  };
};

export const clamped = (grid: Grid, rect: Rect): Rect | undefined => {
  const row = Math.max(0, rect.row);
  const column = Math.max(0, rect.column);
  const rows = Math.min(rect.row + rect.rows, grid.rows.length) - row;
  const columns = Math.min(rect.column + rect.columns, grid.columns.length) - column;
  return rows <= 0 || columns <= 0 ? undefined : { row, column, rows, columns };
};

export const rangeOf = (grid: Grid, rect: Rect): CellRange | undefined => {
  const fitted = clamped(grid, rect);
  if (fitted === undefined) return undefined;
  const from = refAt(grid, fitted.row, fitted.column);
  const to = refAt(grid, fitted.row + fitted.rows - 1, fitted.column + fitted.columns - 1);
  return from === undefined || to === undefined ? undefined : { from, to };
};

export const rectLabelOf = (grid: Grid, rect: Rect): string => {
  const range = rangeOf(grid, rect);
  if (range === undefined) return "?";
  const from = labelOf(grid, range.from);
  const to = labelOf(grid, range.to);
  return from === to ? from : `${from}:${to}`;
};

export const rangeLabelOf = (grid: Grid, range: CellRange): string => {
  const rect = rectOf(grid, range);
  return rect === undefined ? "?" : rectLabelOf(grid, rect);
};

export const parseRef = (grid: Grid, text: string): CellRef | undefined => {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(text.trim());
  if (match === null) return undefined;
  const column = columnIndexOf(match[1]);
  const row = Number(match[2]) - 1;
  return column === undefined || row < 0 ? undefined : refAt(grid, row, column);
};

export const parseRange = (grid: Grid, text: string): CellRange | undefined => {
  const [first, second, ...rest] = text.split(":");
  if (rest.length > 0 || first === undefined) return undefined;
  const from = parseRef(grid, first);
  if (from === undefined) return undefined;
  if (second === undefined) return { from, to: from };
  const to = parseRef(grid, second);
  return to === undefined ? undefined : { from, to };
};

export const contains = (rect: Rect, row: number, column: number): boolean =>
  row >= rect.row &&
  row < rect.row + rect.rows &&
  column >= rect.column &&
  column < rect.column + rect.columns;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.row < b.row + b.rows &&
  b.row < a.row + a.rows &&
  a.column < b.column + b.columns &&
  b.column < a.column + a.columns;

export const sameRect = (a: Rect, b: Rect): boolean =>
  a.row === b.row && a.column === b.column && a.rows === b.rows && a.columns === b.columns;

export const refsIn = (grid: Grid, rect: Rect): CellRef[] => {
  const fitted = clamped(grid, rect);
  if (fitted === undefined) return [];
  const refs: CellRef[] = [];
  for (let row = fitted.row; row < fitted.row + fitted.rows; row += 1) {
    for (let column = fitted.column; column < fitted.column + fitted.columns; column += 1) {
      const ref = refAt(grid, row, column);
      if (ref !== undefined) refs.push(ref);
    }
  }
  return refs;
};

export const cellsIn = (rect: Rect): number => rect.rows * rect.columns;

export const rectKeyOf = (grid: Grid, rect: Rect): string | undefined => {
  const range = rangeOf(grid, rect);
  return range === undefined ? undefined : `${keyOf(range.from)}:${keyOf(range.to)}`;
};

export const rectOfKey = (grid: Grid, key: string): Rect | undefined => {
  const [from, to] = key.split(":");
  if (from === undefined) return undefined;
  const start = refOfKey(from);
  const end = to === undefined ? start : refOfKey(to);
  return start === undefined || end === undefined ? undefined : rectOf(grid, { from: start, to: end });
};
