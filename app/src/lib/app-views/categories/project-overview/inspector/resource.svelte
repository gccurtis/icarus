<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEditableText,
    PanelEmpty,
    PanelLink,
    PanelNote,
    PanelSection,
    PanelSkeleton,
    PanelStat,
    PanelStats,
    PanelTimeline
  } from "$authored-components/panel";
  import type {
    ProjectPanelActor,
    ProjectResourceKind
  } from "$capabilities/project/index.remote";
  import {
    isContextView,
    isInspectorView,
    workspaceState
  } from "$model/client/workspace-state";
  import { activityLabel } from "$app-views/categories/project-overview/procedures/activity-label";
  import { ticksTheClock } from "$app-views/categories/project-overview/procedures/effects/ticks-the-clock.svelte";
  import { projectResource } from "$app-views/categories/project-overview/procedures/read-resource";
  import { resourceSummaryCommand } from "$app-views/categories/project-overview/procedures/resource-summary-command.svelte";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  const KIND_LABEL: Record<ProjectResourceKind, string> = {
    document: "Document",
    presentation: "Presentation",
    spreadsheet: "Spreadsheet",
    research: "Research",
    finding: "Finding"
  };

  const KIND_TONE: Record<ProjectResourceKind, "interactive" | "accent-1" | "accent-2" | "intelligence" | "active"> = {
    document: "interactive",
    presentation: "accent-1",
    spreadsheet: "accent-2",
    research: "intelligence",
    finding: "active"
  };

  const view = workspaceState();
  const clock = ticksTheClock();
  const summary = resourceSummaryCommand();
  const resourceId = $derived(view.selection?.id);
  const answer = $derived(projectResource(resourceId));
  const resource = $derived(answer?.ready ? answer.current : undefined);
  const now = $derived(clock.current);

  const exactTime = (at: number): string =>
    new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

  const navigate = (key: string) => {
    if (isContextView(key)) view.selectContext(key);
    else if (isInspectorView(key)) view.inspect(key);
  };

  const inspectActor = (actor: ProjectPanelActor) => {
    if (actor.id === undefined) return;
    if (actor.kind === "person") {
      view.inspect("general.person", { kind: "person", id: actor.id });
    } else if (actor.kind === "agent") {
      view.inspect("agents.task", { kind: "task", id: actor.id });
    } else if (actor.kind === "connector") {
      view.inspect("project-overview.connector", { kind: "connector", id: actor.id });
    }
  };

  const openResource = () => {
    if (resource === null || resource === undefined) return;
    if (resource.kind === "document") {
      view.open({ category: "document-editor", resourceId: resource.id });
    } else if (resource.kind === "presentation") {
      view.open({ category: "presentation-editor", resourceId: resource.id });
    }
  };

  const recent = $derived(
    (resource?.recentActivity ?? []).map((entry) => ({
      id: entry.id,
      what: `${activityLabel(entry.verb)} by ${entry.actorLabel}`,
      ...(entry.detail === undefined && entry.context === undefined
        ? {}
        : { detail: entry.detail ?? entry.context?.label }),
      time: shortSince(entry.at, now),
      actor: entry.actorLabel,
      tone: entry.actor?.kind === "agent" ? ("intelligence" as const) : undefined,
      onselect: () =>
        view.inspect("project-overview.activity", { kind: "activity", id: entry.id })
    }))
  );
</script>

<Panel title={resource?.name ?? "Resource"} titleLines={2}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Resources", key: "project-overview.resources" },
        { label: resource === null || resource === undefined ? "Resource" : KIND_LABEL[resource.kind] }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  {#snippet actions()}
    {#if resource?.openable}
      <PanelButton
        label={`Open ${KIND_LABEL[resource.kind].toLocaleLowerCase()}`}
        icon={ExternalLink}
        tone="primary"
        onclick={openResource}
      />
    {/if}
  {/snippet}

  <div class="flex flex-col gap-1 pt-1">
    {#if resourceId === undefined}
      <PanelEmpty title="Select a resource to inspect." />
    {:else if answer?.error}
      <PanelBanner title="Resource unavailable" tone="attention">
        {answer.error instanceof Error ? answer.error.message : String(answer.error)}
      </PanelBanner>
    {:else if !answer?.ready}
      <PanelSkeleton shape="fields" count={7} />
    {:else if resource === null}
      <PanelEmpty title="This resource is gone or outside the current project." />
    {:else if resource !== undefined}
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2">
        <PanelChip tone={KIND_TONE[resource.kind]}>{KIND_LABEL[resource.kind]}</PanelChip>
        <span class="text-caption text-ink-muted min-w-0">
          Created by
          {#if resource.createdBy?.id !== undefined}
            <PanelLink
              label={resource.createdBy.label}
              title={`Open ${resource.createdBy.label}`}
              onselect={() => inspectActor(resource.createdBy!)}
            />
          {:else}
            {resource.createdBy?.label ?? "Someone"}
          {/if}
          <span aria-hidden="true"> · </span>
          <time datetime={new Date(resource.createdAt).toISOString()} title={exactTime(resource.createdAt)}>
            {shortSince(resource.createdAt, now)}
          </time>
        </span>
      </div>

      <PanelSection title="Summary" flush>
        <div class="px-3">
          <PanelEditableText
            value={resource.summary}
            label={`Summary for ${resource.name}`}
            placeholder="Add a short summary"
            multiline
            appearance="field"
            previewLines={3}
            disabled={summary.saving}
            onchange={(next) => void summary.save(resource.id, next)}
          />
        </div>
        {#if summary.error !== undefined}
          <PanelNote tone="gap">{summary.error}</PanelNote>
        {/if}
      </PanelSection>

      <PanelSection title="At a glance" flush>
        <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
          <PanelStats columns={2} label={`At a glance for ${resource.name}`}>
            {#each resource.facts as fact (fact.label)}
              <PanelStat label={fact.label} value={fact.value} />
            {/each}
          </PanelStats>
        </div>
      </PanelSection>

      <PanelSection title="Recent activity" count={recent.length} flush>
        <PanelTimeline
          entries={recent}
          label={`Recent activity for ${resource.name}`}
          interactiveRows
          compact
          empty="No activity has been recorded for this resource."
        />
      </PanelSection>
    {/if}
  </div>
</Panel>
