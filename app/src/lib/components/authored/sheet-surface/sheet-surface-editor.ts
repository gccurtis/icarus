import type {
  DataEditorProps,
  DataEditorRef,
  EditableGridCell,
  GridColumn,
  GridKeyEventArgs,
  GridSelection,
  Item,
  Theme
} from "@glideapps/glide-data-grid";
import type { RefObject } from "react";

import {
  appendCell,
  drawBorder,
  drawPin,
  drawRuns,
  drawsItself,
  gridCellOf,
  gridSelectionOf,
  jumpTarget,
  rectOf,
  regionsOf,
  runOf,
  surfaceSelectionOf
} from "$authored-components/sheet-surface/sheet-surface-glide";
import { HEADER, MARKER } from "$authored-components/sheet-surface/sheet-surface-geometry";
import type { Measure } from "$authored-components/sheet-surface/sheet-surface-theme";
import type {
  SurfaceDirection,
  SurfaceEdit,
  SurfaceFill,
  SurfaceHighlight,
  SurfaceHit,
  SurfacePaste,
  SurfaceScene,
  SurfaceSelection
} from "$authored-components/sheet-surface/sheet-surface-types";

type FillEvent = Parameters<NonNullable<DataEditorProps["onFillPattern"]>>[0];
type DrawArgs = Parameters<NonNullable<DataEditorProps["drawCell"]>>[0];

const DIRECTIONS: Record<string, SurfaceDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right"
};

export type Editor = {
  readonly scene: SurfaceScene;
  readonly selection: SurfaceSelection | undefined;
  readonly highlights: readonly SurfaceHighlight[];
  readonly regions: readonly SurfaceHighlight[];
  readonly columns: readonly GridColumn[];
  readonly appendAt: number;
  readonly scale: number;
  readonly mono: string;
  readonly base: number;
  readonly measure: Measure;
  readonly paint: Partial<Theme>;
  readonly width: number;
  readonly height: number;
  readonly drafts: Record<number, number>;
  readonly rowDrafts: Record<number, number>;
  readonly resizing: (next: Record<number, number>) => void;
  readonly showing: (range: { x: number; y: number; width: number; height: number }) => void;
  readonly ref: RefObject<DataEditorRef>;
  readonly appendHint: string;
  readonly onselect?: (selection: SurfaceSelection) => void;
  readonly onedit?: (edits: readonly SurfaceEdit[]) => void;
  readonly ondelete?: (selection: SurfaceSelection) => void;
  readonly onfill?: (fill: SurfaceFill) => void;
  readonly onpaste?: (paste: SurfacePaste) => void;
  readonly onresize?: (column: number, size: number) => void;
  readonly onmovecolumn?: (from: number, to: number) => void;
  readonly onmoverow?: (from: number, to: number) => void;
  readonly onappend?: () => void;
  readonly onappendcolumn?: () => void;
  readonly oncontext?: (hit: SurfaceHit) => void;
  readonly onbegin?: (seed: string) => void;
};

const hitOf = (item: Item, header: boolean): SurfaceHit => {
  const [column, row] = item;
  if (header) return column < 0 ? { kind: "corner" } : { kind: "column", column };
  if (column < 0) return { kind: "row", row };
  return { kind: "cell", row, column };
};

const touchesAppend = (next: GridSelection, appendAt: number): boolean =>
  (next.current !== undefined &&
    (next.current.cell[0] >= appendAt || next.current.range.x + next.current.range.width > appendAt)) ||
  next.columns.toArray().some((column) => column >= appendAt);

/**
 * Control and an arrow: to the far edge of what is filled, the way a sheet has
 * always answered that gesture. The library moves one cell, so this takes the
 * key before it and works the jump out from the scene.
 */
const jump = (editor: Editor, event: GridKeyEventArgs): void => {
  const direction = DIRECTIONS[event.key];
  const anchor = editor.selection?.cell;
  if (direction === undefined || anchor === undefined || !(event.ctrlKey || event.metaKey)) return;

  event.cancel();
  event.preventDefault();
  const target = jumpTarget(editor.scene, anchor, direction);
  const [primary] = editor.selection?.ranges ?? [];
  const reach =
    event.shiftKey && primary !== undefined
      ? primary
      : { row: anchor[1], column: anchor[0], rows: 1, columns: 1 };
  const rect = event.shiftKey
    ? {
        row: Math.min(reach.row, target[1], anchor[1]),
        column: Math.min(reach.column, target[0], anchor[0]),
        rows:
          Math.max(reach.row + reach.rows - 1, target[1], anchor[1]) -
          Math.min(reach.row, target[1], anchor[1]) +
          1,
        columns:
          Math.max(reach.column + reach.columns - 1, target[0], anchor[0]) -
          Math.min(reach.column, target[0], anchor[0]) +
          1
      }
    : { row: target[1], column: target[0], rows: 1, columns: 1 };

  editor.onselect?.({ cell: event.shiftKey ? anchor : target, ranges: [rect], rows: [], columns: [] });
  editor.ref.current?.scrollTo(target[0], target[1], "both", 0, 0);
};

/**
 * A keystroke on the grid opens the one field that writes. The grid keeps no
 * editor of its own, so Enter, F2 and any printable character are handed on.
 */
const begins = (editor: Editor, event: GridKeyEventArgs): boolean => {
  if (editor.onbegin === undefined || editor.selection?.cell === undefined) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key === "Enter" || event.key === "F2") {
    editor.onbegin("");
    return true;
  }
  if (event.key.length !== 1) return false;

  editor.onbegin(event.key);
  return true;
};

/** Everything the library is told, worked out from the scene and the callbacks. */
export const editorPropsOf = (editor: Editor): DataEditorProps => {
  const { appendAt, measure, mono, base, scale, scene } = editor;

  return {
    columns: editor.columns,
    rows: scene.rows.length,
    width: editor.width,
    height: editor.height,
    theme: editor.paint,
    getCellContent: ([column, row]: Item) =>
      column >= appendAt
        ? appendCell(measure)
        : { ...gridCellOf(scene.cellAt(row, column), column, measure, mono, base, scale), allowOverlay: false },
    getCellsForSelection: true,
    gridSelection: gridSelectionOf(editor.selection),
    onGridSelectionChange: (next: GridSelection) => {
      if (touchesAppend(next, appendAt)) return;
      editor.onselect?.(surfaceSelectionOf(next));
    },
    rangeSelect: "multi-rect",
    columnSelect: "multi",
    rowSelect: "multi",
    rowMarkers: { kind: "clickable-number", width: Math.round(MARKER * scale) },
    freezeColumns: scene.frozenColumns,
    freezeTrailingRows: scene.frozenRows,
    rowHeight: (row: number) => Math.round(editor.rowDrafts[row] ?? (scene.rows[row]?.size ?? 26) * scale),
    onVisibleRegionChanged: editor.showing,
    headerHeight: Math.round(HEADER * scale),
    smoothScrollX: true,
    smoothScrollY: true,
    verticalBorder: true,
    fillHandle: true,
    highlightRegions: regionsOf([...editor.highlights, ...editor.regions], measure),
    onCellEdited: (item: Item, value: EditableGridCell) => {
      if (value.kind !== "text" || item[0] >= appendAt) return;
      editor.onedit?.([{ column: item[0], row: item[1], text: value.data }]);
    },
    onDelete: (chosen: GridSelection) => {
      editor.ondelete?.(surfaceSelectionOf(chosen));
      return false;
    },
    onFillPattern: (event: FillEvent) => {
      event.preventDefault();
      editor.onfill?.({ source: rectOf(event.patternSource), target: rectOf(event.fillDestination) });
    },
    onPaste: (target: Item, values: readonly (readonly string[])[]) => {
      editor.onpaste?.({ column: target[0], row: target[1], values });
      return false;
    },
    onColumnResize: (_column: GridColumn, next: number, index: number) => {
      if (index >= appendAt) return;
      editor.resizing({ ...editor.drafts, [index]: next });
    },
    onColumnResizeEnd: (_column: GridColumn, next: number, index: number) => {
      if (index >= appendAt) return;
      const { [index]: _gone, ...rest } = editor.drafts;
      void _gone;
      editor.resizing(rest);
      editor.onresize?.(index, Math.round(next / scale));
    },
    onColumnMoved: (from: number, to: number) => {
      if (from >= appendAt || to >= appendAt) return;
      editor.onmovecolumn?.(from, to);
    },
    onRowMoved: (from: number, to: number) => editor.onmoverow?.(from, to),
    onHeaderClicked: (column: number) => {
      if (column >= appendAt) editor.onappendcolumn?.();
    },
    onCellClicked: (item: Item) => {
      if (item[0] >= appendAt) editor.onappendcolumn?.();
    },
    trailingRowOptions:
      editor.onappend === undefined ? undefined : { hint: editor.appendHint, sticky: false, tint: true },
    onRowAppended: editor.onappend === undefined ? undefined : () => editor.onappend?.(),
    onCellContextMenu: (item: Item) => {
      if (item[0] < appendAt) editor.oncontext?.(hitOf(item, false));
    },
    onHeaderContextMenu: (column: number) => {
      if (column < appendAt) editor.oncontext?.(hitOf([column, -1], true));
    },
    onKeyDown: (event: GridKeyEventArgs) => {
      jump(editor, event);
      if (!begins(editor, event)) return;
      event.cancel();
      event.preventDefault();
    },
    onCellActivated: (item: Item) => {
      if (item[0] < appendAt) editor.onbegin?.("");
    },
    drawCell: (args: DrawArgs, draw: () => void) => {
      if (args.col >= appendAt) {
        draw();
        return;
      }
      const cell = scene.cellAt(args.row, args.col);
      if (drawsItself(cell)) {
        drawRuns(
          args.ctx,
          cell.runs ?? [runOf(cell)],
          args.rect,
          cell.align,
          cell.valign,
          args.theme,
          measure,
          mono,
          args.theme.cellHorizontalPadding
        );
      } else {
        draw();
      }
      if (cell.border !== undefined) drawBorder(args.ctx, args.rect, cell.border, measure, scale);
      if (cell.pin !== undefined) drawPin(args.ctx, args.rect, cell.pin.state, measure, scale);
    },
    keybindings: { search: false }
  };
};
