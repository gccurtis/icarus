<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { chartAt, spreadsheetRecord } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A chart floating over the grid: what it draws, where it reads from, and where
   * it sits.
   *
   * `docs/screen-panel-views/inspector/resource/chart.md` is the specification.
   *
   * The chart and its internal parts are identified. This lens can therefore
   * describe the same target the renderer selected rather than an array position.
   */
  let {
    spreadsheetId = "r-cost",
    chartId = "chart-customer-minutes"
  }: { spreadsheetId?: string; chartId?: string } = $props();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const chart = $derived(chartAt(spreadsheetId, chartId).current);
</script>

<Panel title={chart?.title ?? "Chart"}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: sheet.title, key: "resource.spreadsheet" },
        { label: chart?.title ?? "Chart" }
      ]}
      onnavigate={(key) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  {#if chart === undefined}
    <PanelNote>There is no chart with id {chartId} in this spreadsheet.</PanelNote>
  {:else}
    <!-- The head of the lens has no heading: the title already names the chart. -->
    <PanelFields>
      <PanelField label="Type">{chart.kind}</PanelField>
      <PanelField label="Source range" mono>
        <PanelLink
          label={chart.sourceRange}
          title="Select {chart.sourceRange} on the grid"
          onselect={() =>
            mockWorkbench.inspect("resource.range", { kind: "range", id: chart.sourceRange })}
        />
      </PanelField>
      <PanelField label="Title" stacked>{chart.title}</PanelField>
    </PanelFields>

    <!-- Where it floats is rarely why it was opened, so the band arrives shut. -->
    <PanelSection title="Placement" open={false}>
      <PanelFields>
        <PanelField label="Anchor" mono>{chart.anchor}</PanelField>
        <PanelField label="Size" mono>{chart.size.width} × {chart.size.height} px</PanelField>
      </PanelFields>
      <PanelNote>
        The anchor is an address, so the chart moves when rows and columns are inserted above or
        to the left of it.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Status">
      <PanelFields>
        <PanelField label="Addressed by" mono>{chart.id}</PanelField>
        <PanelField label="Data marks">{chart.model.data.datums.length}</PanelField>
        <PanelField label="Added elements">{chart.model.elements.length}</PanelField>
      </PanelFields>
      <PanelNote tone="gap">
        The frame and internal elements use separate revision targets. A move does not conflict
        merely because someone else relabelled a reference line inside the chart.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
