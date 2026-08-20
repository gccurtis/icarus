<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";

  /**
   * What a document will be, before it exists.
   *
   * Everything here is draft state held by the launcher tab, and none of it is
   * written until Create. Paper and margins are asked now because changing them
   * later reflows a document that already has content in it.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Document">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Document" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Untitled document</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Page">
    <PanelFields>
      <PanelField label="Paper">
        <span class="chips"><PanelChip tone="active">Letter</PanelChip><PanelChip>A4</PanelChip></span>
      </PanelField>
      <PanelField label="Orientation">
        <span class="chips">
          <PanelChip tone="active">Portrait</PanelChip><PanelChip>Landscape</PanelChip>
        </span>
      </PanelField>
      <PanelField label="Margins">1 in all round</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      There is no modeled project or user default to pre-select, so the default is
      hard-coded. Whether it should be a project setting is unsettled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Create">
    <PanelActions>
      <PanelButton label="Create document" tone="primary" />
    </PanelActions>
    <PanelNote>This tab becomes the document. It does not open a second one.</PanelNote>
  </PanelSection>
</Panel>

<style>
  .chips {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--token-spacing-unit);
  }
</style>
