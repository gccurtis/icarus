<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$vendored-components/table";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * The table eight screens use to list what they hold.
   *
   * Rows are clickable and set an inspection; the table itself owns only the
   * frame, the header and the seams. Columns are the caller's, because no two of
   * these tables carry the same ones and a column model would be a schema for
   * eight one-off shapes.
   *
   * `simple-components/table` underneath, so the element structure and the
   * horizontal overflow container are the registry's. What this adds is the
   * screen's frame and the header treatment.
   *
   * **There is no status column anywhere.** A row is a thing, not a health
   * report — what cannot proceed lives in a health view and in the status bar.
   * The one exception is a table *about* dispatch, where the last result is the
   * subject rather than a judgment.
   *
   * **`scroll` is for a table that is a band of a grid**, where the band has a
   * height and the table has to give in to it — the same bargain `ScreenList`
   * strikes for a feed. The headings stay put while the rows move, because a
   * column you cannot name is a column you have to scroll back up to read. A
   * table that simply runs down the page must not take it: two scrolls inside
   * one `ScreenSurface` is how a reader loses the bottom of the page.
   *
   * **It scrolls without a scrollbar**, on the same rule as every other surface
   * here: a row cut off at the frame already says there is more, and a gutter
   * would take width from the last column to repeat it.
   */
  let {
    columns = [],
    scroll = false,
    head,
    children
  }: {
    /** One plain row of headings. Ignored when `head` is given. */
    columns?: readonly string[];
    /**
     * The whole header, when one row of words is not enough: a group spanning
     * three columns, a sort control, a select-all box, a unit under a name.
     *
     * A snippet rather than a richer `columns` type, because every table that
     * needs this needs something different, and a column model general enough
     * for all of them would be a schema for eight one-off shapes. What this
     * component owns is the seam under the header and the cell rhythm, which is
     * `ScreenHeadCell`'s job to keep.
     */
    head?: Snippet;
    /** The rows scroll inside the frame, for a table in a bounded band. */
    scroll?: boolean;
    /** `ScreenRow`s. */
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenTable", () => ({ columns, scroll }));
</script>

<!--
  The registry's `Table.Root` puts the rows in their own container, and that
  container is where the scrolling has to happen: it already carries
  `overflow-x`, which makes it the scroll container for both axes whatever this
  frame says. So the frame becomes a column, the container takes the height that
  is left, and the headings stick to the top of it.

  A sticky heading draws its own seam as an inset shadow rather than a border.
  The table collapses its borders, which hands every border to the collapsed
  grid — so the heading's would stay behind at the top of the rows while the
  heading itself travelled, and the first row would scroll up over a naked edge.
-->
<div
  {...trace}
  class={cn(
    "border-border-subtle rounded-panel overflow-hidden border",
    scroll &&
      "flex min-h-0 flex-1 flex-col [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1 [&>[data-slot=table-container]]:[scrollbar-width:none] [&>[data-slot=table-container]::-webkit-scrollbar]:hidden [&_thead_th]:bg-surface-elevated [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:shadow-[inset_0_-1px_0_var(--token-border-subtle)]"
  )}
>
  <Table.Root class="border-collapse">
    <!--
      The registry's header draws the seam under the whole row. Here each
      heading carries its own, because a grouped header needs the line under the
      group and not under the columns it spans.
    -->
    <!--
      The header carries a fill of its own. A table on the plane runs to a
      thousand pixels, and a heading row told apart only by its type is a row
      the eye loses on the way across.

      `elevated` rather than `panel`: the table sits on a panel surface in one
      place and a canvas surface in another, and elevated is a step away from
      both. Panel was the first attempt and was invisible against exactly the
      surface the tables are drawn on. It also cannot be `panel-hover`, which
      the rows below already use to mean "the pointer is here".
    -->
    <Table.Header class="bg-surface-elevated [&_tr]:border-b-0">
      {#if head}
        {@render head()}
      {:else}
        <tr>
          {#each columns as column (column)}
            <Table.Head
              class="text-caption text-ink-muted border-border-subtle h-auto border-b px-3 py-2 text-start font-semibold tracking-wide uppercase"
            >
              {column}
            </Table.Head>
          {/each}
        </tr>
      {/if}
    </Table.Header>
    <Table.Body>
      {@render children()}
    </Table.Body>
  </Table.Root>
</div>
