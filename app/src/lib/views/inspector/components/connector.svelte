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
   * One connection to an outside system: what it may read, how it delivers, and
   * whether it is working.
   */
  const { workbench } = clientModel();
</script>

<Panel title="SharePoint — Ops Reports">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "SharePoint — Ops Reports" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Connection">
    <PanelFields>
      <PanelField label="Provider">SharePoint</PanelField>
      <PanelField label="Display name">Ops Reports</PanelField>
      <PanelField label="Status">
        <PanelChip tone="danger">Authentication expired</PanelChip>
      </PanelField>
    </PanelFields>
  </PanelSection>

  <!-- Both are chosen explicitly and neither is inferred from the provider. -->
  <PanelSection title="Scope and delivery">
    <PanelFields>
      <PanelField label="Scopes" mono>Sites.Read.All</PanelField>
      <PanelField label="Delivery">Scheduled pull, hourly</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Synchronization">
    <PanelFields>
      <PanelField label="Last sync" mono>6 days ago</PanelField>
      <PanelField label="Error">Refresh token expired</PanelField>
      <PanelField label="Files" mono>312</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      One last-sync record is all there is. No sync history is modeled, so this
      must not imply a trend.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Reconnect" tone="primary" />
      <PanelButton label="Sync now" disabled title="Authentication has to be repaired first" />
      <PanelButton
        label="Disconnect"
        tone="danger"
        title="What happens to already-synced files is undefined"
      />
    </PanelActions>
  </PanelSection>
</Panel>
