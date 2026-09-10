<script lang="ts">
  import type { GridColumn, Theme } from "@glideapps/glide-data-grid";
  import "@glideapps/glide-data-grid/dist/index.css";

  import SheetSurfaceBlocks from "$authored-components/sheet-surface/sheet-surface-blocks.svelte";
  import type { Editor } from "$authored-components/sheet-surface/sheet-surface-editor";
  import {
    blocksOf,
    columnWidth as trackColumnWidth,
    edgesOf,
    rowHeight as trackRowHeight,
    startsOf
  } from "$authored-components/sheet-surface/sheet-surface-geometry";
  import SheetSurfaceHandles from "$authored-components/sheet-surface/sheet-surface-handles.svelte";
  import { themeOf } from "$authored-components/sheet-surface/sheet-surface-theme";
  import { createSurfaceState } from "$authored-components/sheet-surface/sheet-surface.state.svelte";
  import { followsTheScroller } from "$authored-components/sheet-surface/procedures/effects/follows-the-scroller.svelte";
  import { mountsTheGrid } from "$authored-components/sheet-surface/procedures/effects/mounts-the-grid.svelte";
  import { rendersTheGrid } from "$authored-components/sheet-surface/procedures/effects/renders-the-grid.svelte";
  import { scrollsToACell } from "$authored-components/sheet-surface/procedures/effects/scrolls-to-a-cell.svelte";
  import { tracksSelectionGestures } from "$authored-components/sheet-surface/procedures/effects/tracks-selection-gestures.svelte";
  import type {
    SurfaceApi,
    SurfaceEdit,
    SurfaceFill,
    SurfaceHighlight,
    SurfaceHit,
    SurfacePaste,
    SurfaceScene,
    SurfaceSelection
  } from "$authored-components/sheet-surface/sheet-surface-types";

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
    onbegin,
    onselectiongesture
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
    /** A primary-pointer selection starts or finishes. */
    onselectiongesture?: (active: boolean) => void;
  } = $props();

  const APPEND_COLUMN = "append";
  const APPEND_WIDTH = 112;

  const held = createSurfaceState();

  const scale = $derived(zoom / 100);
  const theme = $derived(held.measure === undefined ? undefined : themeOf(held.measure, zoom));
  const mono = $derived(held.measure === undefined ? "monospace" : held.measure.family("--token-font-mono"));
  const base = $derived(held.measure === undefined ? 13 : held.measure.px("--token-text-label", 13) * scale);
  const appendAt = $derived(scene.columns.length);

  const columns = $derived.by((): readonly GridColumn[] => {
    const measure = held.measure;
    const own: GridColumn[] = scene.columns.map((column, index) => ({
      id: column.id,
      title: column.label,
      width: Math.round(held.drafts[index] ?? column.size * scale)
    }));
    if (onappendcolumn === undefined || measure === undefined) return own;
    return [
      ...own,
      {
        id: APPEND_COLUMN,
        title: appendColumnHint,
        width: Math.round(APPEND_WIDTH * scale),
        themeOverride: {
          bgHeader: measure.paint(undefined, "--token-surface-panel"),
          bgHeaderHasFocus: measure.paint(undefined, "--token-surface-panel-hover"),
          bgHeaderHovered: measure.paint(undefined, "--token-surface-panel-hover"),
          textHeader: measure.paint(undefined, "--token-ink-muted")
        }
      }
    ];
  });

  const regions = $derived.by((): SurfaceHighlight[] => {
    const cell = selection?.cell;
    if (held.focused || cell === undefined) return [];
    return [{ rect: { row: cell[1], column: cell[0], rows: 1, columns: 1 }, tone: "selected" }];
  });

  const columnWidth = (index: number) => trackColumnWidth(scene, held.drafts, scale, index);
  const rowHeight = (index: number) => trackRowHeight(scene, held.rowDrafts, scale, index);

  const starts = $derived(startsOf(scene, held.drafts, held.rowDrafts, scale));
  const edges = $derived(
    edgesOf(scene, starts, held.offset, held.region, held.drafts, held.rowDrafts, scale, appendAt)
  );
  const blocks = $derived(blocksOf(scene, starts, held.offset));

  const previewed = (kind: "column" | "row", index: number, size: number | undefined) => {
    if (kind === "column") {
      const { [index]: _gone, ...rest } = held.drafts;
      void _gone;
      held.drafts = size === undefined ? rest : { ...rest, [index]: size };
      return;
    }
    const { [index]: _gone, ...rest } = held.rowDrafts;
    void _gone;
    held.rowDrafts = size === undefined ? rest : { ...rest, [index]: size };
  };

  const editorOf = (): Editor | undefined => {
    const measure = held.measure;
    const paint = theme;
    if (measure === undefined || paint === undefined) return undefined;

    return {
      scene,
      selection,
      highlights,
      regions,
      columns,
      appendAt,
      scale,
      mono,
      base,
      measure,
      paint: paint as Partial<Theme>,
      width: held.size.width,
      height: held.size.height,
      drafts: held.drafts,
      rowDrafts: held.rowDrafts,
      resizing: (next) => {
        held.drafts = next;
      },
      showing: (range) => {
        held.region = { ...range, tick: held.region.tick + 1 };
      },
      ref: held.ref,
      appendHint,
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
      oncontext,
      onbegin
    };
  };

  followsTheScroller(held);

  tracksSelectionGestures({
    node: () => held.host,
    change: () => onselectiongesture
  });

  mountsTheGrid({
    held,
    selection: () => selection,
    ondelete: (chosen) => ondelete?.(chosen),
    api: (next) => {
      api = next;
    }
  });

  rendersTheGrid(held, editorOf);

  scrollsToACell({
    held,
    target: () => scrollTarget,
    zoom: () => zoom,
    selection: () => selection
  });

  const focusIn = () => {
    held.focused = true;
  };

  const focusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && held.host?.contains(next)) return;
    held.focused = false;
  };
</script>

<div bind:this={held.frame} class="sheet-surface" role="presentation">
  <div bind:this={held.host} class="host" onfocusin={focusIn} onfocusout={focusOut}></div>

  <SheetSurfaceBlocks {blocks} {selection} {scale} {mono} {base} />

  <div class="handles" class:dragging={held.dragging}>
    <SheetSurfaceHandles
      {scene}
      {scale}
      columns={edges.columns}
      rows={edges.rows}
      columnSize={columnWidth}
      rowSize={rowHeight}
      ondrag={(running) => (held.dragging = running)}
      onpreview={previewed}
      {onresize}
      {onrowresize}
    />
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

  .handles.dragging :global(.handle) {
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
