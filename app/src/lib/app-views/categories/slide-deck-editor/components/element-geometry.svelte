<script lang="ts">
  import {
    PanelControlGroup,
    PanelControlRow,
    PanelNumber,
    PanelSection
  } from "$authored-components/panel";
  import {
    placedById,
    slideHolding,
    withElementFrame,
    withSet
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const placed = $derived.by(() => {
    if (body === undefined) return undefined;
    const slide = slideHolding(body, elementId);
    return slide === undefined ? undefined : placedById(slide, elementId);
  });

  const set = (patch: Partial<{ x: number; y: number; width: number; height: number }>) => {
    if (body === undefined || placed === undefined) return;
    runtime?.apply(withElementFrame(body, elementId, { ...placed.frame, ...patch }).ops);
  };

  const rotate = (degrees: number) => {
    if (body === undefined) return;
    const held = ((Math.round(degrees) % 360) + 360) % 360;
    runtime?.apply(withSet(body, `${elementId}/rotation`, held === 0 ? null : held).ops);
  };

  const shown = (value: number) => Number(value.toFixed(3));
</script>

<PanelSection title="Geometry">
  {#if placed}
    <PanelControlGroup flush>
      <PanelControlRow label="Width">
        <PanelNumber label="Width" value={shown(placed.frame.width)} step={0.001} min={0.01} flush onchange={(width) => set({ width })} />
      </PanelControlRow>
      <PanelControlRow label="Height">
        <PanelNumber label="Height" value={shown(placed.frame.height)} step={0.001} min={0.01} flush onchange={(height) => set({ height })} />
      </PanelControlRow>
      <PanelControlRow label="X">
        <PanelNumber label="X" value={shown(placed.frame.x)} step={0.001} flush onchange={(x) => set({ x })} />
      </PanelControlRow>
      <PanelControlRow label="Y">
        <PanelNumber label="Y" value={shown(placed.frame.y)} step={0.001} flush onchange={(y) => set({ y })} />
      </PanelControlRow>
      <PanelControlRow label="Rotation">
        <PanelNumber label="Rotation" value={placed.element.rotation ?? 0} unit="°" step={1} flush onchange={rotate} />
      </PanelControlRow>
    </PanelControlGroup>
  {/if}
</PanelSection>
