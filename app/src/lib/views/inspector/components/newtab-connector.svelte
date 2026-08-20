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
   * Connecting to an outside system, or repairing a connection.
   *
   * The launcher's short form. The full connector view, with delivery and sync
   * history, is the project overview's.
   */
  const { workbench } = clientModel();
</script>

<Panel title="SharePoint">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "SharePoint" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Provider">
    <PanelFields>
      <PanelField label="Provider">SharePoint</PanelField>
      <PanelField label="Purpose" stacked>
        Sync a document library into the project as external files.
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Scope">
    <PanelActions><PanelChip tone="interactive">Sites.Read.All</PanelChip></PanelActions>
    <PanelNote>Scopes are chosen explicitly, never inferred from the provider.</PanelNote>
  </PanelSection>

  <PanelSection title="Authentication">
    <PanelActions>
      <PanelChip tone="danger">Expired</PanelChip>
      <PanelButton label="Reconnect" tone="primary" />
    </PanelActions>
    <PanelNote tone="gap">
      The callback returns to this same launcher tab with its selection restored.
      A callback landing on a tab that has since closed needs a defined outcome.
    </PanelNote>
  </PanelSection>
</Panel>
