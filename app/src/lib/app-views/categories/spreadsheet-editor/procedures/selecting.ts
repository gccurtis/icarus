import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { Selection, SelectionRange } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";
import {
  keyOf,
  refAt,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  CELL,
  RANGE,
  STYLE,
  TEXT,
  VARIABLE
} from "$app-views/categories/spreadsheet-editor/procedures/selection-kinds";
import { spillChildOf } from "$app-views/categories/spreadsheet-editor/procedures/spill-spans";
import { errorOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type { Selection } from "$representation/data/types/workspace/tab";
export type { InspectorView } from "$representation/data/types/workspace/views";

export type Signal = { readonly key: InspectorView; readonly selection: Selection };

/** Which lens answers for a cell: the error it holds, the spill it sits in, or itself. */
export const lensFor = (sheet: LiveSheet, grid: Grid, ref: CellRef): InspectorView => {
  const held = sheet.cells[keyOf(ref)];
  if (errorOf(held) !== undefined) return "spreadsheet-editor.error-cell";
  if (spillChildOf(sheet, grid, ref) !== undefined) return "spreadsheet-editor.spill";
  if (held?.expression !== undefined) return "spreadsheet-editor.cell-with-formula";
  return "spreadsheet-editor.cell";
};

const rangeOfRect = (grid: Grid, rect: Rect): SelectionRange | undefined => {
  const from = refAt(grid, rect.row, rect.column);
  const to = refAt(grid, rect.row + rect.rows - 1, rect.column + rect.columns - 1);
  return from === undefined || to === undefined ? undefined : { id: keyOf(from), at: keyOf(to) };
};

export const cellSignal = (
  sheet: LiveSheet,
  grid: Grid,
  ref: CellRef,
  others?: readonly CellRef[]
): Signal => ({
  key: lensFor(sheet, grid, ref),
  selection:
    others === undefined || others.length === 0
      ? { kind: CELL, id: keyOf(ref) }
      : { kind: CELL, id: keyOf(ref), ranges: others.map((held) => ({ id: keyOf(held), at: keyOf(held) })) }
});

/**
 * A range, anchored where the drag began.
 *
 * The anchor is kept because a range is read from one of its corners: the cell
 * the reader is standing on stays theirs while the opposite corner moves, and
 * an anchor outside the rectangle means the range was made some other way.
 */
export const rangeSignal = (
  grid: Grid,
  rects: readonly Rect[],
  anchor?: readonly [column: number, row: number]
): Signal | undefined => {
  const [primary, ...rest] = rects;
  if (primary === undefined) return undefined;
  const corners = rangeOfRect(grid, primary);
  if (corners === undefined) return undefined;

  const anchorRef = anchor === undefined ? undefined : refAt(grid, anchor[1], anchor[0]);
  const anchorInside =
    anchor !== undefined &&
    anchor[1] >= primary.row &&
    anchor[1] < primary.row + primary.rows &&
    anchor[0] >= primary.column &&
    anchor[0] < primary.column + primary.columns;
  const opposite =
    anchor === undefined || !anchorInside
      ? undefined
      : refAt(
          grid,
          anchor[1] === primary.row ? primary.row + primary.rows - 1 : primary.row,
          anchor[0] === primary.column ? primary.column + primary.columns - 1 : primary.column
        );
  const id = anchorRef !== undefined && anchorInside ? keyOf(anchorRef) : corners.id;
  const at = opposite !== undefined ? keyOf(opposite) : corners.at;

  const ranges = rest
    .map((rect) => rangeOfRect(grid, rect))
    .filter((held): held is SelectionRange => held !== undefined);
  return {
    key: "spreadsheet-editor.range",
    selection: ranges.length === 0 ? { kind: RANGE, id, at } : { kind: RANGE, id, at, ranges }
  };
};

const trackSignal = (
  kind: "row" | "column",
  key: InspectorView,
  ids: readonly string[]
): Signal | undefined => {
  const [first, ...rest] = ids;
  if (first === undefined) return undefined;
  return {
    key,
    selection:
      rest.length === 0 ? { kind, id: first } : { kind, id: first, ranges: rest.map((id) => ({ id, at: id })) }
  };
};

export const rowSignal = (grid: Grid, rows: readonly number[]): Signal | undefined =>
  trackSignal(
    "row",
    "spreadsheet-editor.row",
    [...rows].sort((a, b) => a - b).flatMap((index) => (grid.rows[index] ? [grid.rows[index].id] : []))
  );

export const columnSignal = (grid: Grid, columns: readonly number[]): Signal | undefined =>
  trackSignal(
    "column",
    "spreadsheet-editor.column",
    [...columns]
      .sort((a, b) => a - b)
      .flatMap((index) => (grid.columns[index] ? [grid.columns[index].id] : []))
  );

export const styleSignal = (key: string): Signal => ({
  key: "spreadsheet-editor.named-style",
  selection: { kind: STYLE, id: key }
});

export const variableSignal = (name: string): Signal => ({
  key: "spreadsheet-editor.variable",
  selection: { kind: VARIABLE, id: name }
});

export const textSignal = (ref: CellRef, from: number, to: number): Signal => ({
  key: "spreadsheet-editor.text-selection",
  selection: { kind: TEXT, id: `${keyOf(ref)}@${from}`, at: `${keyOf(ref)}@${to}` }
});
