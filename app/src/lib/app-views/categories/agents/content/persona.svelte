<script lang="ts">
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
  import { PersonaState } from "$app-views/categories/agents/content/persona.state.svelte";
  import {
    agentsLibrary,
    messageOf,
    personaDetail
  } from "$app-views/categories/agents/procedures/agents";
  import { createChat } from "$app-views/categories/agents/procedures/create-chat";
  import { duplicatePersona } from "$app-views/categories/agents/procedures/duplicate-persona";
  import { followShownThing } from "$app-views/categories/agents/procedures/effects/claim.svelte";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { makeAutomation } from "$app-views/categories/agents/procedures/make-automation";
  import {
    isSelected,
    openAutomation,
    openChat,
    openNewTask,
    openPersona,
    showLibrary
  } from "$app-views/categories/agents/procedures/navigate";
  import { removePersona } from "$app-views/categories/agents/procedures/remove-persona";
  import { run } from "$app-views/categories/agents/procedures/run";
  import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
  import { updatePersona } from "$app-views/categories/agents/procedures/update-persona";
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

  const surface = new PersonaState();
  const clock = startClock();
  releaseWhenGone(surface);

  const persona = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );
  const answer = $derived(library.ready ? library.current : undefined);
  const chats = $derived((answer?.chats ?? []).filter((row) => row.personaId === persona?.id));

  followShownThing(view, surface, () =>
    persona === undefined ? undefined : { kind: "persona", id: persona.id }
  );

  const automations = $derived(
    (answer?.automations ?? [])
      .filter((row) => row.personaId === persona?.id)
      .filter((row) => surface.ruleTrigger === "any" || row.trigger.kind === surface.ruleTrigger)
      .filter((row) => surface.ruleOn === "any" || String(row.enabled) === surface.ruleOn)
      .filter((row) => {
        const needle = surface.ruleQuery.trim().toLocaleLowerCase();
        return needle === "" || row.name.toLocaleLowerCase().includes(needle);
      })
  );

  const save = (label: string, patch: UpdatePersonaPatch) => {
    if (persona === undefined) return;
    const held = persona;
    void run(surface, label, () => updatePersona(view, held, patch));
  };

  const duplicate = () => {
    if (persona === undefined) return;
    const held = persona;
    void run(
      surface,
      "duplicate",
      () => duplicatePersona(view, held.id),
      (made) => openPersona(view, made.id)
    );
  };

  const remove = () => {
    if (persona === undefined) return;
    const held = persona;
    void run(surface, "delete", () => removePersona(view, held), () => {
      view.clear();
      showLibrary(view);
    });
  };

  const makeRule = () => {
    if (persona === undefined) return;
    const held = persona;
    const taken = automations.map((row) => row.name);
    void run(
      surface,
      "automation",
      () => makeAutomation(view, held.id, taken),
      (made) => openAutomation(view, made.id)
    );
  };

  const chat = () => {
    if (persona === undefined) return;
    const held = persona;
    void run(
      surface,
      "chat",
      () => createChat(view, held.id),
      (made) => openChat(view, made.chatId)
    );
  };

  const referenced = $derived(
    persona === undefined
      ? 0
      : persona.counts.tasks + persona.counts.automations + persona.counts.chats
  );

  const toggleAutomation = (automationId: string, revision: number, enabled: boolean) => {
    void run(surface, `automation:${automationId}`, () =>
      updateAutomation(view, { id: automationId, revision }, { enabled })
    );
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
            {#if surface.busy !== undefined}
              <span class="text-caption text-ink-muted">Saving {surface.busy}…</span>
            {/if}
            <Button variant="default" size="sm" onclick={() => openNewTask(view, persona.id)}>
              <Sparkles aria-hidden="true" />
              New task
            </Button>
            <Button variant="outline" size="sm" disabled={surface.busy !== undefined} onclick={makeRule}>
              <Workflow aria-hidden="true" />
              New automation
            </Button>
            <Button variant="outline" size="sm" disabled={surface.busy !== undefined} onclick={chat}>
              <MessageSquarePlus aria-hidden="true" />
              New chat
            </Button>
            <Button variant="outline" size="sm" disabled={surface.busy !== undefined} onclick={duplicate}>
              <Copy aria-hidden="true" />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="text-danger-text"
              disabled={surface.busy !== undefined || referenced > 0}
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

        {#if surface.failure}
          <ScreenNote tone="gap">{surface.failure}</ScreenNote>
        {/if}
        </div>

        <div class="pair">
          <ScreenGroup label="Definition" fill>
            <DefinitionPanel personaId={persona.id} disabled={surface.busy !== undefined} />
          </ScreenGroup>

          <Grants label="Scope" owner={persona.id} aligned disabled={surface.busy !== undefined} />
        </div>

        <ScreenGroup label={surface.band} fill>
          {#snippet actions()}
            <BandTabs
              label="What this persona has"
              options="Tasks,Automations"
              value={surface.band}
              onchange={(next) => (surface.band = next)}
            />
          {/snippet}

          {#if surface.band === "Tasks"}
            <div class="stack">
              <TaskFilters
                withPersona={false}
                bind:query={surface.query}
                bind:kind={surface.kind}
                bind:taskState={surface.taskState}
                bind:sort={surface.sort}
                bind:direction={surface.direction}
              />
              <TaskTable
                persona={persona.id}
                withPersona={false}
                query={surface.query}
                kind={surface.kind}
                taskState={surface.taskState}
                sort={surface.sort}
                direction={surface.direction}
                scroll
                onclear={() => surface.clearFilters()}
              />
            </div>
          {:else}
            <div class="stack">
              <ScreenFilters placeholder="Search automations" bind:value={surface.ruleQuery}>
                <select class="filter" bind:value={surface.ruleTrigger} aria-label="Trigger">
                  <option value="any">Any trigger</option>
                  {#each TRIGGER_KINDS as option (option)}
                    <option value={option}>{TRIGGER_LABEL[option]}</option>
                  {/each}
                </select>
                <select class="filter" bind:value={surface.ruleOn} aria-label="Enabled">
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
                      onselect={() => inspectAgent(view, { kind: "automation", id: row.id })}
                      onopen={() => openAutomation(view, row.id)}
                    >
                      <ScreenCell>
                        <button
                          type="button"
                          class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
                          onclick={() => inspectAgent(view, { kind: "automation", id: row.id })}
                          ondblclick={() => openAutomation(view, row.id)}
                        >
                          {row.name}
                        </button>
                      </ScreenCell>
                      <ScreenCell>
                        {TRIGGER_LABEL[row.trigger.kind]} · {triggerSummary(row.trigger, row.triggerRefName ?? undefined)}
                      </ScreenCell>
                      <ScreenCell num>{row.firedCount}</ScreenCell>
                      <ScreenCell num>{row.lastFiredAt === null ? "—" : relativeTime(row.lastFiredAt, clock.now)}</ScreenCell>
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
                  meta={relativeTime(row.updatedAt, clock.now)}
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
