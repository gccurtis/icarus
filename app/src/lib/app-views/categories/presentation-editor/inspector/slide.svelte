<script lang="ts">
  import { Panel, PanelColor, PanelCrumbs, PanelEmpty, PanelField, PanelFields, PanelToggle } from "$authored-components/panel";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { withSet } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { swatchesFor } from "$app-views/categories/presentation-editor/procedures/palette";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const slideId = $derived(view.selection?.kind === "slide" ? view.selection.id : view.active.focus ?? undefined);
  const slide = $derived(body?.slides.find((held) => held.id === slideId) ?? body?.slides[0]);
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const swatches = $derived(body === undefined ? [] : swatchesFor(body.theme));

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, "slide", path, value).ops);
  };
</script>

<Panel title="Slide {position}">
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Presentation" }, { label: `Slide ${position}` }]} onnavigate={() => {}} />
  {/snippet}

  {#if body && slide}
    <PanelFields>
      <PanelField label="Background">
        <PanelColor
          picker
          clearable
          label="Slide background override"
          value={slide.background?.kind === "color" ? slide.background.color : ""}
          options={swatches}
          flush
          onchange={(value) => set(`${slide.id}/background`, value === "" ? null : { kind: "color", color: value })}
        />
      </PanelField>
      <PanelField label="Hidden">
        <PanelToggle checked={slide.hidden ?? false} label="Hide this slide" onchange={(next) => set(`${slide.id}/hidden`, next ? true : null)} />
      </PanelField>
    </PanelFields>
  {:else}
    <PanelEmpty title="Pick a slide in the Slides panel" />
  {/if}
</Panel>
