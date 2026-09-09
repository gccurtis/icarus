import type { Selection, SelectionRange } from "$representation/data/types/workspace/tab";
import type { SurfaceSelection } from "$authored-components/sheet-surface";
import {
  indexOf,
  refOfKey,
  rectOf,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import {
  CELL,
  COLUMN,
  RANGE,
  ROW,
  TEXT
} from "$app-views/categories/spreadsheet-editor/procedures/selection-kinds";

export type TextRange = { readonly ref: CellRef; readonly from: number; readonly to: number };

const rectOfRange = (grid: Grid, range: SelectionRange): Rect | undefined => {
  const from = refOfKey(range.id);
  const to = refOfKey(range.at);
  return from === undefined || to === undefined ? undefined : rectOf(grid, { from, to });
};

const trackIds = (selection: Selection): string[] => [
  selection.id,
  ...(selection.ranges ?? []).map((range) => range.id)
];

export const selectedRef = (selection: Selection | undefined): CellRef | undefined =>
  selection?.kind === CELL ? refOfKey(selection.id) : undefined;

export const highlightedRefs = (selection: Selection | undefined): CellRef[] =>
  selection?.kind === CELL
    ? (selection.ranges ?? []).flatMap((range) => {
        const ref = refOfKey(range.id);
        return ref === undefined ? [] : [ref];
      })
    : [];

export const selectedRects = (grid: Grid, selection: Selection | undefined): Rect[] => {
  if (selection === undefined) return [];
  if (selection.kind === CELL) {
    const ref = refOfKey(selection.id);
    const at = ref === undefined ? undefined : indexOf(grid, ref);
    return at === undefined ? [] : [{ row: at.row, column: at.column, rows: 1, columns: 1 }];
  }
  if (selection.kind === RANGE) {
    const ranges: SelectionRange[] = [
      { id: selection.id, at: selection.at ?? selection.id },
      ...(selection.ranges ?? [])
    ];
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

export const textRangeOf = (selection: Selection | undefined): TextRange | undefined => {
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
    return {
      cell: [at.column, at.row],
      ranges: [{ row: at.row, column: at.column, rows: 1, columns: 1 }],
      rows: [],
      columns: []
    };
  }
  return undefined;
};

export const sameSelection = (a: Selection | undefined, b: Selection | undefined): boolean =>
  a?.kind === b?.kind &&
  a?.id === b?.id &&
  a?.at === b?.at &&
  JSON.stringify(a?.ranges ?? []) === JSON.stringify(b?.ranges ?? []);
