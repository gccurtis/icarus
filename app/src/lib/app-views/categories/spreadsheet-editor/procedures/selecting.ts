import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { Selection, SelectionRange } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";
import type { SurfaceSelection } from "$authored-components/sheet-surface";
import {
  indexOf,
  keyOf,
  refAt,
  refOfKey,
  rectOf,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { spillChildOf } from "$app-views/categories/spreadsheet-editor/procedures/spans";
import { errorOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type { Selection } from "$representation/data/types/workspace/tab";
export type { InspectorView } from "$representation/data/types/workspace/views";

export type Signal = { readonly key: InspectorView; readonly selection: Selection };

export const CELL = "cell";
export const RANGE = "range";
export const ROW = "row";
export const COLUMN = "column";
export const STYLE = "named-style";
export const TEXT = "text-selection";
export const COMMENT = "comment";
export const VARIABLE = "variable";

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

const rectOfRange = (grid: Grid, range: SelectionRange): Rect | undefined => {
  const from = refOfKey(range.id);
  const to = refOfKey(range.at);
  return from === undefined || to === undefined ? undefined : rectOf(grid, { from, to });
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

  const ranges = rest.map((rect) => rangeOfRect(grid, rect)).filter((held): held is SelectionRange => held !== undefined);
  return {
    key: "spreadsheet-editor.range",
    selection: ranges.length === 0 ? { kind: RANGE, id, at } : { kind: RANGE, id, at, ranges }
  };
};

const trackSignal = (
  kind: typeof ROW | typeof COLUMN,
  key: InspectorView,
  ids: readonly string[]
): Signal | undefined => {
  const [first, ...rest] = ids;
  if (first === undefined) return undefined;
  return {
    key,
    selection: rest.length === 0 ? { kind, id: first } : { kind, id: first, ranges: rest.map((id) => ({ id, at: id })) }
  };
};

export const rowSignal = (grid: Grid, rows: readonly number[]): Signal | undefined =>
  trackSignal(
    ROW,
    "spreadsheet-editor.row",
    [...rows].sort((a, b) => a - b).flatMap((index) => (grid.rows[index] ? [grid.rows[index].id] : []))
  );

export const columnSignal = (grid: Grid, columns: readonly number[]): Signal | undefined =>
  trackSignal(
    COLUMN,
    "spreadsheet-editor.column",
    [...columns].sort((a, b) => a - b).flatMap((index) => (grid.columns[index] ? [grid.columns[index].id] : []))
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

export const selectedRef = (selection: Selection | undefined): CellRef | undefined =>
  selection?.kind === CELL ? refOfKey(selection.id) : undefined;

export const highlightedRefs = (selection: Selection | undefined): CellRef[] =>
  selection?.kind === CELL
    ? (selection.ranges ?? []).flatMap((range) => {
        const ref = refOfKey(range.id);
        return ref === undefined ? [] : [ref];
      })
    : [];

const trackIds = (selection: Selection): string[] => [selection.id, ...(selection.ranges ?? []).map((range) => range.id)];

export const selectedRects = (grid: Grid, selection: Selection | undefined): Rect[] => {
  if (selection === undefined) return [];
  if (selection.kind === CELL) {
    const ref = refOfKey(selection.id);
    const at = ref === undefined ? undefined : indexOf(grid, ref);
    return at === undefined ? [] : [{ row: at.row, column: at.column, rows: 1, columns: 1 }];
  }
  if (selection.kind === RANGE) {
    const ranges: SelectionRange[] = [{ id: selection.id, at: selection.at ?? selection.id }, ...(selection.ranges ?? [])];
    return ranges.flatMap((range) => {
      const rect = rectOfRange(grid, range);
      return rect === undefined ? [] : [rect];
    });
  }
  if (selection.kind === ROW) {
    return trackIds(selection).flatMap((id) => {
      const row = grid.rowAt.get(id);
      return row === undefined ? [] : [{ row, column: 0, rows: 1, columns: grid.columns.length }];
    });
  }
  if (selection.kind === COLUMN) {
    return trackIds(selection).flatMap((id) => {
      const column = grid.columnAt.get(id);
      return column === undefined ? [] : [{ row: 0, column, rows: grid.rows.length, columns: 1 }];
    });
  }
  return [];
};

export const selectedRowIds = (selection: Selection | undefined): string[] =>
  selection?.kind === ROW ? trackIds(selection) : [];

export const selectedColumnIds = (selection: Selection | undefined): string[] =>
  selection?.kind === COLUMN ? trackIds(selection) : [];

export const textRangeOf = (
  selection: Selection | undefined
): { readonly ref: CellRef; readonly from: number; readonly to: number } | undefined => {
  if (selection?.kind !== TEXT) return undefined;
  const [fromKey, fromAt] = selection.id.split("@");
  const [, toAt] = (selection.at ?? selection.id).split("@");
  const ref = refOfKey(fromKey ?? "");
  if (ref === undefined) return undefined;
  const from = Number(fromAt ?? 0);
  const to = Number(toAt ?? from);
  return { ref, from: Math.min(from, to), to: Math.max(from, to) };
};

export const surfaceSelectionOf = (
  grid: Grid,
  selection: Selection | undefined
): SurfaceSelection | undefined => {
  if (selection === undefined) return undefined;
  if (selection.kind === CELL || selection.kind === RANGE) {
    const rects = selectedRects(grid, selection);
    const [primary] = rects;
    if (primary === undefined) return undefined;
    const anchorRef = refOfKey(selection.id);
    const anchor = anchorRef === undefined ? undefined : indexOf(grid, anchorRef);
    return {
      cell: anchor === undefined ? [primary.column, primary.row] : [anchor.column, anchor.row],
      ranges: rects,
      rows: [],
      columns: []
    };
  }
  if (selection.kind === ROW) {
    const rows = trackIds(selection).flatMap((id) => {
      const row = grid.rowAt.get(id);
      return row === undefined ? [] : [row];
    });
    return { ranges: [], rows, columns: [] };
  }
  if (selection.kind === COLUMN) {
    const columns = trackIds(selection).flatMap((id) => {
      const column = grid.columnAt.get(id);
      return column === undefined ? [] : [column];
    });
    return { ranges: [], rows: [], columns };
  }
  if (selection.kind === TEXT) {
    const range = textRangeOf(selection);
    const at = range === undefined ? undefined : indexOf(grid, range.ref);
    if (at === undefined) return undefined;
    return { cell: [at.column, at.row], ranges: [{ row: at.row, column: at.column, rows: 1, columns: 1 }], rows: [], columns: [] };
  }
  return undefined;
};

export const sameSelection = (a: Selection | undefined, b: Selection | undefined): boolean =>
  a?.kind === b?.kind &&
  a?.id === b?.id &&
  a?.at === b?.at &&
  JSON.stringify(a?.ranges ?? []) === JSON.stringify(b?.ranges ?? []);
