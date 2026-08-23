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
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * An analytic component floating over the grid: its reusable output,
   * materialization state, and surface-owned placement.
   *
   * `docs/screen-panel-views/inspector/resource/chart.md` is the specification.
   *
   * The analytic, chart and internal parts are identified. This lens can therefore
   * describe the same target the renderer selected rather than an array position.
   */
  let {
    spreadsheetId = "r-cost",
    chartId = "analytic-customer-minutes"
  }: { spreadsheetId?: string; chartId?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const chart = $derived(chartAt(spreadsheetId, chartId).current);
  const renderedChart = $derived(
    chart?.model.component.kind === "chart" ? chart.model.component.chart : undefined
  );
</script>

<Panel title={chart?.title ?? "Analytic"}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: sheet.title, key: "resource.spreadsheet" },
        { label: chart?.title ?? "Analytic" }
      ]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#if chart === undefined}
    <PanelNote>There is no analytic with id {chartId} in this spreadsheet.</PanelNote>
  {:else}
    <!-- The head of the lens has no heading: the title already names the chart. -->
    <PanelFields>
      <PanelField label="Type">{chart.kind}</PanelField>
      <PanelField label="Source range" mono>
        <PanelLink
          label={chart.sourceRange}
          title="Select {chart.sourceRange} on the grid"
          onselect={() =>
            view.inspect("resource.range", { kind: "range", id: chart.sourceRange })}
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
        The anchor is an address, so the analytic moves when rows and columns are inserted above or
        to the left of it.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Status">
      <PanelFields>
        <PanelField label="Addressed by" mono>{chart.id}</PanelField>
        <PanelField label="Data marks">{renderedChart?.data.datums.length ?? 0}</PanelField>
        <PanelField label="Added elements">{renderedChart?.elements.length ?? 0}</PanelField>
        <PanelField label="Materialization">{chart.model.materialization.state}</PanelField>
      </PanelFields>
      <PanelNote tone="gap">
        Placement belongs to the spreadsheet reference. Analytic, component, chart, and internal
        element edits use distinct revision targets.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
