<script lang="ts">
  import type { Component } from "svelte";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { cn } from "$lib/simple-components/utils";

  /**
   * One number about what a thing has done, and the words for what it counts.
   *
   * A record, not a metric. These appear on a persona and on a research thread,
   * and in both cases the number is evidence about whether to trust what is
   * beside it — how many tasks it has run, how many failed, how many findings
   * were accepted. Which is why `failed` is never omitted: a record that only
   * counts successes is not a record.
   *
   * **The figure and its label are one phrase**, on one line, read as "41 tasks
   * run". They fall onto two lines only where the cell is too narrow to hold
   * both — which a 300px panel is and the plane is not — so the dense form is
   * the one almost everywhere and nothing is ever truncated to reach it. The
   * figure keeps `tabular-nums`: these get compared across the row and down a
   * column of personas, and proportional digits make equal counts look unequal.
   *
   * **`tone` is emphasis, never information.** It restates what the label
   * already says — the cell that goes red is the one whose word is "failed" —
   * so nothing is lost by a reader who cannot see the colour. It is also why a
   * toned cell carries a mark as well as a fill: a role colour alone is a signal
   * to only some of the people reading it, and this is the number the whole
   * shape exists to make visible.
   *
   * **Untoned is the ordinary case**, and the caller decides, because only the
   * caller knows the count is not zero. A record where every figure is coloured
   * has no emphasis left in it. There is no `active` tone: a stat counts what
   * has happened, and what is happening now belongs to a chip beside the thing
   * rather than to its record.
   *
   * Always a child of `ScreenStats`, which owns the width of a cell and the
   * rules between them.
   */
  let {
    value,
    label,
    tone = "default"
  }: {
    value: string;
    label: string;
    /** Marks the one figure that qualifies the rest. Default for all the others. */
    tone?: "default" | "success" | "attention" | "danger";
  } = $props();

  /** Fill and ink together: a toned cell colours the figure and its label alike. */
  const CELL: Record<NonNullable<typeof tone>, string> = {
    default: "bg-surface-panel text-ink-primary",
    success: "bg-success-surface text-success-text",
    attention: "bg-attention-surface text-attention-text",
    danger: "bg-danger-surface text-danger-text"
  };

  /** Three shapes, not three colours — legible at 14px and told apart without hue. */
  const MARK: Record<
    NonNullable<typeof tone>,
    Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }> | null
  > = {
    default: null,
    success: CircleCheck,
    attention: TriangleAlert,
    danger: CircleX
  };

  const Mark = $derived(MARK[tone]);
</script>

<!--
  `content-start` because the row stretches every cell to the tallest one.
  Without it a one-line cell centres its line inside that stretched box and sits
  below the figure beside it that took two. There is no baseline relationship
  between sibling cells at all — what puts the figures on a line is that the
  cells share a top edge and the same padding, and this is what keeps them there.
-->
<div class={cn("flex flex-wrap content-start items-baseline gap-x-1.5 px-3 py-2", CELL[tone])}>
  {#if Mark}
    <span class="flex shrink-0 self-center">
      <Mark size={14} aria-hidden="true" />
    </span>
  {/if}
  <span class="text-h4 leading-h4 font-semibold tabular-nums tracking-tight">
    {value}
  </span>
  <!-- Wraps under the figure rather than truncating: a clipped label is a
       figure nobody can name, which is the one thing a record cannot afford. -->
  <span class={cn("text-caption min-w-0", tone === "default" && "text-ink-muted")}>{label}</span>
</div>
