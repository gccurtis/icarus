<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * The record band in a flank: the figures a panel reports about its subject.
   *
   * "41 tasks · 2 running · 128 findings" on a persona, a connector's file and
   * error counts, a Context's contained and retrievable. These are written as
   * prose in a `PanelField` today, which is why the figures in two panels never
   * line up and why a reader has to parse a sentence to find one number.
   *
   * **Not `ScreenStats`.** That band is one bordered frame with the rules drawn
   * in the gaps between cells, sized so a cell is a card in a grid on the open
   * plane. In a 300px column that frame is a box inside the panel's own box, and
   * it costs a gutter the column does not have. Here the alignment does the
   * separating: an even grid on the panel's own gutter, no frame, no fill.
   *
   * **Not `PanelFields`.** A field is a labelled value and reads left to right,
   * one per line, with the label column fixed. A record is a row of figures and
   * reads across, and put into a field list it becomes two more lines of small
   * grey text that nobody scans.
   *
   * **Two or three across, never four.** A 276px body divided four ways leaves
   * 60px, which will not hold "128" over "findings" without breaking the word.
   * A record with more figures than three columns can carry wants a fourth
   * figure fewer, or the plane.
   */
  let {
    label = "Record",
    columns = 3,
    flush = false,
    children
  }: {
    /** Names the set, so a screen reader gets a boundary rather than one run. */
    label?: string;
    /** Three for short counts, two where a figure or a word is long. */
    columns?: 2 | 3;
    /** Drop the panel gutter, for a band nested inside a padded region. */
    flush?: boolean;
    /** `PanelStat`s. */
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelStats", () => ({ label, columns, flush }));
</script>

<!--
  Equal fractions rather than auto columns: the figures are being compared, and
  columns sized to their contents put the second figure of one panel under the
  third of the panel above it.
-->
<div
  {...trace}
  role="group"
  aria-label={label}
  class={cn(
    "grid items-start gap-x-2 gap-y-2",
    columns === 2 ? "grid-cols-2" : "grid-cols-3",
    flush ? "px-0" : "px-3"
  )}
>
  {@render children()}
</div>
