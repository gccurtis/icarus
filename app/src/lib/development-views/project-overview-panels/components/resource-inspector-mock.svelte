<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEditableText,
    PanelLink,
    PanelSection,
    PanelStat,
    PanelStats,
    PanelTimeline
  } from "$authored-components/panel";

  let { stress = false }: { stress?: boolean } = $props();

  const noop = () => undefined;
  const LONG_SUMMARY =
    "Executive view of the grid's highest winter reliability exposures, the operating assumptions behind every restoration window, the evidence that could overturn those assumptions, and the decisions each regional owner must make before peak season. The brief deliberately separates established facts from unresolved dispatch-time discrepancies so a reader can decide quickly whether to open the full document.";
  const SHORT_SUMMARY =
    "Executive view of the grid's highest winter reliability exposures and the decisions needed before peak season.";
  let summary = $state("");
  let summaryMode = $state<boolean | undefined>(undefined);

  $effect(() => {
    if (summaryMode === stress) return;
    summaryMode = stress;
    summary = stress ? LONG_SUMMARY : SHORT_SUMMARY;
  });

  const activity = $derived([
    {
      id: "activity:1",
      what: stress
        ? "Edited the northern transmission corridor assumptions and every downstream restoration scenario by Alexandria-Cassandra Montgomery"
        : "Edited by Mira Okonkwo",
      time: "12m",
      actor: "Mira Okonkwo",
      onselect: noop
    },
    {
      id: "activity:11",
      what: "Added a comment by Ana Duarte",
      detail: "Exposure window",
      time: "18m",
      actor: "Ana Duarte",
      onselect: noop
    },
    {
      id: "activity:12",
      what: "Refreshed cited findings by Grid Analyst",
      time: "2h",
      actor: "Grid Analyst",
      tone: "intelligence" as const,
      onselect: noop
    }
  ] as const);
</script>

<Panel
  title={stress ? "Winter readiness brief for the northern transmission corridor and every downstream substation" : "Winter readiness brief"}
  titleLines={2}
>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Resources", key: "project-overview.resources" }, { label: "Document" }]}
      onnavigate={noop}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Open document" icon={ExternalLink} tone="primary" onclick={noop} />
  {/snippet}

  <div class="flex flex-col gap-1 pt-1">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2">
      <PanelChip tone="interactive">Document</PanelChip>
      <span class="text-caption text-ink-muted min-w-0">
        Created by <PanelLink label="Mira Okonkwo" onselect={noop} />
        <span aria-hidden="true"> · </span>42d
      </span>
    </div>

    <PanelSection title="Summary" flush>
      <div class="px-3">
        <PanelEditableText
          value={summary}
          label="Summary for Winter readiness brief"
          placeholder="Add a short summary"
          multiline
          appearance="field"
          previewLines={3}
          onchange={(next) => (summary = next)}
        />
      </div>
    </PanelSection>

    <PanelSection title="At a glance" flush>
      <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
        <PanelStats columns={2} label="At a glance for Winter readiness brief">
          <PanelStat label="Words" value="1,286" />
          <PanelStat label="Comments" value="3" />
        </PanelStats>
      </div>
    </PanelSection>

    <PanelSection title="Recent activity" count={activity.length} flush>
      <PanelTimeline
        entries={activity}
        label="Recent activity for Winter readiness brief"
        interactiveRows
        compact
      />
    </PanelSection>
  </div>
</Panel>
