<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelField,
    PanelFields,
    PanelNote
  } from "$lib/unique-components/panel";
  import { chartFor, chartKinds } from "$mock-capabilities/analysis";
  import type { ChartKindId } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What kind of picture to draw.
   *
   * `docs/screen-panel-views/context/analysis/chart.md` is the specification.
   * One band, the kinds, so the panel's title is the only heading it needs — a
   * collapsible section holding the whole of a panel is a disclosure over
   * nothing.
   *
   * **The chosen kind is local.** There is no door that writes the chart
   * definition, so picking one moves the choice and opens the chart lens, which
   * is where the rest of the drawing — title, axes, legend, colour — is decided.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const kinds = $derived(chartKinds().current);
  const display = $derived(chartFor(analysisId).current);

  let picked = $state<ChartKindId | undefined>(undefined);
  const chosen = $derived(picked ?? display.kind);

  const options = $derived(kinds.map((kind) => ({ value: kind.id, label: kind.name })));
  const current = $derived(kinds.find((kind) => kind.id === chosen));

  const choose = (next: string) => {
    picked = next as ChartKindId;
    mockWorkbench.inspect("analysis.chart", { kind: "chart", id: analysisId });
  };
</script>

<Panel title="Chart">
  <!--
    TODO(vocabulary): needs PanelCards — a grid of cards three across, each with a
    shape on it and a chosen state, so a kind is picked by its picture rather than
    by its word.
  -->
  <PanelChoice label="Chart kind" value={chosen} {options} onchange={choose} />

  {#if current}
    <PanelFields>
      <PanelField label="Draws with" stacked>{current.needs}</PanelField>
    </PanelFields>
  {/if}

  <PanelNote>
    Picking a kind that needs another field opens an empty zone for it in Fields rather than
    failing — the screen asks for what is missing instead of refusing.
  </PanelNote>

  <PanelNote tone="gap">
    The minimum-field rule per kind is undefined. Without it an empty zone cannot appear only when
    it is genuinely needed, so either every zone is always shown or none is.
  </PanelNote>
</Panel>
