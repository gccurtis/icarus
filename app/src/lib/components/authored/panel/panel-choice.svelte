<script lang="ts">
  import { onMount, type Component } from "svelte";
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  type Glyph = Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;

  /**
   * A small set of alternatives with exactly one on.
   *
   * The scope a list is narrowed to — `Presentation` · `Slide 4` · `Element` — the
   * region a panel is switched to, or a value short enough to show rather than
   * hide. Five categories draw these as a region of their layout grid, above the
   * thing they narrow.
   *
   * **It exists because the application was faking it.** A presentation inspector wrote
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
    options: readonly { value: string; label: string; short?: string; title?: string; icon?: Glyph }[];
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

  /**
   * A compact label must still distinguish every option. Using the first letter
   * made Selection and Slide both render as “S”. Find the shortest unique
   * prefix unless a caller supplies a domain-specific abbreviation.
   */
  const compactLabel = (option: (typeof options)[number], index: number): string => {
    if (option.short !== undefined) return option.short;
    const candidate = option.label.trim();
    for (let length = 1; length <= candidate.length; length += 1) {
      const prefix = candidate.slice(0, length).toLocaleLowerCase();
      if (options.every((held, heldIndex) => heldIndex === index || !held.label.trim().toLocaleLowerCase().startsWith(prefix))) {
        return candidate.slice(0, length);
      }
    }
    return `${candidate.slice(0, 1)}${index + 1}`;
  };
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
    "flex w-full justify-start gap-1",
    fill ? "flex-nowrap" : "flex-wrap",
    flush ? "px-0" : "px-3"
  )}
  style="container-type: inline-size; width: 100%"
>
  {#each options as option, index (option.value)}
    {@const Icon = option.icon}
    <ToggleGroup.Item
      value={option.value}
      title={option.title ?? (Icon ? option.label : undefined)}
      aria-label={option.label}
      class={cn(
        "text-body-sm border-border-subtle bg-surface-panel text-ink-secondary rounded-control data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text h-7 min-w-0 justify-center truncate border px-2 font-normal",
        fill && "flex-1 basis-0",
        Icon && "px-1"
      )}
      style={fill ? "flex: 1 1 0%; width: 0; min-width: 0" : undefined}
    >
      {#if Icon}
        <Icon size={14} aria-hidden="true" />
      {:else}
        <span class="choice-short">{compactLabel(option, index)}</span>
        <span class="choice-full">{option.label}</span>
      {/if}
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
