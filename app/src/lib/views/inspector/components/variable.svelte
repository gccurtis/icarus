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
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Sigma from "@lucide/svelte/icons/sigma";

  /**
   * One named value: how it is written, what type it is, and what it holds.
   *
   * The same lens wherever a variable is reached — the Variables panel, a formula
   * in a document, a cell that refers to one — which is why it is reachable from
   * every screen rather than belonging to one.
   *
   * **The authored name and the lookup key are shown separately** because they
   * differ, and because a formula that fails usually failed on the key.
   */
  const { workbench } = clientModel();
</script>

<Panel title="outageEvents">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Variables" }, { label: "outageEvents" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Variable">
    <PanelFields>
      <PanelField label="Authored" mono>outageEvents</PanelField>
      <PanelField label="Lookup key" mono>outageevents</PanelField>
      <PanelField label="Type" mono>table</PanelField>
      <PanelField label="Order" mono>1 of 9</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Value">
    <PanelFields>
      <PanelField label="Rows" mono>4,182</PanelField>
      <PanelField label="Fields" mono>13</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A preview has to be a server-side prefix. Sending a 4,182-row value to draw
      three rows is not acceptable.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Use">
    <PanelActions>
      <PanelButton label="Insert into formula" icon={Sigma} />
      <PanelButton label="Use in Analysis" icon={ChartColumn} />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <PanelField label="Created by">
        <PanelLink label="Mira Jain" onselect={() => workbench.inspect("actor.person")} />
      </PanelField>
      <PanelField label="Updated" mono>2 days ago</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
