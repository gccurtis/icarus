<script lang="ts">
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
  import { LibraryState } from "$app-views/categories/agents/content/library.state.svelte";
  import { agentsLibrary, messageOf } from "$app-views/categories/agents/procedures/agents";
  import { createPersona } from "$app-views/categories/agents/procedures/create-persona";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { makeAutomation } from "$app-views/categories/agents/procedures/make-automation";
  import { nextName } from "$app-views/categories/agents/procedures/naming";
  import {
    isSelected,
    openAutomation,
    openNewTask,
    openPersona
  } from "$app-views/categories/agents/procedures/navigate";
  import { run } from "$app-views/categories/agents/procedures/run";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  const surface = new LibraryState();
  const clock = startClock();
  releaseWhenGone(surface);

  const answer = $derived(library.ready ? library.current : undefined);
  const personas = $derived(answer?.personas ?? []);
  const activity = $derived(answer?.activity ?? []);

  const makePersona = () => {
    const name = nextName("Untitled persona", personas.map((row) => row.name));
    void run(
      surface,
      "persona",
      () => createPersona(view, name),
      (made) => {
        if (view.active.category === "agents") openPersona(view, made.id);
      }
    );
  };

  const makeRule = () => {
    const personaId = surface.persona !== "any" ? surface.persona : personas[0]?.id;
    if (personaId === undefined) {
      surface.failure = "Make a persona first; an automation asks one to work.";
      return;
    }
    const taken = (answer?.automations ?? []).map((row) => row.name);
    void run(
      surface,
      "automation",
      () => makeAutomation(view, personaId, taken),
      (made) => {
        if (view.active.category === "agents") openAutomation(view, made.id);
      }
    );
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
      act: () => openNewTask(view, surface.persona === "any" ? undefined : surface.persona)
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
        {#if surface.failure}
          <ScreenNote tone="gap">{surface.failure}</ScreenNote>
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
                disabled={surface.busy !== undefined}
                title={pill.key === "skill" ? "Skills are not built yet" : undefined}
                class="rounded-control text-body-sm flex w-full cursor-pointer items-center gap-2 border px-3 text-start disabled:opacity-60 {pill.tint}"
              >
                <Icon size={16} aria-hidden="true" />
                {surface.busy === pill.key ? "Creating…" : pill.label}
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
                  meta={relativeTime(event.at, clock.now)}
                  selected={isSelected(view, "activity", event.id)}
                  onselect={() => inspectAgent(view, { kind: "activity", id: event.id })}
                >
                  <span class="block truncate">
                    <strong>{event.actorName}</strong>
                    {event.action}
                  </span>
                  <span class="text-caption text-ink-secondary block truncate" title={event.target.label}>
                    {event.target.label}
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
            <TaskFilters bind:persona={surface.persona} bind:query={surface.query} bind:kind={surface.kind} bind:taskState={surface.taskState} bind:sort={surface.sort} bind:direction={surface.direction} />

            <div class="table-body">
              <TaskTable persona={surface.persona} query={surface.query} kind={surface.kind} taskState={surface.taskState} sort={surface.sort} direction={surface.direction} scroll onclear={() => surface.clearFilters()} />
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
