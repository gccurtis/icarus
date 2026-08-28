<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$lib/components/vendor/table";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * One heading cell inside a `ScreenTable`'s own `head` snippet.
   *
   * It exists so that writing a custom header does not mean re-deriving the
   * padding, the seam and the caption treatment by hand — the two tables that
   * did that immediately disagreed about the padding. Give the table `columns`
   * when a row of words is all it needs; reach for this only inside `head`.
   */
  let {
    span = 1,
    rows = 1,
    align = "start",
    scope = "col",
    children
  }: {
    /** Columns this heading covers, for a group above several of them. */
    span?: number;
    /**
     * Header rows this heading covers. A grouped header needs it: the columns
     * that are not in the group reach down through both rows, and without it
     * they would need an empty cell underneath that a screen reader announces.
     */
    rows?: number;
    /** `end` for a numeric column, so the heading sits over its figures. */
    align?: "start" | "end" | "center";
    scope?: "col" | "colgroup";
    children: Snippet;
  } = $props();

  // `Table.Head` forwards its rest props, so the marker lands on the `<th>` it renders.
  const trace = traceNode("ScreenHeadCell", () => ({ span, rows, align, scope }));
</script>

<Table.Head
  {...trace}
  {scope}
  colspan={span}
  rowspan={rows}
  class={cn(
    "text-caption text-ink-muted border-border-subtle h-auto border-b px-3 py-2 font-semibold tracking-wide uppercase",
    align === "start" && "text-start",
    align === "end" && "text-end",
    align === "center" && "text-center"
  )}
>
  {@render children()}
</Table.Head>
