<script lang="ts">
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A colour, chosen from the ones this project actually has.
   *
   * Not a colour picker. A fill, a stroke or a text colour in Icarus comes from a
   * theme or a style set, so the set is small, named, and worth showing whole —
   * which makes this `PanelChoice` with swatches instead of words rather than an
   * eyedropper and a hex field. A free picker would let an author put a colour in
   * a deck that its theme has never heard of, and then the theme is not a theme.
   *
   * **Mixed is drawn, not resolved.** Several elements with different fills show
   * nothing selected, for the reason `PanelChoice` and `PanelSelect` both give:
   * showing one would claim the others match it.
   *
   * **A swatch is never the only cue.** Each carries its name on hover and as its
   * accessible name, and the chosen one takes a ring rather than only a border,
   * so the control survives being read without colour — which is the whole point
   * of a control that is otherwise nothing but colour.
   */
  let {
    label,
    value,
    options,
    mixed = false,
    disabled = false,
    flush = false,
    onchange
  }: {
    /** What is being coloured. The group's accessible name. */
    label: string;
    /** The chosen swatch, by token name. */
    value: string;
    /**
     * What this project offers. `token` is a CSS custom property or any value a
     * `background` accepts; `label` is what it is called here — "Accent 1",
     * "Paper", "Ink" — never a hex code, which names nothing.
     */
    options: readonly { value: string; label: string; token: string }[];
    /** Several things are selected and their colours do not agree. */
    mixed?: boolean;
    disabled?: boolean;
    flush?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  const trace = traceNode("PanelColor", () => ({ label, value, options, mixed, disabled, flush }));
</script>

<div
  {...trace}
  role="radiogroup"
  aria-label={label}
  class={cn("flex flex-wrap items-center gap-1", flush ? "px-0" : "px-3")}
>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      {disabled}
      aria-checked={!mixed && option.value === value}
      aria-label={option.label}
      title={option.label}
      onclick={() => onchange?.(option.value)}
      class={cn(
        "border-border-subtle size-5 rounded-full border",
        "focus-visible:outline-none",
        !mixed &&
          option.value === value &&
          "ring-active-border ring-offset-surface-panel ring-2 ring-offset-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style:background={option.token}
    ></button>
  {/each}

  {#if mixed}
    <span class="text-caption text-ink-muted">Mixed</span>
  {/if}
</div>
