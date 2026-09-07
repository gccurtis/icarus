<script lang="ts">
  import { untrack } from "svelte";
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
    onrowresize,
    onmovecolumn,
    onmoverow,
    onappend,
    onappendcolumn,
    oncontext,
    onbegin
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
    onrowresize?: (row: number, size: number) => void;
    onmovecolumn?: (from: number, to: number) => void;
    onmoverow?: (from: number, to: number) => void;
    onappend?: () => void;
    onappendcolumn?: () => void;
    oncontext?: (hit: SurfaceHit) => void;
    /**
     * Somebody started writing into the selected cell. The grid does not open an
     * editor of its own: writing happens in one field, wherever that field is,
     * so everything it can do is available every time.
     */
    onbegin?: (seed: string) => void;
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
  let rowDrafts = $state<Record<number, number>>({});
  let focused = $state(false);
  let region = $state({ x: 0, y: 0, width: 0, height: 0, tick: 0 });
  let dragging = $state(false);

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

  /**
   * Where every visible boundary sits, asked of the grid rather than worked out
   * from a scroll offset. The library draws a resize cursor for a column and has
   * no notion of a row height at all, so both handles are ours.
   */
  const edges = $derived.by(() => {
    void region;
    void size;
    void zoom;
    void scene;
    const grid = ref.current;
    const outer = frame;
    if (grid === undefined || grid === null || outer === undefined) return { columns: [], rows: [] };

    const box = outer.getBoundingClientRect();
    const firstRow = Math.max(0, region.y);
    const firstColumn = Math.max(0, region.x);

    const columns: { index: number; x: number }[] = [];
    for (let index = 0; index < Math.min(scene.frozenColumns, appendAt); index += 1) {
      const bounds = grid.getBounds(index, firstRow);
      if (bounds !== undefined) columns.push({ index, x: bounds.x - box.left + bounds.width });
    }
    for (let index = firstColumn; index < Math.min(firstColumn + region.width + 2, appendAt); index += 1) {
      if (index < scene.frozenColumns) continue;
      const bounds = grid.getBounds(index, firstRow);
      if (bounds !== undefined) columns.push({ index, x: bounds.x - box.left + bounds.width });
    }

    const rows: { index: number; y: number }[] = [];
    for (let index = firstRow; index < Math.min(firstRow + region.height + 2, scene.rows.length); index += 1) {
      const bounds = grid.getBounds(firstColumn, index);
      if (bounds !== undefined) rows.push({ index, y: bounds.y - box.top + bounds.height });
    }
    return { columns, rows };
  });

  const dragColumn = (index: number) => (event: PointerEvent) => {
    const from = event.clientX;
    const start = Math.round((drafts[index] ?? scene.columns[index].size * scale));
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging = true;

    const move = (moved: PointerEvent) => {
      drafts = { ...drafts, [index]: Math.max(28, Math.round(start + moved.clientX - from)) };
    };
    const done = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", done);
      const next = drafts[index] ?? start;
      const { [index]: _gone, ...rest } = drafts;
      void _gone;
      drafts = rest;
      dragging = false;
      onresize?.(index, Math.round(next / scale));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", done);
  };

  const dragRow = (index: number) => (event: PointerEvent) => {
    const from = event.clientY;
    const start = Math.round(rowDrafts[index] ?? (scene.rows[index]?.size ?? 26) * scale);
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging = true;

    const move = (moved: PointerEvent) => {
      rowDrafts = { ...rowDrafts, [index]: Math.max(16, Math.round(start + moved.clientY - from)) };
    };
    const done = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", done);
      const next = rowDrafts[index] ?? start;
      const { [index]: _gone, ...rest } = rowDrafts;
      void _gone;
      rowDrafts = rest;
      dragging = false;
      onrowresize?.(index, Math.round(next / scale));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", done);
  };

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

  const begin = (event: GridKeyEventArgs): boolean => {
    if (onbegin === undefined || selection?.cell === undefined) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === "Enter" || event.key === "F2") {
      onbegin("");
      return true;
    }
    if (event.key.length !== 1) return false;
    onbegin(event.key);
    return true;
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
      column >= appendAt
        ? appendCell(held)
        : { ...gridCellOf(scene.cellAt(row, column), column, held, mono, base, scale), allowOverlay: false },
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
    freezeTrailingRows: scene.frozenRows,
    rowHeight: (row: number) => Math.round(rowDrafts[row] ?? (scene.rows[row]?.size ?? 26) * scale),
    onVisibleRegionChanged: (range: { x: number; y: number; width: number; height: number }) => {
      region = { x: range.x, y: range.y, width: range.width, height: range.height, tick: region.tick + 1 };
    },
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
    onKeyDown: (event: GridKeyEventArgs) => {
      jump(event);
      if (!begin(event)) return;
      event.cancel();
      event.preventDefault();
    },
    onCellActivated: (item: Item) => {
      if (item[0] < appendAt) onbegin?.("");
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
          held,
          mono,
          args.theme.cellHorizontalPadding
        );
      } else {
        draw();
      }
      if (cell.border !== undefined) drawBorder(args.ctx, args.rect, cell.border, held, scale);
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

  const centreOf = (held: SurfaceSelection | undefined): { row: number; column: number } | undefined => {
    if (held === undefined) return undefined;
    if (held.ranges.length > 0) {
      const rows = held.ranges.flatMap((rect) => [rect.row, rect.row + rect.rows - 1]);
      const columns = held.ranges.flatMap((rect) => [rect.column, rect.column + rect.columns - 1]);
      return {
        row: Math.round((Math.min(...rows) + Math.max(...rows)) / 2),
        column: Math.round((Math.min(...columns) + Math.max(...columns)) / 2)
      };
    }
    if (held.cell !== undefined) return { row: held.cell[1], column: held.cell[0] };
    if (held.rows.length > 0) return { row: Math.round((Math.min(...held.rows) + Math.max(...held.rows)) / 2), column: 0 };
    if (held.columns.length > 0) {
      return { row: 0, column: Math.round((Math.min(...held.columns) + Math.max(...held.columns)) / 2) };
    }
    return undefined;
  };

  let zoomed: number | undefined = undefined;

  $effect(() => {
    const next = zoom;
    const previous = zoomed;
    zoomed = next;
    if (previous === undefined || previous === next) return;
    const centre = untrack(() => centreOf(selection));
    if (centre === undefined) return;
    requestAnimationFrame(() => {
      ref.current?.scrollTo(centre.column, centre.row, "both", 0, 0, { hAlign: "center", vAlign: "center" });
    });
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

  <div class="handles" class:dragging>
    {#each edges.columns as edge (edge.index)}
      <div
        class="handle across"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Width of column ${scene.columns[edge.index]?.label ?? ""}`}
        tabindex="-1"
        style={`left: ${edge.x - 3}px; height: ${Math.round(HEADER * scale)}px;`}
        onpointerdown={dragColumn(edge.index)}
      ></div>
    {/each}
    {#each edges.rows as edge (edge.index)}
      <div
        class="handle down"
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Height of row ${edge.index + 1}`}
        tabindex="-1"
        style={`top: ${edge.y - 3}px; width: ${Math.round(MARKER * scale)}px;`}
        onpointerdown={dragRow(edge.index)}
      ></div>
    {/each}
  </div>
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

  .handles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .handle {
    position: absolute;
    pointer-events: auto;
    touch-action: none;
  }

  .handle.across {
    top: 0;
    width: 7px;
    cursor: col-resize;
  }

  .handle.down {
    left: 0;
    height: 7px;
    cursor: row-resize;
  }

  .handles.dragging .handle {
    pointer-events: none;
  }

  .sheet-surface :global(.dvn-scroller) {
    scrollbar-color: transparent transparent;
    scrollbar-width: thin;
  }

  .sheet-surface:hover :global(.dvn-scroller) {
    scrollbar-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent) transparent;
  }

  .sheet-surface :global(.dvn-scroller::-webkit-scrollbar) {
    width: calc(var(--token-spacing-unit) * 1.5);
    height: calc(var(--token-spacing-unit) * 1.5);
  }

  .sheet-surface :global(.dvn-scroller::-webkit-scrollbar-thumb) {
    border-radius: var(--token-radius-control);
    background-color: transparent;
    transition: background-color var(--token-motion-small) var(--token-ease-standard);
  }

  .sheet-surface:hover :global(.dvn-scroller::-webkit-scrollbar-thumb) {
    background-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent);
  }

  .sheet-surface :global(.dvn-scroller::-webkit-scrollbar-track) {
    background: transparent;
  }
</style>
