<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";

  import * as InputGroup from "$vendored-components/input-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A number, with its unit and a way to step it.
   *
   * A margin, a weight, a limit, a row count, a font size.
   *
   * **Not `PanelEditableText mono`.** Text has no floor, no ceiling, no step and
   * no unit, so every caller that wanted a number re-implemented all four — and
   * one of them clamped on the wrong side, one of them let "12pt" through as a
   * value, and one of them stored the string. Those four facts belong to the
   * number, so they belong to the component that holds it.
   *
   * **The unit sits beside the figure and is never part of it.** "12 pt", not
   * "12pt" in the value: the moment the unit is inside the string the value
   * stops being a number and the next caller parses it back out. It is folded
   * into the field's accessible name instead — "Margin in pt" — so a reader who
   * cannot see the addon still gets it.
   *
   * **Steppers are an addition to typing, never a replacement.** Someone
   * entering 137 must not press anything 137 times, so the field is typed into
   * directly and the arrow keys step it as well. The two buttons are for the
   * nudge — one point smaller, one row more — and they go dead at the bounds
   * with a title saying which bound was reached.
   *
   * `simple-components/input-group` underneath, so the field, the unit and the
   * two controls are one bordered object with one focus ring, rather than three
   * things that have to be kept in line by hand.
   */
  let {
    label,
    value,
    unit,
    min,
    max,
    step = 1,
    disabled = false,
    flush = false,
    onchange
  }: {
    /** What is being counted or measured. The accessible name, and never empty. */
    label: string;
    value: number;
    /** "pt", "px", "rows", "%". Drawn beside the figure, never inside it. */
    unit?: string;
    /** The floor. Absent means there is genuinely none, which is rare. */
    min?: number;
    /** The ceiling. */
    max?: number;
    /** The nudge one press makes, and the precision the value is held to. */
    step?: number;
    disabled?: boolean;
    /** Drop the panel gutter, for a field already inside a padded region. */
    flush?: boolean;
    /** Absent means read-only, and the whole group is disabled. */
    onchange?: (next: number) => void;
  } = $props();

  const trace = traceNode("PanelNumber", () => ({
    label,
    value,
    unit,
    min,
    max,
    step,
    disabled,
    flush
  }));

  const inert = $derived(disabled || onchange === undefined);

  /**
   * The step decides the precision. 0.1 + 0.2 is 0.30000000000000004, and a
   * panel that prints that has told the reader a lie about what it stored.
   */
  const places = $derived((String(step).split(".")[1] ?? "").length);
  const quantize = (n: number) => Number(n.toFixed(places));
  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

  /**
   * The field is typed into, so it holds a string of its own: "-", "1." and ""
   * are all states on the way to a number and none of them is one. It follows
   * the model whenever the model moves.
   */
  // svelte-ignore state_referenced_locally
  let draft = $state(String(value));

  $effect(() => {
    draft = String(value);
  });

  /**
   * On `change` rather than on every keystroke. `change` fires on blur, on
   * Enter and on each arrow-key step — which is every moment the reader has
   * finished saying something — where `input` would report 1, then 13, then 137
   * and clamp the first two against a floor the reader was still typing past.
   */
  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) {
      draft = String(value);
      return;
    }
    const next = clamp(quantize(parsed));
    draft = String(next);
    if (next !== value) onchange?.(next);
  };

  const nudge = (direction: 1 | -1) => {
    const next = clamp(quantize(value + direction * step));
    if (next !== value) onchange?.(next);
  };

  const atMin = $derived(min !== undefined && value <= min);
  const atMax = $derived(max !== undefined && value >= max);
</script>

<div {...trace} class={cn("flex", flush ? "px-0" : "px-3")}>
  <InputGroup.Root class="h-7">
    <!--
      The native spinners are suppressed because this draws its own: two sets of
      steppers on one field is two answers to the same question, and the browser's
      pair is four pixels tall. Type `number` stays, for the arrow keys and for
      the numeric keypad on a phone.
    -->
    <InputGroup.Input
      type="number"
      value={draft}
      {min}
      {max}
      {step}
      inputmode="decimal"
      disabled={inert}
      aria-label={unit ? `${label} in ${unit}` : label}
      class="text-body-sm [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        draft = event.currentTarget.value;
      }}
      onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        commit(event.currentTarget.value);
      }}
    />

    <InputGroup.Addon align="inline-end" class="gap-1">
      {#if unit}
        <InputGroup.Text class="text-caption text-ink-muted">{unit}</InputGroup.Text>
      {/if}
      <InputGroup.Button
        size="icon-xs"
        aria-label="Decrease {label}"
        title={atMin ? `${label} is at its minimum` : undefined}
        disabled={inert || atMin}
        onclick={() => nudge(-1)}
      >
        <Minus aria-hidden="true" />
      </InputGroup.Button>
      <InputGroup.Button
        size="icon-xs"
        aria-label="Increase {label}"
        title={atMax ? `${label} is at its maximum` : undefined}
        disabled={inert || atMax}
        onclick={() => nudge(1)}
      >
        <Plus aria-hidden="true" />
      </InputGroup.Button>
    </InputGroup.Addon>
  </InputGroup.Root>
</div>
