<script lang="ts">
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A bounded prefix of a tabular value, in a 300px column.
   *
   * A panel is the wrong place for a table — and a variable holding 4,182 rows
   * still has to show what it holds, or the reader cannot tell whether it is the
   * one they meant. Three rows and a count answers that; a scrollable grid in a
   * flank does not.
   *
   * **It is a prefix, and it says so.** `total` is required and is rendered
   * under the rows as "3 of 4,182 rows". A sample that reports a bare row count
   * claims the sample is the whole, which is the same fault `PanelSearch` and
   * `PanelSection` guard against with matched-of-total.
   *
   * **The prefix is read server-side.** Sending a 4,182-row value to draw three
   * of it is what this component exists to make impossible: it takes rows that
   * are already bounded and has no way to ask for more.
   *
   * **Every column is mono and truncates.** These are values you would retype,
   * and a wrapped cell in a three-column 276px body is unreadable. What does not
   * fit is on the cell's title.
   */
  let {
    columns,
    rows,
    total,
    unit = "rows",
    empty = "Nothing in it."
  }: {
    readonly columns: readonly string[];
    /** The bounded prefix. One array per row, in column order. */
    readonly rows: readonly (readonly string[])[];
    /** How many there are in all. Never omitted — see above. */
    total: number;
    /** What the count counts: rows, cells, fields. */
    unit?: string;
    empty?: string;
  } = $props();

  const trace = traceNode("PanelTable", () => ({ columns, rows, total, unit, empty }));

  const showing = $derived(rows.length);
</script>

<div {...trace} class="flex flex-col gap-1 px-3">
  {#if rows.length === 0}
    <p class="text-caption text-ink-muted m-0">{empty}</p>
  {:else}
    <div class="border-border-subtle rounded-control overflow-hidden border">
      <table class="w-full table-fixed border-collapse">
        <thead>
          <tr class="border-border-subtle border-b">
            {#each columns as column (column)}
              <th
                title={column}
                class="text-caption text-ink-muted truncate px-1.5 py-1 text-start font-normal"
              >
                {column}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (index)}
            <tr class="border-border-subtle border-b last:border-b-0">
              {#each row as cell, column (column)}
                <td
                  title={cell}
                  class={cn(
                    "text-mono text-ink-primary truncate px-1.5 py-1 font-mono tabular-nums"
                  )}
                >
                  {cell}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Matched of total, always. A bare count would claim the prefix is all of it. -->
    <p class="text-caption text-ink-muted m-0 tabular-nums">
      {showing.toLocaleString()} of {total.toLocaleString()}
      {unit}
    </p>
  {/if}
</div>
