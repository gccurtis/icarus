<script lang="ts">
  import { createElement, createRef } from "react";
  import { createRoot, type Root } from "react-dom/client";
  import {
    DataEditor,
    type DataEditorProps,
    type DataEditorRef,
    type EditableGridCell,
    type GridColumn,
    type GridKeyEventArgs,
    type GridSelection,
    type Item,
    type Theme
  } from "@glideapps/glide-data-grid";
  import "@glideapps/glide-data-grid/dist/index.css";

  import {
    appendCell,
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
  import { measurer, themeOf, type Measure } from "$authored-components/sheet-surface/sheet-surface-theme";
  import type {
    SurfaceApi,
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

  let {
    scene,
    selection,
    highlights = [],
    zoom = 100,
    scrollTarget,
    appendHint = "New row",
    appendColumnHint = "New column",
    api = $bindable(),
    onselect,
    onedit,
    ondelete,
    onfill,
    onpaste,
    onresize,
    onmovecolumn,
    onmoverow,
    onappend,
    onappendcolumn,
    oncontext
  }: {
    scene: SurfaceScene;
    selection?: SurfaceSelection;
    highlights?: readonly SurfaceHighlight[];
    zoom?: number;
    scrollTarget?: { readonly row: number; readonly column: number; readonly token: number };
    appendHint?: string;
    appendColumnHint?: string;
    api?: SurfaceApi;
    onselect?: (selection: SurfaceSelection) => void;
    onedit?: (edits: readonly SurfaceEdit[]) => void;
    ondelete?: (selection: SurfaceSelection) => void;
    onfill?: (fill: SurfaceFill) => void;
    onpaste?: (paste: SurfacePaste) => void;
    onresize?: (column: number, size: number) => void;
    onmovecolumn?: (from: number, to: number) => void;
    onmoverow?: (from: number, to: number) => void;
    onappend?: () => void;
    onappendcolumn?: () => void;
    oncontext?: (hit: SurfaceHit) => void;
  } = $props();

  const PORTAL = "portal";
  const HEADER = 26;
  const MARKER = 44;
  const APPEND_COLUMN = "append";
  const APPEND_WIDTH = 112;

  const DIRECTIONS: Record<string, SurfaceDirection> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };

  let frame = $state<HTMLDivElement>();
  let host = $state<HTMLDivElement>();
  let measure = $state<Measure | undefined>(undefined);
  let size = $state({ width: 0, height: 0 });
  let drafts = $state<Record<number, number>>({});
  let focused = $state(false);

  const ref = createRef<DataEditorRef>();
  let root: Root | undefined;

  const scale = $derived(zoom / 100);
  const theme = $derived(measure === undefined ? undefined : themeOf(measure, zoom));
  const mono = $derived(measure === undefined ? "monospace" : measure.family("--token-font-mono"));
  const base = $derived(measure === undefined ? 13 : measure.px("--token-text-label", 13) * scale);
  const appendAt = $derived(scene.columns.length);

  const columns = $derived.by((): readonly GridColumn[] => {
    const held = measure;
    const own: GridColumn[] = scene.columns.map((column, index) => ({
      id: column.id,
      title: column.label,
      width: Math.round(drafts[index] ?? column.size * scale)
    }));
    if (onappendcolumn === undefined || held === undefined) return own;
    return [
      ...own,
      {
        id: APPEND_COLUMN,
        title: appendColumnHint,
        width: Math.round(APPEND_WIDTH * scale),
        themeOverride: {
          bgHeader: held.paint(undefined, "--token-surface-panel"),
          bgHeaderHasFocus: held.paint(undefined, "--token-surface-panel-hover"),
          bgHeaderHovered: held.paint(undefined, "--token-surface-panel-hover"),
          textHeader: held.paint(undefined, "--token-ink-muted")
        }
      }
    ];
  });

  const selectedRegions = $derived.by((): SurfaceHighlight[] => {
    const cell = selection?.cell;
    if (focused || cell === undefined) return [];
    return [{ rect: { row: cell[1], column: cell[0], rows: 1, columns: 1 }, tone: "selected" }];
  });

  const ensurePortal = () => {
    if (document.getElementById(PORTAL) !== null) return;
    const portal = document.createElement("div");
    portal.id = PORTAL;
    portal.style.position = "fixed";
    portal.style.left = "0";
    portal.style.top = "0";
    portal.style.zIndex = "60";
    document.body.appendChild(portal);
  };

  $effect(() => {
    const element = host;
    const outer = frame;
    if (element === undefined || outer === undefined) return;

    ensurePortal();
    measure = measurer(outer);
    root = createRoot(element);

    const themed = new MutationObserver(() => {
      measure?.dispose();
      measure = measurer(outer);
    });
    themed.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-appearance", "data-theme", "class", "style"]
    });
    api = {
      copy: () => void ref.current?.emit("copy"),
      cut: () => {
        void ref.current?.emit("copy");
        if (selection !== undefined) ondelete?.(selection);
      },
      paste: () => void ref.current?.emit("paste"),
      focus: () => ref.current?.focus()
    };

    const watcher = new ResizeObserver(() => {
      size = { width: outer.clientWidth, height: outer.clientHeight };
    });
    watcher.observe(outer);
    size = { width: outer.clientWidth, height: outer.clientHeight };

    return () => {
      watcher.disconnect();
      themed.disconnect();
      measure?.dispose();
      const mounted = root;
      root = undefined;
      queueMicrotask(() => mounted?.unmount());
    };
  });

  const hitOf = (item: Item, header: boolean): SurfaceHit => {
    const [column, row] = item;
    if (header) return column < 0 ? { kind: "corner" } : { kind: "column", column };
    if (column < 0) return { kind: "row", row };
    return { kind: "cell", row, column };
  };

  const touchesAppend = (next: GridSelection): boolean =>
    (next.current !== undefined &&
      (next.current.cell[0] >= appendAt || next.current.range.x + next.current.range.width > appendAt)) ||
    next.columns.toArray().some((column) => column >= appendAt);

  const jump = (event: GridKeyEventArgs) => {
    const direction = DIRECTIONS[event.key];
    const anchor = selection?.cell;
    if (direction === undefined || anchor === undefined || !(event.ctrlKey || event.metaKey)) return;
    event.cancel();
    event.preventDefault();
    const target = jumpTarget(scene, anchor, direction);
    const [primary] = selection?.ranges ?? [];
    const reach = event.shiftKey && primary !== undefined ? primary : { row: anchor[1], column: anchor[0], rows: 1, columns: 1 };
    const rect = event.shiftKey
      ? {
          row: Math.min(reach.row, target[1], anchor[1]),
          column: Math.min(reach.column, target[0], anchor[0]),
          rows: Math.max(reach.row + reach.rows - 1, target[1], anchor[1]) - Math.min(reach.row, target[1], anchor[1]) + 1,
          columns: Math.max(reach.column + reach.columns - 1, target[0], anchor[0]) - Math.min(reach.column, target[0], anchor[0]) + 1
        }
      : { row: target[1], column: target[0], rows: 1, columns: 1 };
    onselect?.({ cell: event.shiftKey ? anchor : target, ranges: [rect], rows: [], columns: [] });
    ref.current?.scrollTo(target[0], target[1], "both", 0, 0);
  };

  const editorProps = (
    held: Measure,
    paint: Partial<Theme>,
    width: number,
    height: number
  ): DataEditorProps => ({
    columns,
    rows: scene.rows.length,
    width,
    height,
    theme: paint,
    getCellContent: ([column, row]: Item) =>
      column >= appendAt ? appendCell(held) : gridCellOf(scene.cellAt(row, column), column, held, mono, base, scale),
    getCellsForSelection: true,
    gridSelection: gridSelectionOf(selection),
    onGridSelectionChange: (next: GridSelection) => {
      if (touchesAppend(next)) return;
      onselect?.(surfaceSelectionOf(next));
    },
    rangeSelect: "multi-rect",
    columnSelect: "multi",
    rowSelect: "multi",
    rowMarkers: { kind: "clickable-number", width: Math.round(MARKER * scale) },
    freezeColumns: scene.frozenColumns,
    rowHeight: (row: number) => Math.round((scene.rows[row]?.size ?? 26) * scale),
    headerHeight: Math.round(HEADER * scale),
    smoothScrollX: true,
    smoothScrollY: true,
    verticalBorder: true,
    fillHandle: true,
    highlightRegions: regionsOf([...highlights, ...selectedRegions], held),
    onCellEdited: (item: Item, value: EditableGridCell) => {
      if (value.kind !== "text" || item[0] >= appendAt) return;
      onedit?.([{ column: item[0], row: item[1], text: value.data }]);
    },
    onDelete: (chosen: GridSelection) => {
      ondelete?.(surfaceSelectionOf(chosen));
      return false;
    },
    onFillPattern: (event: FillEvent) => {
      event.preventDefault();
      onfill?.({ source: rectOf(event.patternSource), target: rectOf(event.fillDestination) });
    },
    onPaste: (target: Item, values: readonly (readonly string[])[]) => {
      onpaste?.({ column: target[0], row: target[1], values });
      return false;
    },
    onColumnResize: (_column: GridColumn, next: number, index: number) => {
      if (index >= appendAt) return;
      drafts = { ...drafts, [index]: next };
    },
    onColumnResizeEnd: (_column: GridColumn, next: number, index: number) => {
      if (index >= appendAt) return;
      const { [index]: _gone, ...rest } = drafts;
      void _gone;
      drafts = rest;
      onresize?.(index, Math.round(next / scale));
    },
    onColumnMoved: (from: number, to: number) => {
      if (from >= appendAt || to >= appendAt) return;
      onmovecolumn?.(from, to);
    },
    onRowMoved: (from: number, to: number) => onmoverow?.(from, to),
    onHeaderClicked: (column: number) => {
      if (column >= appendAt) onappendcolumn?.();
    },
    onCellClicked: (item: Item) => {
      if (item[0] >= appendAt) onappendcolumn?.();
    },
    trailingRowOptions: onappend === undefined ? undefined : { hint: appendHint, sticky: false, tint: true },
    onRowAppended: onappend === undefined ? undefined : () => onappend(),
    onCellContextMenu: (item: Item) => {
      if (item[0] < appendAt) oncontext?.(hitOf(item, false));
    },
    onHeaderContextMenu: (column: number) => {
      if (column < appendAt) oncontext?.(hitOf([column, -1], true));
    },
    onKeyDown: jump,
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
          held,
          mono,
          args.theme.cellHorizontalPadding
        );
      } else {
        draw();
      }
      if (cell.pin !== undefined) drawPin(args.ctx, args.rect, cell.pin.state, held, scale);
    },
    keybindings: { search: false }
  });

  $effect(() => {
    const held = measure;
    const paint = theme;
    const mounted = root;
    if (held === undefined || paint === undefined || mounted === undefined) return;
    if (size.width === 0 || size.height === 0) return;

    mounted.render(createElement(DataEditor, { ...editorProps(held, paint, size.width, size.height), ref }));
  });

  $effect(() => {
    const target = scrollTarget;
    if (target === undefined) return;
    ref.current?.scrollTo(target.column, target.row, "both", 0, 0, { hAlign: "center", vAlign: "center" });
  });

  const focusIn = () => {
    focused = true;
  };

  const focusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && host?.contains(next)) return;
    focused = false;
  };
</script>

<div bind:this={frame} class="sheet-surface" role="presentation">
  <div bind:this={host} class="host" onfocusin={focusIn} onfocusout={focusOut}></div>
</div>

<style>
  .sheet-surface {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--token-surface-elevated);
  }

  .host {
    position: absolute;
    inset: 0;
  }
</style>
