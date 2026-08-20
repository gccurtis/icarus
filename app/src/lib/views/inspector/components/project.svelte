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
  import Settings from "@lucide/svelte/icons/settings";

  /**
   * The project itself — what the inspector shows when nothing more specific is
   * selected on the project overview, and where Settings lands.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Project">
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Project" }]} onnavigate={(key) => workbench.inspect(key)} />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Name" stacked>Northwind Grid Resilience</PanelField>
      <PanelField label="Description" stacked>
        Winter-storm hardening case for the 2026 rate filing.
      </PanelField>
      <PanelField label="State"><PanelChip tone="success">Active</PanelChip></PanelField>
      <PanelField label="Your role"><PanelChip tone="interactive">Owner</PanelChip></PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="People">
    <PanelFields>
      <PanelField label="Owners" mono>2</PanelField>
      <PanelField label="Editors" mono>4</PanelField>
      <PanelField label="Viewers" mono>1</PanelField>
    </PanelFields>
    <PanelNote>The model permits multiple owners and requires at least one.</PanelNote>
  </PanelSection>

  <PanelSection title="Dates" open={false}>
    <PanelFields>
      <PanelField label="Created" mono>12 Mar 2026</PanelField>
      <PanelField label="Updated" mono>4 minutes ago</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Project records no creator or updater actor, so these are dates only.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Project actions" open={false}>
    <PanelActions>
      <PanelButton label="Settings" icon={Settings} />
      <PanelButton label="Archive" tone="danger" title="Archive semantics are undefined" />
    </PanelActions>
  </PanelSection>
</Panel>
