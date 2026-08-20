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
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  /**
   * A line of enquiry, and the way into the Research tab.
   *
   * A Research thread is not a resource and is not a tab. It appears in the
   * project's work table because it is work, and opening it selects it inside
   * the single Research tab.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Research thread">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "Research thread" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Why did Feeder 12 fail twice?</PanelField>
      <PanelField label="Mode"><PanelChip tone="accent-1">Question</PanelChip></PanelField>
      <PanelField label="Anchor">Q-14 · Why did Feeder 12 fail twice?</PanelField>
    </PanelFields>
    <PanelActions>
      <PanelButton label="Open in Research" icon={ChevronRight} tone="primary" />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Provenance" open={false}>
    <PanelFields>
      <PanelField label="Created by">
        <PanelLink label="Ana Reyes" onselect={() => workbench.inspect("actor.person")} />
      </PanelField>
      <PanelField label="Revision" mono>7</PanelField>
      <PanelField label="Updated" mono>yesterday</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    Worth saying in the panel because every other row in the same table opens a
    tab, and this one behaves differently.
  -->
  <PanelSection title="Note">
    <PanelNote>
      Research opens the singleton Research tab with this thread selected. It does
      not mint a tab of its own — which thread you are on is view state.
    </PanelNote>
  </PanelSection>
</Panel>
