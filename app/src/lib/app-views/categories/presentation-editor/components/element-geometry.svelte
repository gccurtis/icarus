<script lang="ts">
  import {
    PanelControlGroup,
    PanelControlRow,
    PanelNumber,
    PanelSection
  } from "$authored-components/panel";
  import { placedById } from "$app-views/categories/presentation-editor/procedures/presentation-placed-element";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { withElementFrame, withSet } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
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
    runtime?.apply(withSet(body, "element", `${elementId}/rotation`, held === 0 ? null : held).ops);
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
      <PanelControlRow label="Position">
        <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <span class="text-caption text-ink-muted">X</span>
          <PanelNumber label="X" value={shown(placed.frame.x)} step={0.001} flush onchange={(x) => set({ x })} />
          <span class="text-caption text-ink-muted">Y</span>
          <PanelNumber label="Y" value={shown(placed.frame.y)} step={0.001} flush onchange={(y) => set({ y })} />
        </div>
      </PanelControlRow>
      <PanelControlRow label="Rotation">
        <PanelNumber label="Rotation" value={placed.element.rotation ?? 0} unit="°" step={1} flush onchange={rotate} />
      </PanelControlRow>
    </PanelControlGroup>
  {/if}
</PanelSection>
