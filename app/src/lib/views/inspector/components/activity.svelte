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
   * One recorded event: who, what, to what, when.
   *
   * The smallest lens on the screen. An event is a fact, and there is not much to
   * say about one beyond restating it precisely and offering the way to its
   * target.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Activity">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project", key: "project.self" }, { label: "Activity" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Activity">
    <PanelFields>
      <!-- The actor kind is named beside the actor: "edited by Nightly filing
           digest" and "edited by Ana Reyes" mean different things. -->
      <PanelField label="Actor">
        <PanelLink label="Ana Reyes" onselect={() => workbench.inspect("actor.person")} />
      </PanelField>
      <PanelField label="Action">edited</PanelField>
      <PanelField label="Target">Q3 Resilience Memo</PanelField>
      <PanelField label="When" mono>4 minutes ago</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Details" open={false}>
    <PanelFields>
      <PanelField label="Event" mono>resource.updated</PanelField>
      <PanelField label="Source ID" mono>act_2m9…c41</PanelField>
    </PanelFields>
    <PanelNote>
      Whether these belong in the product at all, or only in a debug view, is
      unsettled.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Navigation">
    <PanelActions>
      <PanelButton label="Open target" icon={ChevronRight} />
    </PanelActions>
  </PanelSection>
</Panel>
