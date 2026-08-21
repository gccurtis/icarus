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
   * **Nothing here is editable, and the Status band says why rather than leaving a
   * reader to discover it.** A chart is addressed by its position in the sheet's
   * object list because `SheetChart` has no stable id, and a position is enough
   * for a list and not enough for a granular update, a reconciliation, a retained
   * selection or a comment.
   */
  let {
    spreadsheetId = "r-cost",
    index = 0
  }: { spreadsheetId?: string; index?: number } = $props();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const chart = $derived(chartAt(spreadsheetId, index).current);
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
    <PanelNote>There is no object at position {index + 1} in this spreadsheet.</PanelNote>
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
        <PanelField label="Size" mono>{chart.size}</PanelField>
      </PanelFields>
      <PanelNote>
        The anchor is an address, so the chart moves when rows and columns are inserted above or
        to the left of it.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Status">
      <PanelFields>
        <PanelField label="Addressed by">Position {index + 1} in the object list</PanelField>
      </PanelFields>
      <PanelNote tone="gap">
        Read-only. Without a stable id an array position cannot carry a granular update, remote
        reconciliation, a selection that survives a reload, or a comment — which gates creating a
        chart as much as editing one.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
