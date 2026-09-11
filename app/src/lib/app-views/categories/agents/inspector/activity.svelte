<script lang="ts">
  import FolderOpen from "@lucide/svelte/icons/folder-open";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelLink,
    PanelSkeleton
  } from "$authored-components/panel";
  import { agentsLibrary, messageOf } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { openTask } from "$app-views/categories/agents/procedures/navigate";
  import { dateAndTime, relativeTime } from "$app-views/categories/agents/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();
  const eventId = $derived(view.selection?.kind === "activity" ? view.selection.id : undefined);
  const answer = $derived(library.ready ? library.current : undefined);
  const event = $derived(
    eventId === undefined ? undefined : answer?.activity.find((row) => row.id === eventId)
  );

  const clock = startClock();

  const TARGET_LABEL = new Map<string, string>([
    ["task", "Task"],
    ["persona", "Persona"],
    ["automation", "Automation"],
    ["chat", "Chat"],
    ["document", "Document"],
    ["presentation", "Presentation"],
    ["spreadsheet", "Spreadsheet"],
    ["finding", "Finding"]
  ]);

  const reachable = $derived(
    event !== undefined &&
    event.target.kind === "task" &&
    answer?.tasks.some((task) => task.id === event.target.id) === true
  );
  const personaReachable = $derived(
    event !== undefined && answer?.personas.some((persona) => persona.id === event.personaId) === true
  );

  const inspectTarget = () => {
    if (event === undefined) return;
    if (event.target.kind === "task") inspectAgent(view, { kind: "task", id: event.target.id });
  };

  const openTarget = () => {
    if (event === undefined) return;
    if (event.target.kind === "task") openTask(view, event.target.id);
  };
</script>

{#snippet openAction()}
  <PanelButton label="Open" icon={FolderOpen} tone="primary" onclick={openTarget} />
{/snippet}

{#if eventId === undefined}
  <Panel title="Activity">
    <PanelEmpty title="Select an entry to read it." />
  </Panel>
{:else if library.error}
  <Panel title="Activity">
    <PanelBanner title="Activity unavailable" tone="danger">{messageOf(library.error)}</PanelBanner>
  </Panel>
{:else if !library.ready}
  <Panel title="Activity">
    <PanelSkeleton shape="fields" count={3} />
  </Panel>
{:else if event === undefined}
  <Panel title="Activity">
    <PanelEmpty title="That entry is no longer in the recent activity." />
  </Panel>
{:else}
  <Panel title="Activity" actions={reachable ? openAction : undefined}>
    <p class="sentence">
      <strong>{event.actorName}</strong>
      {event.action}
      <strong>{event.target.label}</strong>
    </p>
    <PanelFields>
      <PanelField label="Persona">
        {#if personaReachable}
          {@const personaId = event.personaId}
          <PanelLink
            label={event.personaName}
            onselect={() => inspectAgent(view, { kind: "persona", id: personaId })}
          />
        {:else}
          {event.personaName}
        {/if}
      </PanelField>
      <PanelField label={TARGET_LABEL.get(event.target.kind) ?? "Subject"}>
        {#if reachable}
          <PanelLink label={event.target.label} onselect={inspectTarget} />
        {:else}
          {event.target.label}
        {/if}
      </PanelField>
      {#if event.detail}<PanelField label="Details">{event.detail}</PanelField>{/if}
      <PanelField label="When">
        {relativeTime(event.at, clock.now)} · {dateAndTime(event.at)}
      </PanelField>
    </PanelFields>
  </Panel>
{/if}

<style>
  .sentence {
    margin: 0;
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .sentence strong {
    color: var(--token-ink-primary);
    font-weight: var(--token-weight-medium);
  }
</style>
