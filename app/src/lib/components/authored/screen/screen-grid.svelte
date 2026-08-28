<script lang="ts" module>
  import { getContext, setContext } from "svelte";

  /** One coordinate, handed to the `cell` snippet. */
  export type GridAddress = {
    /** "A1". The only name a value on a sheet has. */
    address: string;
    /** "A". A label over a column, not an identified object. */
    column: string;
    /** 1-based, the way a sheet counts. */
    row: number;
  };

  /**
   * What a cell reads from the grid around it.
   *
   * A cell asks rather than being told: the cursor, the marked range and the
   * keyboard all belong to the grid, and a cell that took them as props would
   * let two coordinates claim the same one.
   */
  export type GridSurface = {
    /** The address the cursor is on. */
    readonly address: string;
    /** Whether an address falls inside the marked range. */
    within(address: string): boolean;
    /** Put the cursor here. */
    go(address: string): void;
    /** Move the cursor, if this key moves it. */
    key(event: KeyboardEvent): void;
  };

  const SURFACE = Symbol("screen-grid");

  /** Read by `ScreenGridCell`. Undefined when a cell is drawn outside a grid. */
  export const gridSurface = (): GridSurface | undefined =>
    getContext<GridSurface | undefined>(SURFACE);
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A sheet: lettered columns, numbered rows, and a cell you can name.
   *
   * **Not `ScreenTable`.** A table's columns are named and the names carry the
   * meaning — Name, Kind, Updated — and its rows are records, which is why
   * `ScreenCell` makes the first cell of a row the row's identity and its click
   * target. Here the columns *are* the addresses. A value's identity is A1, it is
   * still A1 when the cell is empty, and neither a row nor a column is an
   * identified thing at all — which is why the headings here open nothing. A
   * table with A, B, C along the top would be a table lying about what its
   * columns mean, and a table row cannot be addressed in any case.
   *
   * **The columns are a count, not a list of names.** There is no way to title a
   * column on this component, which is that difference stated as a type: the
   * letters are generated from the count, because on a sheet a column heading is
   * an ordinal and never a claim about what is under it.
   *
   * **Moving is selecting.** One cursor, held as a roving tabindex, so a sheet of
   * four hundred coordinates puts one stop in the tab order rather than four
   * hundred. Arrow keys move it, Home and End reach the ends of the row, Ctrl
   * with either reaches the ends of the sheet — and every one of those moves the
   * selection with it, because a spreadsheet has no state in which the cursor
   * sits on a cell that is not the selected one.
   *
   * **Every coordinate is drawn, populated or not.** The sheet is sparse: an
   * empty address has no stored cell, and is still an address, still selectable,
   * still somewhere a formula can point. A grid that stopped at the last
   * populated cell would be a table wearing a sheet's clothes.
   *
   * **One grid, not a workbook.** No sheet tabs and no frozen-column rule: a tab
   * is a spreadsheet. There is no formula bar and no name box either — the
   * inspector names the cell the cursor is on and holds the formula in it, and
   * both of those would take rows off the only thing this screen is.
   *
   * The frame is written here rather than taken from `simple-components/table`:
   * that container scrolls one axis, and a sheet scrolls two with both headings
   * stuck to their edges. Nothing is lost by it, because a gridcell is not a
   * control — the one control a sheet needs, in-cell editing, is the caller's to
   * put inside a cell.
   */
  let {
    label,
    columns = 12,
    rows = 36,
    address = $bindable("A1"),
    range,
    onselect,
    cell
  }: {
    /** What this sheet is. The grid's accessible name. */
    label: string;
    /** How many columns, not which: the letters come from the count. */
    columns?: number;
    rows?: number;
    /** The cell the cursor is on, as an A1 address. */
    address?: string;
    /** A marked span, as "B2:D8". A bare address marks one cell. */
    range?: string;
    /** Fired on every move, not only on a click: moving is selecting. */
    onselect?: (address: string) => void;
    /** Exactly one `ScreenGridCell`, for every coordinate the grid asks for. */
    cell: Snippet<[GridAddress]>;
  } = $props();

  const trace = traceNode("ScreenGrid", () => ({ label, columns, rows, address, range }));

  /** One treatment for all four headings, so the corner cannot drift from them. */
  const HEAD =
    "text-caption text-ink-muted bg-surface-elevated border-border-subtle border-b border-e px-1.5 font-normal";

  /** How far PageUp and PageDown go. A screenful of a six-unit row, near enough. */
  const PAGE = 10;

  const letters = (index: number): string => {
    let name = "";
    let step = index;
    while (step >= 0) {
      name = String.fromCharCode(65 + (step % 26)) + name;
      step = Math.floor(step / 26) - 1;
    }
    return name;
  };

  const LETTERS = $derived(Array.from({ length: columns }, (_, index) => letters(index)));
  const NUMBERS = $derived(Array.from({ length: rows }, (_, index) => index + 1));

  /** A1 read as a coordinate. The one piece of arithmetic a table never needs. */
  const at = (target: string): { column: number; row: number } | undefined => {
    const parts = /^([A-Z]+)([0-9]+)$/.exec(target);
    if (parts === null) return undefined;
    let column = 0;
    for (const letter of parts[1]) column = column * 26 + (letter.charCodeAt(0) - 64);
    return { column: column - 1, row: Number(parts[2]) - 1 };
  };

  const named = (column: number, row: number): string => `${letters(column)}${row + 1}`;

  const span = $derived.by(() => {
    if (range === undefined) return undefined;
    const [from, to] = range.split(":");
    const start = at(from ?? "");
    const end = at(to ?? from ?? "");
    if (start === undefined || end === undefined) return undefined;
    return {
      first: Math.min(start.column, end.column),
      last: Math.max(start.column, end.column),
      top: Math.min(start.row, end.row),
      bottom: Math.max(start.row, end.row)
    };
  });

  const within = (target: string): boolean => {
    const marked = span;
    if (marked === undefined) return false;
    const spot = at(target);
    if (spot === undefined) return false;
    return (
      spot.column >= marked.first &&
      spot.column <= marked.last &&
      spot.row >= marked.top &&
      spot.row <= marked.bottom
    );
  };

  let surface = $state<HTMLDivElement | null>(null);

  const go = (next: string) => {
    address = next;
    onselect?.(next);
    /*
      The cursor is a roving tabindex, so moving it has to move DOM focus with
      it — otherwise the keyboard goes on answering from the cell someone left.
    */
    surface?.querySelector<HTMLElement>(`[data-address="${next}"]`)?.focus();
  };

  const clamp = (value: number, limit: number): number => Math.max(0, Math.min(limit - 1, value));

  const key = (event: KeyboardEvent) => {
    const here = at(address);
    if (here === undefined) return;

    const far = event.ctrlKey || event.metaKey;
    let column = here.column;
    let row = here.row;

    switch (event.key) {
      case "ArrowUp":
        row -= 1;
        break;
      case "ArrowDown":
        row += 1;
        break;
      case "ArrowLeft":
        column -= 1;
        break;
      case "ArrowRight":
        column += 1;
        break;
      case "PageUp":
        row -= PAGE;
        break;
      case "PageDown":
        row += PAGE;
        break;
      case "Home":
        column = 0;
        if (far) row = 0;
        break;
      case "End":
        column = columns - 1;
        if (far) row = rows - 1;
        break;
      default:
        /* Tab is left alone on purpose: it is how a keyboard leaves the sheet. */
        return;
    }

    event.preventDefault();
    go(named(clamp(column, columns), clamp(row, rows)));
  };

  setContext<GridSurface>(SURFACE, {
    get address() {
      return address;
    },
    within,
    go,
    key
  });

  const cursor = $derived(at(address));
</script>

<div
  {...trace}
  bind:this={surface}
  class="surface border-border-subtle rounded-panel bg-surface-panel border"
>
  <table
    role="grid"
    aria-label={label}
    aria-colcount={columns}
    aria-rowcount={rows}
    class="sheet border-collapse"
  >
    <colgroup>
      <col class="stub" />
      {#each LETTERS as column (column)}
        <col class="column" />
      {/each}
    </colgroup>

    <!--
      Headings are labels. Nothing here opens a row or a column lens, because
      neither is a thing the model identifies — only the cell is. The heading of
      the row and column the cursor is in is marked, so the address the inspector
      is naming can be found by looking: that is the job a name box would
      otherwise be doing, done without taking a row off the sheet.
    -->
    <thead>
      <tr>
        <th scope="col" class={cn(HEAD, "corner")}>
          <span class="sr-only">Row</span>
        </th>
        {#each LETTERS as column, index (column)}
          <th
            scope="col"
            class={cn(HEAD, cursor?.column === index && "bg-surface-panel-hover text-ink-secondary")}
          >
            {column}
          </th>
        {/each}
      </tr>
    </thead>

    <tbody>
      {#each NUMBERS as row, index (row)}
        <tr>
          <th
            scope="row"
            class={cn(
              HEAD,
              "tabular-nums",
              cursor?.row === index && "bg-surface-panel-hover text-ink-secondary"
            )}
          >
            {row}
          </th>
          {#each LETTERS as column (column)}
            {@render cell({ address: `${column}${row}`, column, row })}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  /*
   * Two axes of scroll in one container, which is what lets both headings
   * stick: a sheet is read rightward as often as downward, and a heading that
   * has left the screen turns every address into a counting exercise.
   */
  .surface {
    overflow: auto;
    max-height: calc(var(--token-spacing-unit) * 160);
  }

  /*
   * A grid's columns are one width, because they hold addresses rather than
   * kinds of thing. `fixed` so a long value widens nothing: it is clipped, as it
   * is on every sheet, and the inspector holds what the cell actually says.
   */
  .sheet {
    width: max-content;
    table-layout: fixed;
  }

  .stub {
    width: calc(var(--token-spacing-unit) * 11);
  }

  .column {
    width: calc(var(--token-spacing-unit) * 28);
  }

  .sheet tr {
    height: calc(var(--token-spacing-unit) * 6);
  }

  .sheet thead th {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .sheet tbody th {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
  }

  /* The corner is stuck to both edges, so it has to sit above both. */
  .sheet thead th.corner {
    inset-inline-start: 0;
    z-index: 3;
  }
</style>
