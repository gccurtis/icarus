<script lang="ts">
  import type { Component } from "svelte";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { cn } from "$lib/simple-components/utils";

  /**
   * A proportion that is a fact rather than a promise.
   *
   * "88 of 211 resources indexed", "6 of 9 sections filled", a confidence, a
   * share of a budget. The reading is what it is; nothing is on its way
   * anywhere.
   *
   * **Not `PanelProgress`.** A progress bar promises the total will be reached
   * — that is what the shape means, and `role="progressbar"` says it out loud to
   * everything that reads the page. A lattice that has indexed 88 of its 211
   * resources is not heading for 211; it may sit exactly there for the life of
   * the project, because the other 123 are images with no text in them. Drawing
   * that as progress makes a claim nobody made, and the reader waits for a
   * number that will never move. This is `role="meter"`: a level, now.
   *
   * **There is no unknown state.** `PanelProgress` omits its value to say
   * *running, extent unknown*, which is the honest drawing of a job the server
   * has not reported on. A meter has no such form — a level nobody has measured
   * is not a fact, and a caller who has one has progress rather than a meter. So
   * `value` and `detail` are both required.
   *
   * **`tone` is how the level reads, not whose work it is.** `PanelProgress`
   * tones say what kind of job is running — a sync, an agent, a stalled upload.
   * These four answer one question instead: is this level fine, worth a look, or
   * wrong. Only the caller can answer it, because 6 of 9 sections filled is a
   * draft going well and 6 of 9 replicas healthy is an incident. A toned meter
   * carries a mark beside its figure as well as a fill, so the answer survives
   * being read without colour.
   *
   * **The total is drawn.** The track is a filled, visible extent rather than
   * the near-invisible groove a progress bar leaves behind it, because in "88 of
   * 211" the 211 is a real quantity the reader is comparing against. And the
   * figure is never optional, for the reason `PanelProgress` gives: "about
   * two-fifths" is not something anyone can act on.
   */
  let {
    label,
    detail,
    value,
    max = 100,
    tone = "neutral",
    flush = false
  }: {
    /** What is being measured. The meter's accessible name. */
    label: string;
    /** The figure: "88 of 211 indexed", "72% confidence". Never a bare bar. */
    detail: string;
    /** The reading, in the same unit as `max`. */
    value: number;
    /** The whole the reading is out of. 100 for a percentage, 211 for a count. */
    max?: number;
    /** Whether the level is fine, worth a look, or wrong. */
    tone?: "neutral" | "success" | "attention" | "danger";
    /** Drop the panel gutter, for a meter nested inside a padded region. */
    flush?: boolean;
  } = $props();

  /**
   * Clamped, because the caller's two numbers come from two queries and a
   * denominator that has moved is a bar that overshoots its own track.
   */
  const filled = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);

  const FILL: Record<NonNullable<typeof tone>, string> = {
    neutral: "bg-border-strong",
    success: "bg-success-fill",
    attention: "bg-attention-fill",
    danger: "bg-danger-fill"
  };

  const INK: Record<NonNullable<typeof tone>, string> = {
    neutral: "text-ink-muted",
    success: "text-success-text",
    attention: "text-attention-text",
    danger: "text-danger-text"
  };

  /** Three shapes, not three colours — told apart without hue. */
  const MARK: Record<
    NonNullable<typeof tone>,
    Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }> | null
  > = {
    neutral: null,
    success: CircleCheck,
    attention: TriangleAlert,
    danger: CircleX
  };

  const Mark = $derived(MARK[tone]);
</script>

<div class={cn("flex flex-col gap-1", flush ? "px-0" : "px-3")}>
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-caption text-ink-secondary truncate">{label}</span>
    <span class={cn("text-caption flex shrink-0 items-center gap-1 tabular-nums", INK[tone])}>
      {#if Mark}
        <Mark size={12} aria-hidden="true" />
      {/if}
      {detail}
    </span>
  </div>

  <!--
    `aria-valuetext` carries the caller's phrasing, so the figure a reader hears
    is the figure on the screen rather than a ratio read back as two integers.
  -->
  <div
    role="meter"
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuetext={detail}
    class="bg-inactive-surface h-1.5 w-full overflow-hidden rounded-full"
  >
    <div class={cn("h-full rounded-full", FILL[tone])} style="inline-size: {filled * 100}%"></div>
  </div>
</div>
