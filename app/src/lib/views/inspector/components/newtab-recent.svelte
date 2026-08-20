<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  /**
   * Something that already exists, and the way to open it.
   *
   * The sentence under the button is the whole contract: opening something
   * already open activates that tab and closes this launcher, so the same thing
   * never gets two tabs.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Q3 Resilience Memo">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Q3 Resilience Memo" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Q3 Resilience Memo</PanelField>
      <PanelField label="Kind">Document</PanelField>
      <PanelField label="Updated" mono>4 minutes ago</PanelField>
      <PanelField label="Updated by">
        <PanelLink label="Ana Reyes" onselect={() => workbench.inspect("actor.person")} />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Open">
    <PanelActions><PanelButton label="Open" icon={ChevronRight} tone="primary" /></PanelActions>
    <PanelNote>
      Already open in another tab? That tab activates and this launcher closes —
      resolving a launcher never creates a duplicate target.
    </PanelNote>
  </PanelSection>
</Panel>
