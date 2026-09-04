<script lang="ts">
  import { Panel, PanelEmpty, PanelField, PanelFields, PanelSection } from "$authored-components/panel";
  import {
    figures,
    percent,
    pixels,
    stageMetrics
  } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const deckId = $derived(view.active.resourceId);

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const stage = $derived(runtime?.stage);
  const metrics = $derived(
    stage === undefined ? undefined : stageMetrics(runtime?.body, view.zoom, stage)
  );
</script>

<Panel title="Stage">
  {#if metrics}
    <PanelSection title="Slide">
      <PanelFields>
        <PanelField label="Aspect ratio" stacked>{metrics.ratio}</PanelField>
      </PanelFields>
    </PanelSection>

    <PanelSection title="Dimensions">
      <PanelFields>
        <PanelField label="Design (units)" mono stacked>{pixels(metrics.units)}</PanelField>
        <PanelField label="Drawn at (rem)" mono stacked>{figures(metrics.drawn)}</PanelField>
        <PanelField label="Zoom" mono stacked>{percent(metrics.zoom)}</PanelField>
      </PanelFields>
    </PanelSection>

    <PanelSection title="Typesetting">
      <PanelFields>
        <PanelField label="Font size" mono stacked>{metrics.fontSize}</PanelField>
        <PanelField label="Characters" mono stacked>{metrics.charactersPerLine} per line</PanelField>
      </PanelFields>
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a deck to see the shape it is drawn at" />
  {/if}
</Panel>
