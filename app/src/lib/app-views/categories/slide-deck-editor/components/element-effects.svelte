<script lang="ts">
  import type { Component } from "svelte";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowDownLeft from "@lucide/svelte/icons/arrow-down-left";
  import ArrowDownRight from "@lucide/svelte/icons/arrow-down-right";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowUpLeft from "@lucide/svelte/icons/arrow-up-left";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Circle from "@lucide/svelte/icons/circle";

  import { PanelNumber, PanelSection } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import * as Popover from "$vendored-components/popover";
  import { elementIn, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import {
    DEFAULT_SHADOW_INTENSITY,
    SHADOW_DIRECTIONS,
    directionOf,
    intensityOf,
    shadowOf,
    type ShadowDirection
  } from "$app-views/categories/slide-deck-editor/procedures/palette";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { elementId, corner = true }: { elementId: string; corner?: boolean } = $props();

  const GLYPH: Record<string, { icon: Component; label: string }> = {
    "-1,-1": { icon: ArrowUpLeft, label: "Up and left" },
    "0,-1": { icon: ArrowUp, label: "Up" },
    "1,-1": { icon: ArrowUpRight, label: "Up and right" },
    "-1,0": { icon: ArrowLeft, label: "Left" },
    "0,0": { icon: Circle, label: "All around" },
    "1,0": { icon: ArrowRight, label: "Right" },
    "-1,1": { icon: ArrowDownLeft, label: "Down and left" },
    "0,1": { icon: ArrowDown, label: "Down" },
    "1,1": { icon: ArrowDownRight, label: "Down and right" }
  };

  const keyOf = (direction: ShadowDirection) => `${direction.dx},${direction.dy}`;

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const paint = $derived(body === undefined ? undefined : elementIn(body, elementId)?.paint);
  const direction = $derived(directionOf(paint?.shadow));
  const intensity = $derived(intensityOf(paint?.shadow));
  const current = $derived(GLYPH[keyOf(direction)]);

  const set = (field: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, `${elementId}/paint/${field}`, value).ops);
  };

  let open = $state(false);

  const cast = (next: ShadowDirection) => {
    set("shadow", shadowOf(next, intensity > 0 ? intensity : DEFAULT_SHADOW_INTENSITY) ?? null);
    open = false;
  };
</script>

<PanelSection title="Effects" open={false} chevron="end">
  <div class="grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1.5">
    <span class="text-caption text-ink-muted">Opacity</span>
    <PanelNumber
      label="Opacity"
      value={Math.round((paint?.opacity ?? 1) * 100)}
      unit="%"
      min={0}
      max={100}
      step={1}
      flush
      onchange={(value) => set("opacity", value >= 100 ? null : value / 100)}
    />
    {#if corner}
      <span class="text-caption text-ink-muted">Corner</span>
      <PanelNumber label="Corner radius" value={paint?.cornerRadius ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => set("cornerRadius", value === 0 ? null : value)} />
    {/if}
    <span class="text-caption text-ink-muted">Shadow</span>
    <div class="flex items-center gap-1.5">
      <Popover.Root bind:open>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" size="icon-sm" class="shrink-0" title="Shadow direction: {current.label.toLowerCase()}" aria-label="Shadow direction: {current.label.toLowerCase()}">
              <current.icon aria-hidden="true" />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content align="start" class="w-auto p-2">
          <div class="grid grid-cols-3 gap-1">
            {#each SHADOW_DIRECTIONS as held (keyOf(held))}
              {@const glyph = GLYPH[keyOf(held)]}
              <Button
                variant={keyOf(held) === keyOf(direction) && intensity > 0 ? "default" : "outline"}
                size="icon-sm"
                title={glyph.label}
                aria-label={glyph.label}
                onclick={() => cast(held)}
              >
                <glyph.icon aria-hidden="true" />
              </Button>
            {/each}
          </div>
        </Popover.Content>
      </Popover.Root>
      <div class="min-w-0 flex-1">
        <PanelNumber label="Shadow intensity" value={intensity} unit="%" min={0} max={200} step={5} flush onchange={(value) => set("shadow", shadowOf(direction, value) ?? null)} />
      </div>
    </div>
  </div>
</PanelSection>
