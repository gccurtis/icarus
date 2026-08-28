<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { spreadsheetRecord } from "$capabilities/resource";

  /**
   * The spreadsheet as a whole.
   *
   * `docs/screen-panel-views/context/overview/spreadsheet.md` is the
   * specification. Where the spreadsheet's identity lives: the grid carries no
   * header bar and no name box, because a sheet's chrome belongs in the rail
   * where every other resource keeps it.
   *
   * **Calculation carries no recalculate.** Every formula reads its inputs when
   * it runs, so there is no cached result that could fall behind — the section
   * exists to say that, and a button offering to fix a problem that cannot occur
   * would imply the opposite.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const it = $derived(spreadsheetRecord(spreadsheetId).current);

  let titleDraft = $state("");
</script>

<Panel title="Overview">
  <PanelFields>
    <PanelField label="Title" stacked>
      <PanelEditableText
        value={titleDraft || it.title}
        label="Spreadsheet title"
        onchange={(next: string) => (titleDraft = next)}
      />
    </PanelField>
    <PanelField label="Used range" mono>{it.usedRange}</PanelField>
    <PanelField label="Populated cells" mono>{it.populatedCells}</PanelField>
  </PanelFields>

  <PanelNote>
    The grid is sparse, so both numbers matter: a used range this size with a few
    dozen populated cells is a different object from one with four thousand.
  </PanelNote>

  <!--
    The state is structural rather than read from an engine: nothing is cached,
    so nothing can be stale.
  -->
  <PanelSection title="Calculation">
    <PanelChip tone="success">Up to date</PanelChip>
    <PanelNote>
      Every formula reads its inputs when it runs, so there is no stored result to
      fall behind.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Saved">
    <PanelChip tone="success">{it.saved}</PanelChip>
  </PanelSection>

  <PanelSection title="From template" open={false}>
    <PanelNote tone="gap">
      A spreadsheet records no template origin, so where this came from cannot be
      shown.
    </PanelNote>
  </PanelSection>
</Panel>
