<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelCrumbs,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelLink,
    PanelSkeleton
  } from "$authored-components/panel";
  import type { ProjectPanelActor } from "$capabilities/project/index.remote";
  import {
    isContextView,
    isInspectorView,
    workspaceState
  } from "$model/client/workspace-state";
  import {
    activityDestinationSource,
    currentActivityDestination,
    openingForActivityDestination
  } from "$app-views/categories/project-overview/procedures/activity-target";
  import { ticksTheClock } from "$app-views/categories/project-overview/procedures/effects/ticks-the-clock.svelte";
  import { projectAgents } from "$app-views/categories/project-overview/procedures/read-agents";
  import { projectActivity } from "$app-views/categories/project-overview/procedures/read-activity";
  import { projectResources } from "$app-views/categories/project-overview/procedures/read-resources";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  const view = workspaceState();
  const clock = ticksTheClock();
  const resourceAnswer = projectResources();
  const activityId = $derived(
    view.selection?.kind === "activity" ? view.selection.id : undefined
  );
  const answer = $derived(projectActivity(activityId));
  const event = $derived(answer?.ready ? answer.current : undefined);
  const agentsAnswer = $derived(projectAgents(event?.target.kind));
  const resourceIndex = $derived(resourceAnswer.ready ? resourceAnswer.current : undefined);
  const agentsIndex = $derived(agentsAnswer?.ready ? agentsAnswer.current : undefined);
  const targetSource = $derived(
    event === null || event === undefined
      ? undefined
      : activityDestinationSource(event.target.kind)
  );
  const targetDestination = $derived(
    event === null || event === undefined
      ? undefined
      : currentActivityDestination(event.target, resourceIndex, agentsIndex)
  );
  const targetOpening = $derived(
    targetDestination === undefined
      ? undefined
      : openingForActivityDestination(targetDestination)
  );
  const targetUnavailable = $derived(
    targetDestination === undefined &&
      (targetSource === "resources"
        ? resourceAnswer.ready || resourceAnswer.error !== undefined
        : targetSource === "agents"
          ? agentsAnswer !== undefined && (agentsAnswer.ready || agentsAnswer.error !== undefined)
          : false)
  );
  const targetActionLabel = $derived(
    targetDestination?.kind === "persona" ||
      targetDestination?.kind === "task" ||
      targetDestination?.kind === "automation"
      ? `Open ${targetDestination.kind}`
      : "Open resource"
  );
  const now = $derived(clock.current);

  const titleCase = (value: string): string =>
    value.length === 0 ? value : `${value[0].toLocaleUpperCase()}${value.slice(1)}`;

  const exactTime = (at: number): string =>
    new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

  const calendarDate = (at: number): string =>
    new Date(at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

  const relativeTime = (at: number): string => {
    const age = shortSince(at, now);
    return age === "now" ? age : `${age} ago`;
  };

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

  const explainFinding = () => {
    alert("Opening findings is not wired up yet.");
  };

  const explainConnector = () => {
    alert("Opening connectors is not wired up yet.");
  };

  const openTarget = () => {
    if (targetOpening === undefined) return;
    view.open(targetOpening);
  };
</script>

<Panel title="Activity">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Project history", key: "project-overview.history" },
        { label: event === null || event === undefined ? "Activity" : event.what }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  {#snippet actions()}
    {#if targetOpening !== undefined}
      <PanelButton label={targetActionLabel} icon={ExternalLink} tone="ghost" onclick={openTarget} />
    {/if}
  {/snippet}

  <div class="flex flex-col gap-3 pt-1.5">
    {#if activityId === undefined}
      <PanelEmpty title="Select an activity record to inspect." />
    {:else if answer?.error}
      <PanelBanner title="Activity unavailable" tone="attention">
        {answer.error instanceof Error ? answer.error.message : String(answer.error)}
      </PanelBanner>
    {:else if !answer?.ready}
      <PanelSkeleton shape="fields" count={4} />
    {:else if event === null}
      <PanelEmpty title="This activity record is gone or outside the current project." />
    {:else if event !== undefined}
      <section aria-labelledby="project-activity-what" class="flex min-w-0 flex-col gap-1.5">
        <div class="flex min-w-0 flex-col gap-0.5 px-3">
          <h3 id="project-activity-what" class="text-caption text-ink-muted m-0 font-semibold tracking-wide uppercase">
            What
          </h3>
          <p class="text-body text-ink-primary m-0 font-semibold">{event.what}</p>
        </div>

        {#if event.detail !== undefined}
          <p
            class="text-body-sm text-ink-secondary border-border-strong mx-3 my-0 line-clamp-3 break-words border-s-2 ps-2"
            title={event.detail}
          >
            {event.detail}
          </p>
        {/if}
      </section>

      <PanelFields proportional>
        <PanelField label="Where" stacked hierarchy>
          {#if targetOpening !== undefined}
            <PanelLink
              label={event.target.label}
              title={`Open ${event.target.kind === "external-file" ? "External file" : titleCase(event.target.kind)} · ${event.target.label}`}
              lines={2}
              onselect={openTarget}
            />
          {:else if targetDestination?.kind === "finding"}
            <PanelLink
              label={event.target.label}
              title={`Open Finding · ${event.target.label}`}
              lines={2}
              onselect={explainFinding}
            />
          {:else if targetSource === "placeholder"}
            <PanelLink
              label={event.target.label}
              title={`Open Connector · ${event.target.label}`}
              lines={2}
              onselect={explainConnector}
            />
          {:else}
            {event.target.label}
          {/if}
          {#if targetUnavailable}
            <p class="text-caption text-ink-muted m-0">
              This item is missing, deleted, or otherwise unavailable.
            </p>
          {/if}
          {#if event.context !== undefined}
            <p class="text-caption text-ink-muted m-0 line-clamp-2 break-words" title={event.context.label}>
              {event.context.label}
            </p>
          {/if}
        </PanelField>
        <PanelField label="Who" stacked hierarchy>
          {#if event.actor?.id !== undefined}
            <PanelLink
              label={event.actorLabel}
              title={`Open ${event.actorLabel}`}
              lines={2}
              onselect={() => inspectActor(event.actor!)}
            />
          {:else}
            {event.actorLabel}
          {/if}
        </PanelField>
        <PanelField label="When" stacked hierarchy>
          <time
            datetime={new Date(event.at).toISOString()}
            title={exactTime(event.at)}
            class="inline-flex flex-wrap items-baseline gap-1"
          >
            <span>{calendarDate(event.at)}</span>
            <span aria-hidden="true">·</span>
            <span>{relativeTime(event.at)}</span>
          </time>
        </PanelField>
      </PanelFields>
    {/if}
  </div>
</Panel>
