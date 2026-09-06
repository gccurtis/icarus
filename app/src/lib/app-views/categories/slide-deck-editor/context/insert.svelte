<script lang="ts">
  import type { Component } from "svelte";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Circle from "@lucide/svelte/icons/circle";
  import Diamond from "@lucide/svelte/icons/diamond";
  import Image from "@lucide/svelte/icons/image";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import MoveUpRight from "@lucide/svelte/icons/move-up-right";
  import Slash from "@lucide/svelte/icons/slash";
  import Square from "@lucide/svelte/icons/square";
  import Table from "@lucide/svelte/icons/table";
  import Triangle from "@lucide/svelte/icons/triangle";
  import Type from "@lucide/svelte/icons/type";

  import { Panel, PanelEmpty, PanelNote, PanelSearch } from "$authored-components/panel";
  import { slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { INSERT_ENTRIES, type InsertEntry, type PlacedKind } from "$app-views/categories/slide-deck-editor/procedures/inserting";
  import { arm, placing } from "$app-views/categories/slide-deck-editor/procedures/placing.svelte";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const ICON: Record<string, Component> = {
    text: Type,
    rectangle: Square,
    ellipse: Circle,
    triangle: Triangle,
    diamond: Diamond,
    arrow: MoveUpRight,
    callout: MessageSquare,
    line: Slash,
    image: Image,
    table: Table,
    chart: ChartColumn
  };

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const position = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined));
  const slide = $derived(body?.slides[position]);

  let query = $state("");
  const needle = $derived(query.trim().toLowerCase());
  const tiles = $derived(INSERT_ENTRIES.filter((entry) => entry.label.toLowerCase().includes(needle)));
  const armed = $derived(INSERT_ENTRIES.find((entry) => entry.kind === placing.kind));

  const toggle = (entry: InsertEntry) => {
    if (!entry.ready) return;
    arm(placing.kind === entry.kind ? undefined : (entry.kind as PlacedKind));
  };

  $effect(() => () => arm(undefined));
</script>

<Panel title="Insert">
  {#if body && slide}
    <PanelSearch
      placeholder="Search…"
      bind:value={query}
      matched={needle === "" ? undefined : tiles.length}
      total={needle === "" ? undefined : INSERT_ENTRIES.length}
      empty="Nothing by that name."
      flush
    >
      <div class="grid grid-cols-2 gap-1 px-3 pb-2">
        {#each tiles as entry (entry.kind)}
          {@const Glyph = ICON[entry.kind]}
          <button
            type="button"
            class="rounded-control border-border-subtle bg-surface-panel text-ink-secondary hover:bg-surface-panel-hover hover:text-ink-primary aria-pressed:border-active-border aria-pressed:bg-active-surface aria-pressed:text-active-text flex min-w-0 flex-col items-center gap-1 border px-1 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-pressed={placing.kind === entry.kind}
            disabled={!entry.ready}
            title={entry.ready ? `Place a ${entry.label.toLowerCase()}` : entry.note}
            onclick={() => toggle(entry)}
          >
            <Glyph size={18} aria-hidden="true" />
            <span class="text-caption text-center leading-tight">{entry.label}</span>
          </button>
        {/each}
      </div>
    </PanelSearch>
    <PanelNote>
      {#if armed}
        Click on slide {position + 1} to place the {armed.label.toLowerCase()}. Esc cancels.
      {:else}
        Pick one, then click where it goes. Right-click the slide to add at the pointer.
      {/if}
    </PanelNote>
  {:else}
    <PanelEmpty title="Open a deck to put something on a slide" />
  {/if}
</Panel>
