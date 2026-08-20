<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$lib/simple-components/table";

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
   */
  let {
    columns = [],
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
    /** `ScreenRow`s. */
    children: Snippet;
  } = $props();
</script>

<div class="border-border-subtle rounded-panel overflow-hidden border">
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
