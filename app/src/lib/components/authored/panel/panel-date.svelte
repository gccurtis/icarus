<script lang="ts">
  import { Input } from "$lib/components/vendor/input";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A date, chosen.
   *
   * A variable's default, a deadline, the day a scope starts. The
   * create-variable form asks for one.
   *
   * **Not `PanelEditableText`.** A date typed as free text is a date in
   * somebody's local format, and the difference between 03/04 and 04/03 is a
   * filing deadline. Text has no notion of a calendar: it will accept
   * "next tuesday", "3/4/26" and "2026-13-40" with equal enthusiasm, and every
   * caller that stores one has to write the same parser and get the ordering
   * wrong in the same way.
   *
   * **The value is ISO-8601 and only ISO-8601** — `2026-03-04`, or `""` when the
   * reader clears it. The ambiguity lives entirely in the display, where the
   * platform resolves it: a native date control labels its own segments, orders
   * them the way the reader's system does, and hands back a string that cannot
   * be read two ways. That is why the native control is honest here even though
   * it is plain.
   *
   * **A vendored calendar is the upgrade.** `simple-components` has no calendar
   * in it today; `bits-ui` and `@internationalized/date` are both already
   * installed, so when one is added it drops in underneath with the same ISO
   * prop and no caller changes. What a calendar buys is the month around the
   * date — which day of the week, how far to the end of the quarter, which days
   * are out of range — and none of that is visible in a segmented field.
   */
  let {
    label,
    value,
    min,
    max,
    disabled = false,
    flush = false,
    onchange
  }: {
    /** What is being dated. The accessible name, and never empty. */
    label: string;
    /** `YYYY-MM-DD`, or `""` for no date. */
    value: string;
    /** The earliest allowed date, `YYYY-MM-DD`. Enforced by the control. */
    min?: string;
    /** The latest allowed date, `YYYY-MM-DD`. */
    max?: string;
    disabled?: boolean;
    /** Drop the panel gutter, for a field already inside a padded region. */
    flush?: boolean;
    /**
     * Absent means read-only, and the field is disabled rather than absent —
     * the same rule `PanelToggle` keeps. A date that can be opened, changed and
     * silently discarded is worse than one that plainly cannot be touched.
     */
    onchange?: (next: string) => void;
  } = $props();

  const trace = traceNode("PanelDate", () => ({ label, value, min, max, disabled, flush }));

  const inert = $derived(disabled || onchange === undefined);
</script>

<div {...trace} class={cn("flex", flush ? "px-0" : "px-3")}>
  <Input
    type="date"
    {value}
    {min}
    {max}
    disabled={inert}
    aria-label={label}
    class="text-body-sm h-7 tabular-nums"
    onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
      onchange?.(event.currentTarget.value);
    }}
  />
</div>
