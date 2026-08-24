<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A record, in one frame: the figures ruled apart rather than boxed apart.
   *
   * **One border for the set, not one per number.** A bordered card per stat in
   * an auto-fit grid costs a band eighty pixels deep to say four short things,
   * and reads worse than it measures. Four boxes are four unrelated claims, when
   * the whole point of a record is that the numbers qualify each other: 41 run
   * and 1 failed is a sentence, and it stops being one the moment the two sit in
   * separate tiles.
   *
   * **The rules are the gaps.** The cells sit on a `border-subtle` fill with a
   * 1px gap between them, so the fill is what shows through — the same material
   * the tables draw their seams in. A border on each cell is the obvious way and
   * is wrong as soon as the strip wraps: the first cell of the second row draws
   * its line against the frame's own, and every wrapped row is a doubled edge.
   * Cells grow to fill their row, so a set of three or five leaves no bare
   * patch of that fill behind.
   *
   * **The width is the strip's decision, not the figure's**, as with
   * `ScreenStrip`. `min` is the narrowest a cell may be before the row drops
   * one, which is what lets the same markup run as a single line across the
   * plane and break to two-up in a 300px panel without the caller choosing.
   */
  let {
    minWidth = "7.5rem",
    label = "Record",
    children
  }: {
    /** The narrowest a figure may be before the strip drops one from the row. */
    minWidth?: string;
    /** Names the set, so a screen reader gets a boundary rather than one run. */
    label?: string;
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenStats", () => ({ minWidth, label }));
</script>

<div
  {...trace}
  role="group"
  aria-label={label}
  style="--stat-min: {minWidth}"
  class="border-border-subtle bg-border-subtle rounded-panel flex w-fit max-w-full flex-wrap gap-px overflow-hidden border [&>*]:min-w-0 [&>*]:grow [&>*]:basis-[var(--stat-min)]"
>
  {@render children()}
</div>
