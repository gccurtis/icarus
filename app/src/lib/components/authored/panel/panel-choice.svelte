<script lang="ts">
  import { onMount, type Component } from "svelte";
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  type Glyph = Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;

  let {
    label,
    value,
    options,
    mixed = false,
    flush = false,
    fill = false,
    onchange
  }: {
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
    flush?: boolean;
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

  const trace = traceNode("PanelChoice", () => ({ label, value, options, mixed, flush, fill }));

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
