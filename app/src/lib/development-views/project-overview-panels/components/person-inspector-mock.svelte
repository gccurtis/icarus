<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelStat,
    PanelStats,
    PanelTimeline
  } from "$authored-components/panel";

  const noop = () => undefined;

  let { stress = false }: { stress?: boolean } = $props();

  const activity = [
    {
      id: "activity:1",
      what: "Edited: Winter readiness brief",
      detail: "Document",
      time: "12m",
      onselect: noop
    },
    {
      id: "activity:3",
      what: "Started a research question: What drives customer-minutes lost?",
      detail: "Research thread",
      time: "58m",
      onselect: noop
    },
    {
      id: "activity:5",
      what: "Accepted a finding: Customer-minutes lost",
      time: "1h",
      onselect: noop
    }
  ] as const;
</script>

<Panel title={stress ? "Alexandria-Cassandra Montgomery" : "Mira Okonkwo"} titleLines={2}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "People", key: "general.people" },
        { label: stress ? "Alexandria-Cassandra Montgomery" : "Mira Okonkwo" }
      ]}
      onnavigate={noop}
    />
  {/snippet}

  <div class="flex flex-col gap-1 pt-1">
    <div class="px-3 pb-2">
      <PanelActor
        name={stress ? "Alexandria-Cassandra Montgomery" : "Mira Okonkwo"}
        role="Project owner · here now"
        size="head"
      />
    </div>

    <PanelSection title="In this project" flush>
      <PanelFields proportional>
        <PanelField label="Role" hierarchy><PanelChip tone="interactive">Owner</PanelChip></PanelField>
        <PanelField label="Presence" hierarchy><PanelChip tone="success">Here now</PanelChip></PanelField>
        <PanelField label="Email" mono stacked hierarchy>
          <span class="break-all">
            {stress ? "alexandria-cassandra.montgomery@regional-resilience.example.org" : "mira@example.org"}
          </span>
        </PanelField>
        <PanelField label="Joined" mono stacked hierarchy>May 28, 2026</PanelField>
      </PanelFields>
    </PanelSection>

    <PanelSection title="Contribution" flush>
      <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
      <PanelStats label="Mira's project contribution">
        <PanelStat value="23" label="events" />
        <PanelStat value="6" label="comments" />
        <PanelStat value="4" label="resources" />
      </PanelStats>
      </div>
    </PanelSection>

    <PanelSection title="Recent activity" count={activity.length} flush>
      <PanelTimeline entries={activity} label="Mira Okonkwo's recent activity" interactiveRows compact />
    </PanelSection>

    <PanelNote tone="gap">
      Email needs a policy-scoped person capability; presence has no represented owner yet.
    </PanelNote>
  </div>
</Panel>
