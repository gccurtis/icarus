<script lang="ts">
  import * as InputGroup from "$vendored-components/input-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A compact direct number field, with an optional unit.
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
   * Native ArrowUp/ArrowDown stepping remains available, while visual plus and
   * minus controls stay out of dense inspector rows. Shift multiplies a keyboard
   * step by ten.
   *
   * `simple-components/input-group` underneath, so the field and unit are one
   * bordered object with one focus ring.
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
  const spokenUnit = $derived(unit === "in" ? "inches" : unit);

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
  let error = $state<string | undefined>(undefined);

  $effect(() => {
    draft = String(value);
    error = undefined;
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
      error = `${label} must be a number.`;
      return;
    }
    const next = clamp(quantize(parsed));
    draft = String(next);
    error = undefined;
    if (next !== value) onchange?.(next);
  };

  const nudge = (direction: 1 | -1, by: number) => {
    const parsed = draft.trim() === "" ? Number.NaN : Number(draft);
    const origin = Number.isFinite(parsed) ? parsed : value;
    const next = clamp(quantize(origin + direction * step * by));
    draft = String(next);
    error = undefined;
    if (next !== value) onchange?.(next);
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? 10 : 1);
  };
</script>

<div {...trace} class={cn("flex flex-col gap-1", flush ? "px-0" : "px-3")}>
  <InputGroup.Root class="h-7">
    <!--
      No steppers, drawn or native. A pair of buttons on every numeric field is
      chrome on every row of an inspector to serve a gesture almost nobody makes,
      and a disabled decrement at zero dims the whole field so a legitimate value
      reads as unavailable. Type `number` stays for the numeric keypad on a phone;
      keyboard stepping is handled above so Shift can multiply it by ten.
    -->
    <InputGroup.Input
      type="number"
      value={draft}
      {min}
      {max}
      {step}
      inputmode="decimal"
      disabled={inert}
      aria-invalid={error ? "true" : undefined}
      aria-label={spokenUnit ? `${label} in ${spokenUnit}` : label}
      class="text-body-sm [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        draft = event.currentTarget.value;
      }}
      onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        commit(event.currentTarget.value);
      }}
      onkeydown={keydown}
    />

    {#if unit}
      <InputGroup.Addon align="inline-end">
        <InputGroup.Text class="text-caption text-ink-muted">{unit}</InputGroup.Text>
      </InputGroup.Addon>
    {/if}
  </InputGroup.Root>
  {#if error}
    <span class="text-caption text-danger-text" role="alert">{error}</span>
  {/if}
</div>
