<script lang="ts">
  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { spreadsheetRecord } from "$capabilities/resource";

  /**
   * The spreadsheet itself, which is what the inspector shows when nothing in the
   * grid is selected.
   *
   * `docs/screen-panel-views/inspector/resource/spreadsheet.md` is the
   * specification.
   *
   * **Nothing selected is a state, not a blank panel.** The middle band is the
   * same compensation the other editors make for having no toolbar: it says what
   * selecting something would offer, in the place where the offer would appear.
   *
   * **There is no crumb trail.** This is the top of the ancestry — a one-entry
   * breadcrumb is a heading drawn twice.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
</script>

<Panel title={sheet.title}>
  <!-- The head of the lens has no heading: the title already names the spreadsheet. -->
  <PanelFields>
    <PanelField label="Title" stacked>{sheet.title}</PanelField>
    <PanelField label="Used range" mono>{sheet.usedRange}</PanelField>
    <PanelField label="Populated cells" mono>{sheet.populatedCells}</PanelField>
    <PanelField label="Saved">{sheet.saved}</PanelField>
  </PanelFields>

  <PanelSection title="Nothing selected">
    <PanelNote>
      Click a cell to see what is in it. Select several and this panel offers formatting, a name
      for the range, and merge.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Calculation">
    <PanelNote>
      Icarus's formula engine is the only calculation authority here, and every formula reads its
      inputs when it runs. There is nothing to recalculate and no command to do it with.
    </PanelNote>
  </PanelSection>
</Panel>
