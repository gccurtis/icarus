<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import ArrowDownRight from "@lucide/svelte/icons/arrow-down-right";
  import Lock from "@lucide/svelte/icons/lock";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  import { gridSurface } from "$authored-components/screen/screen-grid.svelte";

  /**
   * One coordinate on a `ScreenGrid`: what it shows, and what it cannot show.
   *
   * **Not `ScreenCell`.** That cell belongs to a row that is a record, and its
   * `name` prop is the row's identity *and* its click target — the name is both
   * what the row is and how you open it. A cell here has no name of that kind.
   * Its identity is its address, the address is not its content, and it keeps the
   * address when it is empty. So this takes `address` and no title, and it is not
   * a button: four hundred buttons in the tab order is not a sheet, it is a wall.
   * It is a `gridcell`, and the grid around it holds the single tab stop.
   *
   * **Selection is not a prop.** Whether this is the cell the cursor is on, and
   * whether it falls inside the marked range, are read from the grid by address.
   * Passing them in would let two coordinates both claim to be the one you are
   * on, and would leave the caller re-deriving range membership per cell.
   *
   * **A state the value cannot show is a mark, not a tint.** A spilled cell, a
   * cell in error and a read-only cell all render whatever they render; nothing
   * about the text says which. So each carries a glyph and a word — the glyph
   * where it can be seen at a glance, the word in the accessible name and in the
   * tooltip — and the tint is the third channel rather than the only one.
   *
   * **Figures are always tabular here.** Every cell sits in a column of values
   * that has to line up with the ones above and below it, which on a sheet is
   * true of all of them and not only of the ones a caller remembers to mark.
   */
  let {
    address,
    align = "start",
    state,
    note,
    children
  }: {
    /** "A1". What the inspector will name, and the only identity this has. */
    address: string;
    /** Where the value sits in the cell. `end` for figures, as a sheet sets it. */
    align?: "start" | "center" | "end";
    /**
     * What the value cannot say about itself.
     *
     * `spilled` — one answer occupying cells it did not start in; `error` — a
     * formula that did not resolve; `read-only` — a cell a write would be
     * refused on. A spill child is read-only too, and says the more specific of
     * the two.
     */
    state?: "spilled" | "error" | "read-only";
    /**
     * The state in the caller's own words: "Spilled from B2", "#DIV/0!".
     *
     * Read out with the cell and shown on hover. Without it the state still has
     * a word, but a generic one — and "spilled" is far less use than which cell
     * it spilled from.
     */
    note?: string;
    /** What the cell shows. Absent for a coordinate nothing is stored at. */
    children?: Snippet;
  } = $props();

  const trace = traceNode("ScreenGridCell", () => ({ address, align, state, note }));

  const grid = gridSurface();

  const current = $derived(grid?.address === address);
  const marked = $derived(grid?.within(address) ?? false);

  const MARK: Record<
    NonNullable<typeof state>,
    Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>
  > = {
    spilled: ArrowDownRight,
    error: TriangleAlert,
    "read-only": Lock
  };

  /** The word, for the states whose caller did not give a better one. */
  const WORD: Record<NonNullable<typeof state>, string> = {
    spilled: "Spilled",
    error: "Error",
    "read-only": "Read-only"
  };

  const TONE: Record<NonNullable<typeof state>, string> = {
    spilled: "bg-intelligence-surface text-intelligence-text",
    error: "bg-danger-surface text-danger-text",
    "read-only": "text-ink-muted"
  };

  const JUSTIFY = {
    start: "justify-start text-start",
    center: "justify-center text-center",
    end: "justify-end text-end"
  } as const;

  const said = $derived(state === undefined ? undefined : (note ?? WORD[state]));
  const Mark = $derived(state === undefined ? undefined : MARK[state]);
</script>

<!--
  A `gridcell` rather than a button, and the keyboard is the grid's: the cell
  hands the event straight back so that one implementation of "which way is
  left" serves every coordinate. `tabindex` is the roving one — 0 on the cell
  the cursor is on and -1 on the rest — which is what keeps a four-hundred-cell
  sheet to a single tab stop.
-->
<td
  {...trace}
  role="gridcell"
  data-address={address}
  tabindex={current ? 0 : -1}
  aria-selected={current || marked}
  aria-readonly={state === "read-only" || state === "spilled" ? "true" : undefined}
  title={said}
  onclick={() => grid?.go(address)}
  onkeydown={(event: KeyboardEvent) => grid?.key(event)}
  class={cn(
    "text-body-sm text-ink-primary border-border-subtle cursor-cell overflow-hidden border-b border-e px-1.5 tabular-nums",
    "focus-visible:outline-interactive-border focus-visible:outline-2 focus-visible:-outline-offset-2",
    state !== undefined && TONE[state],
    /* The mark stays; the range fill wins the surface, because it is what the
       reader is doing right now rather than what the cell is. */
    marked && "bg-active-surface",
    /* Positioned, so the cursor's outline paints over the neighbouring fills
       rather than under them — and still under the headings, which are stuck. */
    current && "outline-active-border relative outline-2 -outline-offset-1"
  )}
>
  <span class={cn("flex items-center gap-1", JUSTIFY[align])}>
    <span class="truncate">
      {#if children}{@render children()}{/if}
    </span>
    {#if Mark}
      <span class="shrink-0"><Mark size={10} aria-hidden="true" /></span>
      <!-- The word behind the glyph: a mark nobody can name is a decoration. -->
      <span class="sr-only">{said}</span>
    {/if}
  </span>
</td>
