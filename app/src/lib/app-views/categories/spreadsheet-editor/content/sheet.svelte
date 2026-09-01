<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Lock from "@lucide/svelte/icons/lock";

  import { ScreenNote, ScreenSurface } from "$authored-components/screen";
  import {
    cellsIn,
    objectsIn,
    problemsIn,
    sheetStyles,
    spreadsheetRecord,
    type Cell,
    type NamedCellStyle
  } from "$capabilities/resource";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  /**
   * Spreadsheet editor — the only state this category has.
   *
   * `docs/screen-panel-views/screens/spreadsheet-editor/workspace.md` is the
   * specification. **One region, `editor`, and one track** — a grid edge to edge,
   * with no sheet tabs, no formula bar and no name box taking rows off it. A tab
   * is a spreadsheet, not a workbook of sheets, so there is nothing above the
   * grid to switch between and nothing below it to switch with.
   *
   * **Univer is not installed.** The grid surface — headings, scrolling,
   * selection, in-cell editing, merges and the rendering of a sparse sheet —
   * would be its. What is drawn here is the part that is ours: a sparse grid
   * where an empty coordinate really is empty, a spill that names its origin and
   * whose children are read-only, errors that read as repair jobs, and charts
   * anchored to a cell and left read-only because they have no stable id.
   *
   * **Every value on this grid came out of Icarus's formula engine.** Univer's is
   * bypassed rather than configured: two engines would mean two answers, and only
   * one of them can be the one a document's inline formula reads.
   *
   * **Nothing offers a row or a column lens.** A cell's identity is its A1
   * address; rows and columns are not identified model objects, which is why the
   * headings here are labels rather than controls.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const record = $derived(spreadsheetRecord(spreadsheetId).current);
  const cells = $derived(cellsIn(spreadsheetId).current);
  const charts = $derived(objectsIn(spreadsheetId).current);
  const problems = $derived(problemsIn(spreadsheetId).current);
  const styles = $derived(sheetStyles(spreadsheetId).current);

  /**
   * Wider and deeper than the used range on purpose. A grid that stopped at the
   * last populated cell would be a table pretending to be a spreadsheet — the
   * empty coordinates are the point, and the charts anchor into them.
   */
  const COLUMNS = Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index));
  const ROWS = Array.from({ length: 36 }, (_, index) => index + 1);

  const at = $derived(new Map<string, Cell>(cells.map((cell) => [cell.address, cell])));
  const styleOf = $derived(
    new Map<string, NamedCellStyle>(styles.map((style) => [style.id, style]))
  );

  const columnIndex = (address: string) => address.replace(/[0-9]/g, "").charCodeAt(0) - 65;
  const rowIndex = (address: string) => Number(address.replace(/[A-Z]/g, ""));

  /** "360 × 220 px" as it is stored; the object record is the only place a size lives. */
  const sized = (size: string) => size.split("×").map((part) => Number.parseFloat(part.trim()));

  const ALIGN: Record<Cell["alignment"], string> = {
    left: "text-start",
    center: "text-center",
    right: "text-end"
  };

  let selected = $state<string>("C2");

  /**
   * Which lens a cell opens is decided by what the cell *is*, not by a menu. An
   * error is a repair job, a spill child is read-only and names its origin, and a
   * formula brings what it reads and what it feeds with it.
   */
  const lensFor = (cell: Cell | undefined) => {
    if (cell === undefined) return "spreadsheet-editor.cell";
    if (cell.error !== undefined) return "spreadsheet-editor.error-cell";
    if (cell.spillOrigin !== undefined && cell.spillOrigin !== cell.address) return "spreadsheet-editor.spill";
    if (cell.formula !== undefined) return "spreadsheet-editor.cell-with-formula";
    return "spreadsheet-editor.cell";
  };

  const choose = (address: string) => {
    selected = address;
    view.inspect(lensFor(at.get(address)), { kind: "cell", id: address });
  };

  /** Zoom, by the same pinch mechanism as the document and the deck. */
  let zoom = $state(1);

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoom = Math.min(2, Math.max(0.5, zoom - event.deltaY / 400));
  };
</script>

<ScreenSurface wide class="gap-0 overflow-y-hidden p-0">
  <div class="board">
    <div class="area-editor">
      <!--
        Edge to edge. Nothing sits between the zone and the grid: the cell you are
        on is named in the inspector, and its formula lives there too.
      -->
      <div class="canvas bg-surface-canvas" onwheel={pinch}>
        <div class="scaled" style="--zoom: {zoom}">
          <div class="sheet bg-surface-panel">
            <!--
              Headings are labels, not controls. Nothing here offers a row or a
              column lens, because neither is an identified thing to open.
            -->
            <div class="head corner bg-surface-elevated border-border-subtle"></div>
            {#each COLUMNS as column (column)}
              <div class="head bg-surface-elevated border-border-subtle text-caption text-ink-muted">
                {column}
              </div>
            {/each}

            {#each ROWS as row (row)}
              <div
                class="head stub bg-surface-elevated border-border-subtle text-caption text-ink-muted tabular-nums"
              >
                {row}
              </div>
              {#each COLUMNS as column (column)}
                {@const address = `${column}${row}`}
                {@const cell = at.get(address)}
                {@const style = cell?.styleId === undefined ? undefined : styleOf.get(cell.styleId)}
                <button
                  type="button"
                  class="cell border-border-subtle text-body-sm {ALIGN[cell?.alignment ?? 'left']}"
                  class:is-selected={selected === address}
                  class:is-spill={cell?.spillOrigin !== undefined}
                  class:is-total={style?.border === "Top rule"}
                  class:text-danger-text={cell?.error !== undefined}
                  class:text-ink-primary={cell !== undefined && cell.error === undefined}
                  style={style === undefined ? undefined : `font-weight: ${style.weight}`}
                  title={cell?.formula ?? cell?.content ?? address}
                  aria-label={address}
                  onclick={() => choose(address)}
                >
                  {cell?.shows ?? ""}
                </button>
              {/each}
            {/each}

            <!--
              Charts float over the grid, anchored to a cell. They are read-only:
              `SheetChart` has no stable id, which is enough for a list and not
              enough for selection, granular update, reconciliation or comments.
            -->
            {#each charts as chart (chart.index)}
              {@const measure = sized(chart.size)}
              <div
                class="chart bg-surface-panel border-border-subtle rounded-panel border"
                style="left: calc(var(--sheet-stub) + {columnIndex(
                  chart.anchor
                )} * var(--sheet-col)); top: calc({rowIndex(
                  chart.anchor
                )} * var(--sheet-row)); width: {measure[0]}px; height: {measure[1]}px"
              >
                <button
                  type="button"
                  class="chart-body"
                  onclick={() =>
                    view.inspect("spreadsheet-editor.chart", {
                      kind: "chart",
                      id: String(chart.index)
                    })}
                >
                  <span class="text-caption text-ink-secondary flex items-center gap-1.5">
                    <ChartColumn size={14} aria-hidden="true" />
                    <span class="truncate">{chart.title}</span>
                    <Lock size={12} aria-hidden="true" class="text-ink-muted ms-auto shrink-0" />
                  </span>
                  <span class="plot" aria-hidden="true">
                    {#each [58, 84, 41, 72, 63] as height, index (index)}
                      <span class="bar bg-border-strong" style="height: {height}%"></span>
                    {/each}
                  </span>
                  <span class="text-caption text-ink-muted font-mono truncate">
                    {chart.sourceRange}{chart.overlapped ? " · overlapped" : ""}
                  </span>
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="under bg-surface-panel border-border-subtle flex flex-col gap-1 border-t px-4 py-2">
        <ScreenNote tone="gap" meta="Pinch to zoom · {Math.round(zoom * 100)}%">
          Univer is not installed. The grid surface — headings, scrolling, in-cell editing, merges
          and the rendering of a sparse sheet — is its; the calculation behind every figure here is
          Icarus's engine, which is the only calculation authority and is not one of Univer's
          options. Nothing on this grid types.
        </ScreenNote>
        <ScreenNote
          meta="{record.usedRange} · {record.populatedCells} populated · {problems.length} broken"
        >
          The grid is sparse: an empty coordinate has no persisted cell, which is why formatting an
          empty range has nowhere to be stored. A spill child is tinted, read-only and names its
          origin; a write into the range it occupies fails visibly rather than quietly breaking it.
          There is no formula bar and no name box, and there are no sheet tabs — a tab is one
          spreadsheet.
        </ScreenNote>
      </div>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification: one `1fr` track, one `editor` band.
   * A narrow fallback has nothing to reorder — a single column is already what it
   * would produce — so the grid scrolls sideways instead of reflowing, which is
   * the only honest thing a grid can do.
   */
  .board {
    display: grid;
    flex: 1;
    min-height: calc(var(--token-spacing-unit) * 120);
    grid-template-columns: 1fr;
    grid-template-areas: "editor";
  }

  .area-editor {
    grid-area: editor;
    display: flex;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
  }

  .canvas {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .scaled {
    width: max-content;
    transform: scale(var(--zoom));
    transform-origin: top left;
  }

  .sheet {
    position: relative;
    display: grid;
    width: max-content;
    /* The stub column carries a row number; the rest are one width, as a grid is. */
    --sheet-stub: calc(var(--token-spacing-unit) * 11);
    --sheet-col: calc(var(--token-spacing-unit) * 28);
    --sheet-row: calc(var(--token-spacing-unit) * 6);
    grid-template-columns: var(--sheet-stub) repeat(12, var(--sheet-col));
    grid-auto-rows: var(--sheet-row);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: center;
    border-inline-end-width: 1px;
    border-bottom-width: 1px;
    border-style: solid;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .stub {
    position: sticky;
    top: auto;
    left: 0;
    z-index: 1;
  }

  .corner {
    left: 0;
    z-index: 3;
  }

  .cell {
    display: flex;
    align-items: center;
    padding-inline: calc(var(--token-spacing-unit) * 2);
    border-inline-end-width: 1px;
    border-bottom-width: 1px;
    border-style: solid;
    overflow: hidden;
    white-space: nowrap;
  }

  .cell.is-total {
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: var(--token-border-strong);
  }

  /* A spill is one answer occupying cells it did not start in. */
  .cell.is-spill {
    background: var(--token-color-intelligence-surface);
  }

  .cell:hover {
    background: var(--token-surface-panel-hover);
  }

  .cell.is-selected {
    outline: 2px solid var(--token-color-active-border);
    outline-offset: -1px;
  }

  .chart {
    position: absolute;
    z-index: 1;
    overflow: hidden;
    box-shadow: var(--token-shadow-panel);
  }

  .chart-body {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2);
    text-align: start;
  }

  .plot {
    display: flex;
    flex: 1;
    align-items: flex-end;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: 0;
  }

  .bar {
    flex: 1;
    border-radius: var(--token-radius-control) var(--token-radius-control) 0 0;
  }

  .under {
    flex-shrink: 0;
  }
</style>
