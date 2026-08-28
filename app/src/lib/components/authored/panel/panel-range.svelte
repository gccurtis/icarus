<script lang="ts">
  import { Slider } from "$lib/components/vendor/slider";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A continuous value, with its extent visible.
   *
   * Opacity, a weight, a confidence threshold, a zoom that is a control rather
   * than a gesture.
   *
   * **Not `PanelNumber`.** A number is exact; a range is proportional. What a
   * track says that a field cannot is *where the value sits between its ends* —
   * near the top, a third of the way, almost off — and that is the only reading
   * available when the value has no meaningful unit. Asked for 0.62 opacity as a
   * figure, nobody knows whether that is a lot; shown as a filled track, everyone
   * does.
   *
   * **Not `PanelProgress`,** which is the same two shapes for the opposite
   * reason: progress is reported and a range is set. They share the fill colour
   * deliberately — a filled bar means the same thing in both — and diverge on
   * everything else, because one of them is a control and takes focus.
   *
   * **The figure is always beside the track.** A slider with no number is a
   * control nobody can report, repeat or check: "about two-thirds" cannot be
   * written in a bug, typed into a second panel, or compared with what it was
   * yesterday. The unit goes into the field's accessible name as well as beside
   * the figure, because a slider announces its number and nothing else.
   *
   * `simple-components/slider` underneath in single mode, so the arrow-key,
   * Home/End and Page-Up stepping, the pointer capture and the enlarged thumb
   * target are bits-ui's rather than redrawn at panel scale.
   */
  let {
    label,
    value,
    min = 0,
    max = 100,
    step = 1,
    unit,
    disabled = false,
    flush = false,
    onchange
  }: {
    /** What is being set. Drawn above the track and the control's name. */
    label: string;
    value: number;
    /** The low end. Drawn as the empty part of the track. */
    min?: number;
    /** The high end. */
    max?: number;
    step?: number;
    /** "%", "px", "pt". Beside the figure, and in the accessible name. */
    unit?: string;
    disabled?: boolean;
    /** Drop the panel gutter, for a range inside an already-padded region. */
    flush?: boolean;
    /**
     * Absent means read-only, and the slider is disabled — a thumb that moves
     * and changes nothing is worse than one that will not move. A value only
     * being *reported* is `PanelProgress`, not this.
     */
    onchange?: (next: number) => void;
  } = $props();

  const trace = traceNode("PanelRange", () => ({
    label,
    value,
    min,
    max,
    step,
    unit,
    disabled,
    flush
  }));

  const inert = $derived(disabled || onchange === undefined);
  const figure = $derived(unit ? `${value} ${unit}` : String(value));
</script>

<div {...trace} class={cn("flex flex-col gap-1.5", flush ? "px-0" : "px-3")}>
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-caption text-ink-secondary truncate">{label}</span>
    <span class="text-caption text-ink-primary shrink-0 tabular-nums">{figure}</span>
  </div>

  <!--
    The fill is the panel's active role, the same one `PanelProgress` uses: a
    filled length reads as one thing across the vocabulary, and the registry's
    own `primary` is the affordance colour rather than the reading colour.
  -->
  <Slider
    type="single"
    {value}
    {min}
    {max}
    {step}
    disabled={inert}
    aria-label={unit ? `${label} in ${unit}` : label}
    onValueChange={(next: number) => onchange?.(next)}
    class="[&_[data-slot=slider-range]]:bg-active-fill [&_[data-slot=slider-thumb]]:border-active-border"
  />
</div>
