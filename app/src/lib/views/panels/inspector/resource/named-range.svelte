<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { namedRange, spreadsheetRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One name that means a range, inside this spreadsheet only.
   *
   * `docs/screen-panel-views/inspector/resource/named-range.md` is the
   * specification.
   *
   * **Not a project variable.** A variable resolves everywhere in the project; a
   * name here resolves in this grid and nowhere else, which is the whole reason
   * the two lists are separate.
   */
  let {
    spreadsheetId = "r-cost",
    name = "costModel"
  }: { spreadsheetId?: string; name?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const range = $derived(namedRange(spreadsheetId, name).current);

  const usage = $derived(
    range.referencedByFormulas === 0
      ? "No formula refers to this name."
      : `Referenced by ${range.referencedByFormulas} ${
          range.referencedByFormulas === 1 ? "formula" : "formulas"
        }.`
  );
</script>

<Panel title={range.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: sheet.title, key: "resource.spreadsheet" }, { label: range.name }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!-- The head of the lens has no heading: the title already names the name. -->
  <PanelFields>
    <PanelField label="Name" mono>{range.name}</PanelField>
    <PanelField label="Sheet">{range.sheet}</PanelField>
    <PanelField label="Range" mono>
      <PanelLink
        label={range.range}
        title="Select {range.range} on the grid"
        onselect={() =>
          view.inspect("resource.range", { kind: "range", id: range.range })}
      />
    </PanelField>
  </PanelFields>
  <PanelNote tone="gap">
    Sheet is left over from when a spreadsheet was a workbook of sheets. A spreadsheet is one grid
    now, so the field has nothing to say and is due to go.
  </PanelNote>

  <!-- Who uses the name is context, not the reason it was opened. -->
  <PanelSection title="Usage" count={range.referencedByFormulas} open={false}>
    <PanelNote>{usage}</PanelNote>
    <PanelNote tone="gap">
      Renaming or deleting a name that formulas use has no defined outcome. Either the references
      are rewritten or they break to #NAME?, and this panel should say which before the edit.
    </PanelNote>
  </PanelSection>
</Panel>
