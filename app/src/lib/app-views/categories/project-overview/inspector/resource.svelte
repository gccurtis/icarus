<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import { onMount } from "svelte";

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
  import {
    readProjectResource,
    updateProjectResourceSummary,
    type ProjectPanelActor,
    type ProjectResourceKind
  } from "$capabilities/project/index.remote";
  import {
    isContextView,
    isInspectorView,
    workspaceState
  } from "$model/client/workspace-state";
  import { activityLabel } from "$app-views/categories/project-overview/procedures/activity-label";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  const KIND_LABEL: Record<ProjectResourceKind, string> = {
    document: "Document",
    slides: "Slide deck",
    spreadsheet: "Spreadsheet",
    research: "Research",
    finding: "Finding"
  };

  const KIND_TONE: Record<ProjectResourceKind, "interactive" | "accent-1" | "accent-2" | "intelligence" | "active"> = {
    document: "interactive",
    slides: "accent-1",
    spreadsheet: "accent-2",
    research: "intelligence",
    finding: "active"
  };

  const view = workspaceState();
  const resourceId = $derived(view.selection?.id);
  const answer = $derived(
    resourceId === undefined ? undefined : readProjectResource({ resourceId })
  );
  const resource = $derived(answer?.ready ? answer.current : undefined);
  let now = $state(Date.now());
  let saving = $state(false);
  let saveError = $state<string | undefined>(undefined);

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

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
    } else if (resource.kind === "slides") {
      view.open({ category: "slide-deck-editor", resourceId: resource.id });
    }
  };

  const saveSummary = async (summary: string) => {
    const held = resource;
    if (held === null || held === undefined) return;
    saving = true;
    saveError = undefined;
    try {
      await updateProjectResourceSummary({ resourceId: held.id, summary });
    } catch (error) {
      saveError = error instanceof Error ? error.message : "The summary did not save.";
    } finally {
      saving = false;
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
            disabled={saving}
            onchange={(next) => void saveSummary(next)}
          />
        </div>
        {#if saveError !== undefined}
          <PanelNote tone="gap">{saveError}</PanelNote>
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
