<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import Target from "@lucide/svelte/icons/target";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  /**
   * The project's saved scopes, and the way to the screen that edits them.
   *
   * A Context is a live rule about which resources something may look at. The
   * count on each row is the useful part: it says whether the rule still means
   * what it meant when it was written.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectSet = () => workbench.inspect("project.resource");
</script>

<Panel title="Context">
  <!-- The way out sits with the panel's other controls, not below its list. -->
  {#snippet actions()}
    <PanelButton label="Open Context screen" tone="ghost" />
  {/snippet}

  <PanelSearch placeholder="Search Contexts" matched={4} total={4} flush>
    <PanelSection title="Saved Contexts" count={4} flush>
      <PanelRow title="Regulatory corpus" sub="34 resources" meta="34" icon={Target} onselect={inspectSet} />
      <PanelRow title="Field reports 2024–25" sub="96 resources" meta="96" icon={Target} onselect={inspectSet} />
      <PanelRow title="Everything but drafts" sub="211 resources" meta="211" icon={Target} onselect={inspectSet} />
      <PanelRow
        title="Storm precedents"
        sub="Resolves to 0 resources"
        meta="0"
        icon={TriangleAlert}
        tone="attention"
        onselect={inspectSet}
      />
    </PanelSection>
  </PanelSearch>

  <PanelNote tone="gap">
    A zero-member Context currently broadens retrieval to the whole project.
    Blocked from dispatch until an explicit-empty sentinel exists.
  </PanelNote>
</Panel>
