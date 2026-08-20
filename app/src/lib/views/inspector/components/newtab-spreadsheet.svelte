<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";

  /**
   * What a spreadsheet will be, before it exists.
   *
   * The shortest of the three. A spreadsheet has nothing to decide up front: no
   * paper, no aspect ratio, and no sheets to name — a tab is one grid, not a
   * workbook of them.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Spreadsheet">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Spreadsheet" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Untitled spreadsheet</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Create">
    <PanelActions><PanelButton label="Create spreadsheet" tone="primary" /></PanelActions>
    <PanelNote>This tab becomes the spreadsheet.</PanelNote>
  </PanelSection>
</Panel>
