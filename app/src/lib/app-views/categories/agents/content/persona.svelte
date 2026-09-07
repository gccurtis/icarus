<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Workflow from "@lucide/svelte/icons/workflow";

  import { PanelActor } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { Switch } from "$vendored-components/switch";
  import BandTabs from "$app-views/categories/agents/components/band-tabs.svelte";
  import DefinitionPanel from "$app-views/categories/agents/components/definition-panel.svelte";
  import Grants from "$app-views/categories/agents/components/grants.svelte";
  import NameInput from "$app-views/categories/agents/components/name-input.svelte";
  import RemoteState from "$app-views/categories/agents/components/remote-state.svelte";
  import SurfaceBand from "$app-views/categories/agents/components/surface-band.svelte";
  import SurfaceHead from "$app-views/categories/agents/components/surface-head.svelte";
  import TaskFilters from "$app-views/categories/agents/components/task-filters.svelte";
  import TaskTable from "$app-views/categories/agents/components/task-table.svelte";
  import {
    agentsLibrary,
    createChat,
    duplicatePersona,
    inspectAutomation,
    inspectPersona,
    isSelected,
    makeAutomation,
    messageOf,
    openAutomation,
    openChat,
    openNewTask,
    openPersona,
    personaDetail,
    removePersona,
    showLibrary,
    updateAutomation,
    updatePersona
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import {
    TRIGGER_KINDS,
    TRIGGER_LABEL,
    triggerSummary
  } from "$app-views/categories/agents/procedures/vocabulary";
  import type { UpdatePersonaPatch } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const personaId = $derived(view.active.focus);
  const detail = $derived(personaDetail(personaId));
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const persona = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );
  const answer = $derived(library.ready ? library.current : undefined);
  const chats = $derived((answer?.chats ?? []).filter((row) => row.personaId === persona?.id));

  let claimed = $state<string>();
  $effect(() => {
    if (persona === undefined || claimed === persona.id) return;
    claimed = persona.id;
    inspectPersona(view, persona.id);
  });

  let pending = $state<string>();
  let actionError = $state<string>();
  let band = $state("Tasks");

  let query = $state("");
  let kind = $state("any");
  let taskState = $state("any");
  let sort = $state("started");
  let direction = $state("asc");

  let ruleQuery = $state("");
  let ruleTrigger = $state("any");
  let ruleOn = $state("any");

  const automations = $derived(
    (answer?.automations ?? [])
      .filter((row) => row.personaId === persona?.id)
      .filter((row) => ruleTrigger === "any" || row.trigger.kind === ruleTrigger)
      .filter((row) => ruleOn === "any" || String(row.enabled) === ruleOn)
      .filter((row) => {
        const needle = ruleQuery.trim().toLocaleLowerCase();
        return needle === "" || row.name.toLocaleLowerCase().includes(needle);
      })
  );

  const save = async (label: string, patch: UpdatePersonaPatch) => {
    if (persona === undefined) return;
    pending = label;
    actionError = undefined;
    try {
      const result = await updatePersona(view, persona, patch);
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const duplicate = async () => {
    if (persona === undefined) return;
    pending = "duplicate";
    actionError = undefined;
    try {
      const result = await duplicatePersona(view, persona.id);
      if (!live) return;
      if (result.accepted) openPersona(view, result.id);
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const remove = async () => {
    if (persona === undefined) return;
    pending = "delete";
    actionError = undefined;
    try {
      const result = await removePersona(view, persona);
      if (!live) return;
      if (result.accepted) {
        view.clear();
        showLibrary(view);
      } else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const makeRule = async () => {
    if (persona === undefined) return;
    pending = "automation";
    actionError = undefined;
    try {
      const id = await makeAutomation(view, persona.id, automations.map((row) => row.name));
      if (live && id !== undefined) openAutomation(view, id);
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const chat = async () => {
    if (persona === undefined) return;
    pending = "chat";
    actionError = undefined;
    try {
      const result = await createChat(view, persona.id);
      if (!live) return;
      if (result.accepted) openChat(view, result.chatId);
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const referenced = $derived(
    persona === undefined
      ? 0
      : persona.counts.tasks + persona.counts.automations + persona.counts.chats
  );

  const toggleAutomation = async (automationId: string, revision: number, enabled: boolean) => {
    actionError = undefined;
    try {
      const result = await updateAutomation(view, { id: automationId, revision }, { enabled });
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    }
  };
</script>

<div class="surface">
  <RemoteState
    ready={library.ready && detail !== undefined && detail.ready}
    error={library.error !== undefined
      ? messageOf(library.error)
      : detail?.error !== undefined
        ? messageOf(detail.error)
        : undefined}
    what="The persona"
    onretry={() => {
      void library.refresh();
      void detail?.refresh();
    }}
  >
    {#if persona === undefined}
      <div class="p-6">
        <ScreenEmpty title="That persona is not in this project">
          It may have been deleted, or it belongs to another project.
        </ScreenEmpty>
        <Button variant="outline" size="sm" onclick={() => showLibrary(view)}>Back to the library</Button>
      </div>
    {:else}
      <SurfaceBand kicker="Persona" onback={() => showLibrary(view)} />

      <div class="body">
        <div class="top">
        <SurfaceHead>
          <div class="identity">
            <PanelActor name={persona.name} kind="agent" size="face" />
            <div class="words">
              <NameInput
                value={persona.name}
                label="Persona name"
                placeholder="Name the persona"
                onsave={(next) => save("name", { name: next })}
              />
              <input
                class="describes"
                value={persona.description ?? ""}
                placeholder="One line on what it is for"
                aria-label="Persona description"
                onchange={(event) => {
                  const next = event.currentTarget.value.trim();
                  if (next !== (persona.description ?? "")) {
                    void save("description", { description: next === "" ? null : next });
                  }
                }}
              />
            </div>
          </div>
          {#snippet actions()}
            {#if pending !== undefined}
              <span class="text-caption text-ink-muted">Saving {pending}…</span>
            {/if}
            <Button variant="default" size="sm" onclick={() => openNewTask(view, persona.id)}>
              <Sparkles aria-hidden="true" />
              New task
            </Button>
            <Button variant="outline" size="sm" disabled={pending !== undefined} onclick={makeRule}>
              <Workflow aria-hidden="true" />
              New automation
            </Button>
            <Button variant="outline" size="sm" disabled={pending !== undefined} onclick={chat}>
              <MessageSquarePlus aria-hidden="true" />
              New chat
            </Button>
            <Button variant="outline" size="sm" disabled={pending !== undefined} onclick={duplicate}>
              <Copy aria-hidden="true" />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-danger-text"
              disabled={pending !== undefined || referenced > 0}
              title={referenced > 0
                ? `Still named by ${referenced} ${referenced === 1 ? "thing" : "things"} in this project`
                : "Delete this persona"}
              onclick={remove}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          {/snippet}
        </SurfaceHead>

        {#if actionError}
          <ScreenNote tone="gap">{actionError}</ScreenNote>
        {/if}
        </div>

        <div class="pair">
          <ScreenGroup label="Definition" fill>
            <DefinitionPanel personaId={persona.id} disabled={pending !== undefined} />
          </ScreenGroup>

          <Grants label="Default" owner={persona.id} aligned disabled={pending !== undefined} />
        </div>

        <ScreenGroup label={band} fill>
          {#snippet actions()}
            <BandTabs
              label="What this persona has"
              options="Tasks,Automations"
              value={band}
              onchange={(next) => (band = next)}
            />
          {/snippet}

          {#if band === "Tasks"}
            <div class="stack">
              <TaskFilters
                withPersona={false}
                bind:query
                bind:kind
                bind:taskState
                bind:sort
                bind:direction
              />
              <TaskTable
                persona={persona.id}
                withPersona={false}
                {query}
                {kind}
                {taskState}
                {sort}
                {direction}
                scroll
                onclear={() => {
                  query = "";
                  kind = "any";
                  taskState = "any";
                }}
              />
            </div>
          {:else}
            <div class="stack">
              <ScreenFilters placeholder="Search automations" bind:value={ruleQuery}>
                <select class="filter" bind:value={ruleTrigger} aria-label="Trigger">
                  <option value="any">Any trigger</option>
                  {#each TRIGGER_KINDS as option (option)}
                    <option value={option}>{TRIGGER_LABEL[option]}</option>
                  {/each}
                </select>
                <select class="filter" bind:value={ruleOn} aria-label="Enabled">
                  <option value="any">On and off</option>
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </ScreenFilters>

              {#if automations.length === 0}
                <ScreenEmpty title="No standing rule">
                  An automation asks this persona to work when something happens.
                </ScreenEmpty>
              {:else}
                <ScreenTable columns={["Automation", "Trigger", "Fired", "Last fired", "On"]}>
                  {#each automations as row (row.id)}
                    <ScreenRow
                      selected={isSelected(view, "automation", row.id)}
                      onselect={() => inspectAutomation(view, row.id)}
                      onopen={() => openAutomation(view, row.id)}
                    >
                      <ScreenCell>
                        <button
                          type="button"
                          class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
                          onclick={() => inspectAutomation(view, row.id)}
                          ondblclick={() => openAutomation(view, row.id)}
                        >
                          {row.name}
                        </button>
                      </ScreenCell>
                      <ScreenCell>
                        {TRIGGER_LABEL[row.trigger.kind]} · {triggerSummary(row.trigger, row.triggerRefName ?? undefined)}
                      </ScreenCell>
                      <ScreenCell num>{row.firedCount}</ScreenCell>
                      <ScreenCell num>{row.lastFiredAt === null ? "—" : relativeTime(row.lastFiredAt, now)}</ScreenCell>
                      <ScreenCell>
                        <Switch
                          size="sm"
                          checked={row.enabled}
                          aria-label="Enabled"
                          onCheckedChange={(next: boolean) => toggleAutomation(row.id, row.revision, next)}
                        />
                      </ScreenCell>
                    </ScreenRow>
                  {/each}
                </ScreenTable>
              {/if}
            </div>
          {/if}
        </ScreenGroup>

        <ScreenGroup label="Chats" fill>
          {#if chats.length === 0}
            <ScreenEmpty title="No conversation yet">
              New chat opens one in its own tab.
            </ScreenEmpty>
          {:else}
            <ScreenList label="Chats with {persona.name}" scroll>
              {#each chats as row (row.id)}
                <ScreenItem
                  title={row.title}
                  excerpt={row.lastLine ?? "Nothing said yet"}
                  meta={relativeTime(row.updatedAt, now)}
                  onselect={() => openChat(view, row.id)}
                />
              {/each}
            </ScreenList>
          {/if}
        </ScreenGroup>
      </div>
    {/if}
  </RemoteState>
</div>

<style>
  .surface {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .identity {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: start;
  }

  .words {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .describes {
    width: 100%;
    margin-left: calc(var(--token-spacing-unit) * -1);
    padding: 0 var(--token-spacing-unit);
    border: 1px solid transparent;
    border-radius: var(--token-radius-control);
    background: transparent;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    outline: none;
  }

  .describes:hover,
  .describes:focus {
    border-color: var(--token-border-subtle);
    background: var(--token-surface-elevated);
  }

  .body {
    display: grid;
    min-height: 0;
    flex: 1;
    gap: calc(var(--token-spacing-unit) * 6);
    grid-template-rows: auto minmax(21rem, 5fr) minmax(23rem, 5fr) minmax(11rem, 3fr);
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 6);
    scrollbar-width: none;
  }

  .top {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .pair {
    display: grid;
    min-height: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 6);
    align-items: stretch;
  }

  .stack {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .filter {
    height: calc(var(--token-spacing-unit) * 7);
    padding: 0 calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  @media (max-width: 64rem) {
    .pair {
      grid-template-columns: 1fr;
    }
  }
</style>
