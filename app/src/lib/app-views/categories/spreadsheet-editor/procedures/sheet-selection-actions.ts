import type { SurfaceHit, SurfaceSelection } from "$authored-components/sheet-surface";
import { keyOf, labelOf, rectLabelOf, refAt, type Rect } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { mergeAround } from "$app-views/categories/spreadsheet-editor/procedures/merge-spans";
import { endedReferenceGesture, startedReferenceGesture } from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";
import type { SheetActionContext } from "$app-views/categories/spreadsheet-editor/procedures/sheet-action-context";
import {
  sameSelection,
  selectedColumnIds,
  selectedRects,
  selectedRowIds
} from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
import { cellSignal, columnSignal, rangeSignal, rowSignal, type Signal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
import { usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";

const WHOLE = "spreadsheet-editor.spreadsheet";

export type SheetSelectionActions = {
  readonly show: (signal: Signal | undefined) => void;
  readonly collapsed: () => Signal | undefined;
  readonly select: (selection: SurfaceSelection) => void;
  readonly referenceGesture: (active: boolean) => void;
  readonly pointed: (hit: SurfaceHit) => void;
  readonly selectAll: () => void;
  readonly openLens: (signal: Signal | undefined) => void;
};

export const createSheetSelectionActions = (context: SheetActionContext): SheetSelectionActions => {
  const show = (signal: Signal | undefined) => {
    if (signal === undefined) {
      if (context.view.selection !== undefined || context.view.inspected !== WHOLE) context.view.inspect(WHOLE);
      return;
    }
    if (sameSelection(context.view.selection, signal.selection) && context.view.inspected === signal.key) return;
    context.view.inspect(signal.key, signal.selection);
  };

  const collapsed = (): Signal | undefined => {
    const held = context.view.selection;
    const sheet = context.sheet;
    if (sheet === undefined || held?.kind !== "range" || held.ranges !== undefined) return undefined;
    const [only] = selectedRects(context.grid, held);
    if (only === undefined) return undefined;
    const span = mergeAround(sheet, context.grid, only);
    return span === undefined ? undefined : cellSignal(sheet, context.grid, span.anchor);
  };

  const everything = (): Signal | undefined => {
    const sheet = context.sheet;
    const grid = context.grid;
    if (sheet === undefined || grid.rows.length === 0 || grid.columns.length === 0) return undefined;
    const rect = usedRect(sheet, grid) ?? { row: 0, column: 0, rows: 1, columns: 1 };
    if (rect.rows === 1 && rect.columns === 1) {
      const ref = refAt(grid, rect.row, rect.column);
      return ref === undefined ? undefined : cellSignal(sheet, grid, ref);
    }
    return rangeSignal(grid, [rect]);
  };

  const wholeGrid = (rect: Rect): boolean =>
    rect.row === 0 &&
    rect.column === 0 &&
    rect.rows >= context.grid.rows.length &&
    rect.columns >= context.grid.columns.length;

  const signalOf = (next: SurfaceSelection): Signal | undefined => {
    const sheet = context.sheet;
    const grid = context.grid;
    if (sheet === undefined) return undefined;
    if (next.rows.length > 1 && next.rows.length >= grid.rows.length) return everything();
    if (next.rows.length > 0) return rowSignal(grid, next.rows);
    if (next.columns.length > 0) return columnSignal(grid, next.columns);
    const [only] = next.ranges;
    if (only !== undefined && next.ranges.length === 1) {
      if (wholeGrid(only)) return everything();
      const span = mergeAround(sheet, grid, only);
      if (span !== undefined) return cellSignal(sheet, grid, span.anchor);
      if (only.rows === 1 && only.columns === 1) {
        const ref = refAt(grid, only.row, only.column);
        return ref === undefined ? undefined : cellSignal(sheet, grid, ref);
      }
    }
    return next.ranges.length > 0 ? rangeSignal(grid, next.ranges, next.cell) : undefined;
  };

  const picked = (next: SurfaceSelection): boolean => {
    const channel = context.channel;
    if (!channel.armed) return false;
    const gesture = context.held.referenceGesture.active;
    if (gesture === undefined) return false;
    const at = next.cell;
    const [rect] = next.ranges;
    if (at === undefined || rect === undefined || next.ranges.length > 1) return false;
    const ref = refAt(context.grid, at[1], at[0]);
    if (ref === undefined) return false;
    context.held.referencePick = { session: channel.session, selection: next };
    return channel.pick(
      rect.rows === 1 && rect.columns === 1 ? labelOf(context.grid, ref) : rectLabelOf(context.grid, rect),
      keyOf(ref),
      gesture
    );
  };

  return {
    show,
    collapsed,
    select: (next) => {
      if (!picked(next)) show(signalOf(next));
    },
    referenceGesture: (active) => {
      context.held.referenceGesture = active
        ? startedReferenceGesture(context.held.referenceGesture)
        : endedReferenceGesture(context.held.referenceGesture);
    },
    pointed: (next) => {
      context.held.hit = next;
      const sheet = context.sheet;
      if (sheet === undefined) return;
      if (next.kind === "cell") {
        const inside = selectedRects(context.grid, context.view.selection).some(
          (rect) =>
            next.row >= rect.row &&
            next.row < rect.row + rect.rows &&
            next.column >= rect.column &&
            next.column < rect.column + rect.columns
        );
        const ref = refAt(context.grid, next.row, next.column);
        if (!inside && ref !== undefined) show(cellSignal(sheet, context.grid, ref));
      } else if (
        next.kind === "row" &&
        !selectedRowIds(context.view.selection).includes(context.grid.rows[next.row]?.id ?? "")
      ) {
        show(rowSignal(context.grid, [next.row]));
      } else if (
        next.kind === "column" &&
        !selectedColumnIds(context.view.selection).includes(context.grid.columns[next.column]?.id ?? "")
      ) {
        show(columnSignal(context.grid, [next.column]));
      }
    },
    selectAll: () => show(everything()),
    openLens: (signal) => {
      if (signal !== undefined) context.view.inspect(signal.key, signal.selection);
    }
  };
};
