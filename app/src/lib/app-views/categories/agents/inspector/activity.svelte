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
  import {
    openAutomation,
    openPersona,
    openTask
  } from "$app-views/categories/agents/procedures/navigate";
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
    ["slides", "Slide deck"],
    ["spreadsheet", "Spreadsheet"],
    ["finding", "Finding"]
  ]);

  const REACHABLE: readonly string[] = ["task", "persona", "automation"];
  const reachable = $derived(event !== undefined && REACHABLE.includes(event.targetKind));

  const inspectTarget = () => {
    if (event === undefined) return;
    if (event.targetKind === "task") inspectAgent(view, { kind: "task", id: event.targetId });
    else if (event.targetKind === "persona") {
      inspectAgent(view, { kind: "persona", id: event.targetId });
    } else if (event.targetKind === "automation") {
      inspectAgent(view, { kind: "automation", id: event.targetId });
    }
  };

  const openTarget = () => {
    if (event === undefined) return;
    if (event.targetKind === "task") openTask(view, event.targetId);
    else if (event.targetKind === "persona") openPersona(view, event.targetId);
    else if (event.targetKind === "automation") openAutomation(view, event.targetId);
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
      {event.verb}
      <strong>{event.subject}</strong>
    </p>
    <PanelFields>
      <PanelField label="Persona">
        {#if event.personaId !== null}
          {@const personaId = event.personaId}
          <PanelLink
            label={event.actorName}
            onselect={() => inspectAgent(view, { kind: "persona", id: personaId })}
          />
        {:else}
          {event.actorName}
        {/if}
      </PanelField>
      <PanelField label={TARGET_LABEL.get(event.targetKind) ?? "Subject"}>
        {#if reachable}
          <PanelLink label={event.subject} onselect={inspectTarget} />
        {:else}
          {event.subject}
        {/if}
      </PanelField>
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
