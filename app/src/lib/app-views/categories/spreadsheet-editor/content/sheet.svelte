<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Lock from "@lucide/svelte/icons/lock";

  import { ScreenNote, ScreenSurface } from "$authored-components/screen";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  type Cell = {
    readonly address: string;
    readonly column: string;
    readonly row: number;
    readonly content: string;
    readonly shows: string;
    readonly type: "number" | "text" | "logic" | "date";
    readonly formula?: string;
    readonly styleId?: string;
    readonly alignment: "left" | "center" | "right";
    readonly valueFormat?: string;
    readonly spillOrigin?: string;
    readonly error?: "#REF!" | "#NAME?" | "#DIV/0!" | "#VALUE!";
  };

  type CellProblem = {
    readonly address: string;
    readonly error: "#REF!" | "#NAME?" | "#DIV/0!" | "#VALUE!";
    readonly formula: string;
    readonly explanation: string;
  };

  type SheetObject = {
    readonly index: number;
    readonly kind: "Column" | "Bar" | "Line" | "Pie";
    readonly title: string;
    readonly sourceRange: string;
    readonly anchor: string;
    readonly size: string;
    readonly overlapped: boolean;
  };

  type NamedCellStyle = {
    readonly id: string;
    readonly name: string;
    readonly weight: number;
    readonly alignment: "left" | "center" | "right";
    readonly valueFormat?: string;
    readonly border?: string;
    readonly shorthand: string;
    readonly usedByCells: number;
  };

  type SpreadsheetRecord = {
    readonly id: string;
    readonly title: string;
    readonly usedRange: string;
    readonly populatedCells: number;
    readonly saved: string;
    readonly updated: string;
  };

  type Read<T> = {
    readonly current: T;
    readonly error: undefined;
    readonly loading: false;
    refresh: () => Promise<void>;
  };

  const read = <T,>(current: T): Read<T> => ({
    current,
    error: undefined,
    loading: false,
    refresh: async () => {}
  });

  type CellInput = Omit<Cell, "address" | "column" | "row" | "shows"> & {
    readonly shows?: string;
  };

  const cellAt = (address: string, input: CellInput): Cell => ({
    ...input,
    address,
    column: address.replace(/[0-9]/g, ""),
    row: Number(address.replace(/[A-Z]/g, "")),
    shows: input.shows ?? input.content
  });

  const head = (address: string, content: string): Cell =>
    cellAt(address, { content, type: "text", alignment: "center", styleId: "cs-header" });

  const CELLS: readonly Cell[] = [
    head("A1", "Substation"),
    head("B1", "Feeder"),
    head("C1", "Customer-minutes lost"),
    head("D1", "Storm events"),
    head("E1", "Avoided minutes (modelled)"),
    head("F1", "Hardening spend ($M)"),
    head("G1", "Cost per avoided minute"),

    cellAt("A2", { content: "Millbrook", type: "text", alignment: "left" }),
    cellAt("B2", { content: "F-12", type: "text", alignment: "left" }),
    cellAt("C2", {
      content: "1842000",
      shows: "1,842,000",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0"
    }),
    cellAt("D2", { content: "2", type: "number", alignment: "right" }),
    cellAt("E2", {
      content: "=avoidedMinutes(costModel)",
      formula: "=avoidedMinutes(costModel)",
      shows: "268,110",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0",
      spillOrigin: "E2"
    }),
    cellAt("F2", {
      content: "11.4",
      shows: "11.40",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),
    cellAt("G2", {
      content: '=IF(E2=0,"",F2*1000000/E2)',
      formula: '=IF(E2=0,"",F2*1000000/E2)',
      shows: "42.52",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),

    cellAt("A3", { content: "Ward 3", type: "text", alignment: "left" }),
    cellAt("B3", { content: "F-04", type: "text", alignment: "left" }),
    cellAt("C3", {
      content: "318400",
      shows: "318,400",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0"
    }),
    cellAt("D3", { content: "3", type: "number", alignment: "right" }),
    cellAt("E3", {
      content: "194224",
      shows: "194,224",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0",
      spillOrigin: "E2"
    }),
    cellAt("F3", {
      content: "8.1",
      shows: "8.10",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),
    cellAt("G3", {
      content: '=IF(E3=0,"",F3*1000000/E3)',
      formula: '=IF(E3=0,"",F3*1000000/E3)',
      shows: "41.70",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),

    cellAt("A4", { content: "Harbor Point", type: "text", alignment: "left" }),
    cellAt("B4", { content: "F-07", type: "text", alignment: "left" }),
    cellAt("C4", {
      content: "286150",
      shows: "286,150",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0"
    }),
    cellAt("D4", { content: "2", type: "number", alignment: "right" }),
    cellAt("E4", {
      content: "171690",
      shows: "171,690",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0",
      spillOrigin: "E2"
    }),
    cellAt("F4", {
      content: "7.25",
      shows: "7.25",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),
    cellAt("G4", {
      content: '=IF(E4=0,"",F4*1000000/E4)',
      formula: '=IF(E4=0,"",F4*1000000/E4)',
      shows: "42.23",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),

    cellAt("A5", { content: "Cedar Line", type: "text", alignment: "left" }),
    cellAt("B5", { content: "F-19", type: "text", alignment: "left" }),
    cellAt("C5", {
      content: "158720",
      shows: "158,720",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0"
    }),
    cellAt("D5", { content: "1", type: "number", alignment: "right" }),
    cellAt("E5", {
      content: "92057",
      shows: "92,057",
      type: "number",
      alignment: "right",
      styleId: "cs-minutes",
      valueFormat: "#,##0",
      spillOrigin: "E2"
    }),
    cellAt("F5", {
      content: "4.6",
      shows: "4.60",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),
    cellAt("G5", {
      content: '=IF(E5=0,"",F5*1000000/E5)',
      formula: '=IF(E5=0,"",F5*1000000/E5)',
      shows: "49.97",
      type: "number",
      alignment: "right",
      styleId: "cs-currency",
      valueFormat: "#,##0.00"
    }),

    cellAt("A6", { content: "Total", type: "text", alignment: "left", styleId: "cs-total" }),
    cellAt("B6", { content: "4 feeders", type: "text", alignment: "left", styleId: "cs-total" }),
    cellAt("C6", {
      content: "=SUM(C2:C5)",
      formula: "=SUM(C2:C5)",
      shows: "2,605,270",
      type: "number",
      alignment: "right",
      styleId: "cs-total",
      valueFormat: "#,##0"
    }),
    cellAt("D6", {
      content: "=SUM(D2:D5)",
      formula: "=SUM(D2:D5)",
      shows: "8",
      type: "number",
      alignment: "right",
      styleId: "cs-total"
    }),
    cellAt("E6", {
      content: "=SUM(E2:E5)",
      formula: "=SUM(E2:E5)",
      shows: "726,081",
      type: "number",
      alignment: "right",
      styleId: "cs-total",
      valueFormat: "#,##0"
    }),
    cellAt("F6", {
      content: "=SUM(F2:F5)",
      formula: "=SUM(F2:F5)",
      shows: "31.35",
      type: "number",
      alignment: "right",
      styleId: "cs-total",
      valueFormat: "#,##0.00"
    }),
    cellAt("G6", {
      content: "=AVERAGE(G2:G5)",
      formula: "=AVERAGE(G2:G5)",
      shows: "44.11",
      type: "number",
      alignment: "right",
      styleId: "cs-total",
      valueFormat: "#,##0.00"
    }),

    cellAt("A8", { content: "Scratch — repair before filing", type: "text", alignment: "left" }),
    cellAt("D8", {
      content: "=SUM(#REF!)",
      formula: "=SUM(#REF!)",
      shows: "#REF!",
      type: "number",
      alignment: "right",
      error: "#REF!"
    }),
    cellAt("F8", {
      content: "=F6/eventCount",
      formula: "=F6/eventCount",
      shows: "#NAME?",
      type: "number",
      alignment: "right",
      error: "#NAME?"
    })
  ];

  const OBJECTS: readonly SheetObject[] = [
    {
      index: 0,
      kind: "Column",
      title: "Customer-minutes by substation",
      sourceRange: "A1:C5",
      anchor: "E9",
      size: "360 × 220 px",
      overlapped: false
    },
    {
      index: 1,
      kind: "Line",
      title: "Avoided minutes by event",
      sourceRange: "A1:E5",
      anchor: "A14",
      size: "420 × 240 px",
      overlapped: true
    },
    {
      index: 2,
      kind: "Bar",
      title: "Hardening spend by feeder",
      sourceRange: "B1:B5,F1:F5",
      anchor: "A26",
      size: "360 × 200 px",
      overlapped: false
    }
  ];

  const SHEET_STYLES: readonly NamedCellStyle[] = [
    {
      id: "cs-header",
      name: "Header",
      weight: 600,
      alignment: "center",
      shorthand: "600 · centered",
      usedByCells: 7
    },
    {
      id: "cs-currency",
      name: "Currency",
      weight: 400,
      alignment: "right",
      valueFormat: "$#,##0.00",
      shorthand: "$#,##0.00",
      usedByCells: 8
    },
    {
      id: "cs-minutes",
      name: "Minutes",
      weight: 400,
      alignment: "right",
      valueFormat: "#,##0",
      shorthand: "#,##0",
      usedByCells: 8
    },
    {
      id: "cs-total",
      name: "Total",
      weight: 600,
      alignment: "right",
      border: "Top rule",
      shorthand: "600 · top border",
      usedByCells: 7
    }
  ];

  const spreadsheetRecord = (spreadsheetId: string): Read<SpreadsheetRecord> =>
    read({
      id: spreadsheetId,
      title: "Outage cost model",
      usedRange: "A1:G8",
      populatedCells: CELLS.length,
      saved: "All changes saved",
      updated: "2 hours ago"
    });

  const cellsIn = (spreadsheetId: string): Read<readonly Cell[]> => {
    void spreadsheetId;
    return read(CELLS);
  };

  const objectsIn = (spreadsheetId: string): Read<readonly SheetObject[]> => {
    void spreadsheetId;
    return read(OBJECTS);
  };

  const problemsIn = (spreadsheetId: string): Read<readonly CellProblem[]> => {
    void spreadsheetId;
    return read([
      {
        address: "D8",
        error: "#REF!",
        formula: "=SUM(#REF!)",
        explanation: "This formula refers to a range that no longer exists."
      },
      {
        address: "F8",
        error: "#NAME?",
        formula: "=F6/eventCount",
        explanation: "No name in this spreadsheet or this project is called eventCount."
      }
    ]);
  };

  const sheetStyles = (spreadsheetId: string): Read<readonly NamedCellStyle[]> => {
    void spreadsheetId;
    return read(SHEET_STYLES);
  };

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
