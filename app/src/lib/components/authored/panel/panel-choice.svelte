<script lang="ts">
  import { onMount } from "svelte";
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A small set of alternatives with exactly one on.
   *
   * The scope a list is narrowed to — `Deck` · `Slide 4` · `Element` — the
   * region a panel is switched to, or a value short enough to show rather than
   * hide. Five categories draw these as a region of their layout grid, above the
   * thing they narrow.
   *
   * **It exists because the application was faking it.** A deck inspector wrote
   * `<PanelActions><PanelChip tone="active">16:9</PanelChip><PanelChip>4:3</PanelChip></PanelActions>`
   * — a chosen value drawn from two inert `span`s. It looked exactly right, could
   * not be reached by keyboard, could not be changed, and announced nothing at
   * all. `PanelChip` is deliberately a `span`; `PanelButton` has no chosen state;
   * `PanelSelect` hides the set behind a trigger, which is the one thing these
   * specs do not want.
   *
   * `simple-components/toggle-group` underneath in single mode, so "exactly one
   * on" is enforced by the primitive and arrow-key movement between the options
   * comes with it.
   *
   * **The label carries the resolved subject, not a static word** — "Slide 4",
   * "Page 2", "Today". A scope chip reading "Slide" when four slides exist tells
   * the reader the category they already knew instead of the answer they need.
   *
   * **It wraps rather than scrolls**, the decision `PanelActions` already had to
   * make: a horizontal scroll in a flank hides options behind a gesture
   * nobody makes.
   */
  let {
    label,
    value,
    options,
    mixed = false,
    flush = false,
    fill = false,
    onchange
  }: {
    /**
     * What is being chosen. The group's accessible name.
     *
     * It is not drawn. Where a choice stands beside other fields and needs a
     * visible name, put it in a `PanelField` — which is the vocabulary's word for
     * a label beside a value — and set `flush` so the two gutters do not stack.
     */
    label: string;
    value: string;
    options: readonly { value: string; label: string; short?: string }[];
    /**
     * Several things are selected and they do not agree.
     *
     * Nothing is on, which is the truthful drawing: showing one of them on
     * would claim the others match it, and showing the last-clicked one would
     * claim an answer nobody gave. Pressing an option still sets all of them —
     * that is how a mixed state is resolved.
     */
    mixed?: boolean;
    /** Drop the panel gutter, for a choice nested inside a padded region. */
    flush?: boolean;
    /** Share the entire row evenly when the choices are field values. */
    fill?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  let selected = $state("");
  let current = "";
  let active = false;
  onMount(() => {
    active = true;
    return () => {
      active = false;
    };
  });
  $effect(() => {
    const next = mixed ? "" : value;
    selected = next;
    current = next;
  });

  // The marker is forwarded through `ToggleGroup.Root` onto the element it renders.
  const trace = traceNode("PanelChoice", () => ({ label, value, options, mixed, flush, fill }));
</script>

<ToggleGroup.Root
  {...trace}
  type="single"
  bind:value={selected}
  aria-label={label}
  onValueChange={(next: string) => {
    // The primitive allows deselection; a scope has no "none". Ignoring the
    // empty value is what makes pressing the chosen chip a no-op rather than a
    // way to reach a state no panel here can render.
    if (!active || !next || next === current) return;
    current = next;
    onchange?.(next);
  }}
  class={cn(
    "flex justify-start gap-1",
    fill ? "w-full flex-nowrap" : "flex-wrap",
    flush ? "px-0" : "px-3"
  )}
  style={fill ? "container-type: inline-size; width: 100%" : "container-type: inline-size"}
>
  {#each options as option (option.value)}
    <ToggleGroup.Item
      value={option.value}
      aria-label={option.label}
      class={cn(
        "text-body-sm border-border-subtle bg-surface-panel text-ink-secondary rounded-control data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text h-7 min-w-0 justify-center truncate border px-2 font-normal",
        fill && "flex-1 basis-0"
      )}
      style={fill ? "flex: 1 1 0%; width: 0; min-width: 0" : undefined}
    >
      <span class="choice-short">{option.short ?? option.label.slice(0, 1)}</span>
      <span class="choice-full">{option.label}</span>
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>

<style>
  .choice-full {
    display: none;
  }

  @container (min-width: 8rem) {
    .choice-short {
      display: none;
    }

    .choice-full {
      display: inline;
    }
  }
</style>
