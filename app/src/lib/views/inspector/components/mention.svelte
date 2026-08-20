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
    PanelQuote,
    PanelSection
  } from "$lib/unique-components/panel";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  /**
   * One comment addressed to you: enough to answer without opening the document,
   * and one click to open the document if you need to.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Mention">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "Mention" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Mention">
    <PanelFields>
      <PanelField label="From">
        <PanelLink label="Mira Jain" onselect={() => workbench.inspect("actor.person")} />
      </PanelField>
      <PanelField label="Where">Q3 Resilience Memo · page 2</PanelField>
      <PanelField label="When" mono>2 hours ago</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Comment">
    <PanelQuote>
      “@ana can you confirm 1,842,000 against the relay log? The event log says 1,840,200.”
    </PanelQuote>
  </PanelSection>

  <!-- The exact text range the comment is attached to, so the question makes
       sense without the surrounding document. -->
  <PanelSection title="Anchored to">
    <PanelQuote>nearly a third of customer-minutes lost</PanelQuote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Open in context" icon={ChevronRight} tone="primary" />
      <PanelButton label="Reply" />
      <PanelButton label="Mark read" title="Needs a per-user read marker, which is not modeled" />
    </PanelActions>
  </PanelSection>
</Panel>
