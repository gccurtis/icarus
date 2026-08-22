<script lang="ts">
  import type { Component } from "svelte";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * One figure, and the word for what it counts.
   *
   * A record rather than a metric: it says what the thing beside it has done —
   * tasks run, findings accepted, files synced, sections filled — and the reader
   * is deciding whether to trust it.
   *
   * **The figure sits above its label, always.** `ScreenStat` puts the two on
   * one line and falls to two only where the cell is too narrow, which on the
   * plane is rarely. At 300px, three across, a cell is 84px and the one-line
   * form is never reachable — so this does not try for it. A band that reflowed
   * between the two forms as its numbers grew a digit would be a band that moves
   * every time it updates.
   *
   * **`tone` is emphasis, never information**, the rule `ScreenStat` sets: it
   * restates what the label already says, so the cell that goes red is the one
   * whose word is "failed" and nothing is lost by a reader who cannot see it. A
   * toned figure carries a mark as well, because the ink is the only surface
   * here — there is no cell fill at panel scale to carry a second signal.
   *
   * **Tabular figures, always.** These are read down a column of personas and
   * across a band that re-renders as counts move; proportional digits make equal
   * counts look unequal and make a settling number jump.
   *
   * Always a child of `PanelStats`, which owns how many go across.
   */
  let {
    value,
    label,
    tone = "default"
  }: {
    /** Already formatted — the panel does not know the unit or the locale. */
    value: string;
    /** What the figure counts. Wraps under it rather than truncating. */
    label: string;
    /** Marks the one figure that qualifies the rest. Default for the others. */
    tone?: "default" | "success" | "attention" | "danger";
  } = $props();

  const trace = traceNode("PanelStat", () => ({ value, label, tone }));

  /** Figure and label alike: a toned stat is one claim, not a coloured number. */
  const INK: Record<NonNullable<typeof tone>, string> = {
    default: "text-ink-primary",
    success: "text-success-text",
    attention: "text-attention-text",
    danger: "text-danger-text"
  };

  /** Three shapes, not three colours — told apart without hue. */
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
  Figure before label in the source as well as on the screen, so it is read as
  "41 tasks" rather than as a heading and a number.
-->
<div {...trace} class={cn("flex min-w-0 flex-col gap-0.5", INK[tone])}>
  <span class="text-body flex items-center gap-1 font-semibold tabular-nums">
    {#if Mark}
      <Mark size={12} aria-hidden="true" />
    {/if}
    <!-- Breaks rather than clips: a figure with its last digit cut off is worse
         than one on two lines, and the caller is the one who can shorten it. -->
    <span class="min-w-0 break-words">{value}</span>
  </span>
  <!-- Wraps rather than truncating: a clipped label is a figure nobody can name. -->
  <span class={cn("text-caption min-w-0", tone === "default" && "text-ink-muted")}>{label}</span>
</div>
