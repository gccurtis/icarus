<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Workflow from "@lucide/svelte/icons/workflow";

  import {
    ScreenEmpty,
    ScreenGroup,
    ScreenHeader,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenSurface
  } from "$authored-components/screen";
  import RemoteState from "$app-views/categories/agents/components/remote-state.svelte";
  import TaskFilters from "$app-views/categories/agents/components/task-filters.svelte";
  import TaskTable from "$app-views/categories/agents/components/task-table.svelte";
  import {
    agentsLibrary,
    createPersona,
    inspectActivity,
    isSelected,
    makeAutomation,
    messageOf,
    nextName,
    openAutomation,
    openNewTask,
    openPersona
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
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

  const answer = $derived(library.ready ? library.current : undefined);
  const personas = $derived(answer?.personas ?? []);
  const activity = $derived(answer?.activity ?? []);

  let persona = $state("any");
  let query = $state("");
  let kind = $state("any");
  let taskState = $state("any");
  let sort = $state("started");
  let direction = $state("asc");

  let pendingCreate = $state<"persona" | "automation">();
  let actionError = $state<string>();

  const makePersona = async () => {
    if (pendingCreate !== undefined) return;
    pendingCreate = "persona";
    actionError = undefined;
    try {
      const result = await createPersona(
        view,
        nextName("Untitled persona", personas.map((row) => row.name))
      );
      if (live && view.active.category === "agents") openPersona(view, result.id);
    } catch (error) {
      actionError = messageOf(error);
    } finally {
      pendingCreate = undefined;
    }
  };

  const makeRule = async () => {
    if (pendingCreate !== undefined) return;
    const personaId = persona !== "any" ? persona : personas[0]?.id;
    if (personaId === undefined) {
      actionError = "Make a persona first; an automation asks one to work.";
      return;
    }
    pendingCreate = "automation";
    actionError = undefined;
    try {
      const id = await makeAutomation(
        view,
        personaId,
        (answer?.automations ?? []).map((row) => row.name)
      );
      if (live && id !== undefined && view.active.category === "agents") openAutomation(view, id);
    } catch (error) {
      actionError = messageOf(error);
    } finally {
      pendingCreate = undefined;
    }
  };

  const CREATE = [
    {
      key: "persona",
      label: "Persona",
      icon: Bot,
      tint: "border-intelligence-border bg-intelligence-surface text-intelligence-text hover:border-intelligence-fill hover:bg-intelligence-surface-hover",
      act: makePersona
    },
    {
      key: "task",
      label: "Task",
      icon: Sparkles,
      tint: "border-interactive-border bg-interactive-surface text-interactive-text hover:border-interactive-fill hover:bg-interactive-surface-hover",
      act: () => openNewTask(view, persona === "any" ? undefined : persona)
    },
    {
      key: "automation",
      label: "Automation",
      icon: Workflow,
      tint: "border-accent-2-border bg-accent-2-surface text-accent-2-text hover:border-accent-2-fill hover:bg-accent-2-surface-hover",
      act: makeRule
    },
    {
      key: "skill",
      label: "Skill",
      icon: ScrollText,
      tint: "border-border-subtle bg-surface-panel text-ink-muted",
      act: () => {}
    }
  ] as const;

  const clear = () => {
    query = "";
    kind = "any";
    taskState = "any";
  };
</script>

<ScreenSurface wide>
  <RemoteState
    ready={library.ready}
    error={library.error === undefined ? undefined : messageOf(library.error)}
    what="The agents library"
    onretry={() => library.refresh()}
  >
    <div class="board">
      <div class="area-header">
        <ScreenHeader title="Agents">
          {#snippet actions()}
            <p class="text-caption text-ink-muted m-0 max-w-xs text-end">
              Personas are the behaviour, tasks are the work, and automations start tasks without being asked.
            </p>
          {/snippet}
        </ScreenHeader>
        {#if actionError}
          <ScreenNote tone="gap">{actionError}</ScreenNote>
        {/if}
      </div>

      <div class="area-create">
        <ScreenGroup label="Create">
          <div class="create" role="group" aria-label="What you can make">
            {#each CREATE as pill (pill.key)}
              {@const Icon = pill.icon}
              <button
                type="button"
                onclick={pill.act}
                disabled={pendingCreate !== undefined}
                title={pill.key === "skill" ? "Skills are not built yet" : undefined}
                class="rounded-control text-body-sm flex w-full cursor-pointer items-center gap-2 border px-3 text-start disabled:opacity-60 {pill.tint}"
              >
                <Icon size={16} aria-hidden="true" />
                {pendingCreate === pill.key ? "Creating…" : pill.label}
              </button>
            {/each}
          </div>
        </ScreenGroup>
      </div>

      <div class="area-activity">
        <ScreenGroup label="Activity">
          <div class="feed">
            <ScreenList label="Activity from agents" scroll>
              {#each activity as event (event.id)}
                <ScreenItem
                  meta={relativeTime(event.at, now)}
                  selected={isSelected(view, "activity", event.id)}
                  onselect={() => inspectActivity(view, event.id)}
                >
                  <span class="block truncate">
                    <strong>{event.actorName}</strong>
                    {event.verb}
                  </span>
                  <span class="text-caption text-ink-secondary block truncate" title={event.subject}>
                    {event.subject}
                  </span>
                </ScreenItem>
              {:else}
                <ScreenEmpty title="Nothing has happened yet">
                  What personas do on their tasks lands here.
                </ScreenEmpty>
              {/each}
            </ScreenList>
          </div>
        </ScreenGroup>
      </div>

      <div class="area-tasks">
        <ScreenGroup label="Tasks" fill>
          <div class="table-stack">
            <TaskFilters bind:persona bind:query bind:kind bind:taskState bind:sort bind:direction />

            <div class="table-body">
              <TaskTable {persona} {query} {kind} {taskState} {sort} {direction} scroll onclear={clear} />
            </div>
          </div>
        </ScreenGroup>
      </div>
    </div>
  </RemoteState>
</ScreenSurface>

<style>
  .board {
    --entry: calc(
      var(--token-text-body-sm-leading) + var(--token-text-caption-leading) +
        var(--token-spacing-unit) * 5
    );
    --band: calc(var(--entry) * 4 + 5px);

    display: grid;
    flex: 1;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    grid-template-rows:
      auto
      minmax(0, calc(var(--token-spacing-unit) * 9 + var(--band)))
      minmax(0, 1fr);
    grid-template-areas:
      "header   header"
      "create   activity"
      "tasks    tasks";
  }

  .area-header {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    grid-area: header;
  }

  .area-create {
    grid-area: create;
  }

  .area-activity {
    grid-area: activity;
  }

  .area-tasks {
    grid-area: tasks;
  }

  .area-create,
  .area-activity,
  .area-tasks {
    display: flex;
    min-height: 0;
    flex-direction: column;
  }

  .feed {
    display: grid;
    min-height: 0;
    height: var(--band);
  }

  .create {
    display: grid;
    min-height: 0;
    height: var(--band);
    gap: calc(var(--token-spacing-unit) * 2);
    grid-template-rows: repeat(4, minmax(0, 1fr));
  }

  .table-stack {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .table-body {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  @media (max-width: 60rem) {
    .board {
      flex: none;
      min-height: auto;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto auto;
      grid-template-areas:
        "header"
        "activity"
        "create"
        "tasks";
      align-content: start;
    }
  }
</style>
