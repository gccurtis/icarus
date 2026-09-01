<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Folder from "@lucide/svelte/icons/folder";
  import Plus from "@lucide/svelte/icons/plus";
  import Zap from "@lucide/svelte/icons/zap";

  import { PanelActor, PanelChip } from "$authored-components/panel";
  import {
    ScreenAction,
    ScreenCard,
    ScreenCards,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import {
    personasIn,
    tasksIn,
    type PersonaRow,
    type PersonaScope,
    type TaskRow
  } from "$capabilities/agents";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  /**
   * Agents — every persona in reach, and every task they are running.
   *
   * One category, not two. An Automation is a task with a trigger and a persona is
   * what runs one, so Personas and Automations are not two subjects: they are one
   * subject cut down the middle, and the cut falls exactly where the interesting
   * question is — *what is this agent doing right now*.
   *
   * **Personas are folders before they are cards.** Whose an agent is decides who
   * may edit it, so the three scopes are the first division rather than a filter
   * chip. Searching flattens them: a search is a question about all of them, and
   * making someone open three folders to answer it is the folder winning over the
   * question.
   *
   * **Tasks are a table, personas are cards.** An agent is recognised by its face
   * and its record; a task is read off a row against the rows above it — when it
   * started, who asked, how far along.
   */
  const personas = $derived(personasIn(view.project).current);
  const tasks = $derived(tasksIn(view.project).current);

  const SCOPES: readonly PersonaScope[] = ["Project", "Shared", "Personal"];

  /** The folder that is open, or none. Searching ignores it entirely. */
  let folder = $state<PersonaScope | undefined>(undefined);
  let personaSearch = $state("");

  const searching = $derived(personaSearch.trim() !== "");

  const matchingPersonas = $derived(
    personas.filter((row: PersonaRow) => {
      const needle = personaSearch.trim().toLowerCase();
      return (
        row.name.toLowerCase().includes(needle) || row.describes.toLowerCase().includes(needle)
      );
    })
  );

  const shownPersonas = $derived(
    searching
      ? matchingPersonas
      : folder === undefined
        ? []
        : personas.filter((row: PersonaRow) => row.scope === folder)
  );

  const countIn = (scope: PersonaScope): number =>
    personas.filter((row: PersonaRow) => row.scope === scope).length;

  /** Running is left off when there is none, so a quiet persona reads as quiet. */
  const record = (row: PersonaRow): string =>
    row.running === 0 ? `${row.tasks} tasks` : `${row.tasks} tasks · ${row.running} running`;

  const openPersona = (id: string) => view.showSubscreen("persona", id);

  // ---------------------------------------------------------------- tasks ----

  let taskSearch = $state("");
  let persona = $state("all");
  let state_ = $state("all");
  let started = $state("all");
  let order = $state("started");
  let ascending = $state(false);

  const STATES = [
    { value: "all", label: "Any state" },
    { value: "running", label: "Running" },
    { value: "waiting", label: "Waiting" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" }
  ] as const;

  const STARTED = [
    { value: "all", label: "Anyone or anything" },
    { value: "person", label: "Started by a person" },
    { value: "automation", label: "Fired by an Automation" }
  ] as const;

  const SORTS = [
    { value: "started", label: "Time started" },
    { value: "state", label: "State" },
    { value: "persona", label: "Persona" },
    { value: "title", label: "Task" }
  ] as const;

  const nameOf = (id: string): string =>
    personas.find((row: PersonaRow) => row.id === id)?.name ?? id;

  const STATE_TONE: Record<TaskRow["state"], "neutral" | "success" | "danger" | "attention"> = {
    running: "attention",
    waiting: "neutral",
    completed: "success",
    failed: "danger"
  };

  const matchingTasks = $derived(
    tasks
      .filter((row: TaskRow) =>
        row.title.toLowerCase().includes(taskSearch.trim().toLowerCase())
      )
      .filter((row: TaskRow) => persona === "all" || row.persona === persona)
      .filter((row: TaskRow) => state_ === "all" || row.state === state_)
      .filter(
        (row: TaskRow) =>
          started === "all" ||
          (started === "automation" ? row.firedBy !== undefined : row.firedBy === undefined)
      )
  );

  /**
   * Sorted, and the direction is a control rather than a property of the order.
   *
   * Newest-first is what anybody wants of *Time started*, and A–Z is what
   * anybody wants of a name — so the arrow starts pointed the way each order is
   * usually read rather than always descending.
   */
  const compare = (a: TaskRow, b: TaskRow): number => {
    if (order === "started") return a.age - b.age;
    if (order === "persona") return nameOf(a.persona).localeCompare(nameOf(b.persona));
    if (order === "state") return a.state.localeCompare(b.state);
    return a.title.localeCompare(b.title);
  };

  const shownTasks = $derived(
    [...matchingTasks].sort((a, b) => (ascending ? compare(a, b) : -compare(a, b)))
  );

  const openTask = (id: string) => view.showSubscreen("task", id);
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Agents"
        about="Personas are the behaviour; tasks are the work. An Automation is a task with a trigger."
      >
        {#snippet actions()}
          <ScreenAction
            label="New persona"
            icon={Plus}
            onclick={() => view.showSubscreen("persona", "new")}
          />
          <ScreenAction
            label="New automation"
            icon={Zap}
            onclick={() => view.showSubscreen("automation", "new")}
          />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-personas flex min-w-0 flex-col gap-2">
      <ScreenFilters
        placeholder="Search every persona"
        matched={searching ? matchingPersonas.length : undefined}
        total={searching ? personas.length : undefined}
        bind:value={personaSearch}
      >
        {#if folder !== undefined && !searching}
          <Button variant="outline" size="sm" onclick={() => (folder = undefined)}>
            <ChevronLeft size={14} aria-hidden="true" />
            All personas
          </Button>
        {/if}
      </ScreenFilters>

      <ScreenGroup
        label={searching ? "Matching personas" : (folder ?? "Personas")}
        count={String(searching ? matchingPersonas.length : personas.length)}
      >
        {#if !searching && folder === undefined}
          <!--
            Folders, one per scope. A scope is who may edit, which is the second
            question anybody asks of an agent and the first that changes what they
            can do about it.
          -->
          <ScreenCards min="14rem">
            {#each SCOPES as scope (scope)}
              <ScreenCard
                title={scope}
                sub="{countIn(scope)} {countIn(scope) === 1 ? 'persona' : 'personas'}"
                icon={Folder}
                onselect={() => (folder = scope)}
              />
            {/each}
          </ScreenCards>
        {:else if shownPersonas.length === 0}
          <ScreenEmpty
            kind={searching ? "no-matches" : "nothing-yet"}
            title={searching ? "No persona matches" : "Nothing in this folder"}
            onclear={searching ? () => (personaSearch = "") : undefined}
          >
            {searching
              ? "Nothing here is named or described that way."
              : "Personas you put here will show up in this folder."}
          </ScreenEmpty>
        {:else}
          <ScreenCards min="16rem">
            {#each shownPersonas as row (row.id)}
              <!--
                Double-click opens the editor; a single click selects and inspects.
                Two acts, and conflating them would mean you could not look at a
                persona without leaving the list you were comparing it against.
              -->
              <div ondblclick={() => openPersona(row.id)} role="presentation">
                <ScreenCard
                  title={row.name}
                  sub={row.describes}
                  selected={view.selection?.kind === "persona" &&
                    view.selection?.id === row.id}
                  onselect={() =>
                    view.inspect("agents.persona", { kind: "persona", id: row.id })}
                >
                  {#snippet thumb()}<PanelActor name={row.name} kind="agent" size="face" />{/snippet}
                  <span class="flex flex-wrap items-center gap-1">
                    <PanelChip>{record(row)}</PanelChip>
                    {#if searching}<PanelChip tone="neutral">{row.scope}</PanelChip>{/if}
                  </span>
                </ScreenCard>
              </div>
            {/each}
          </ScreenCards>
        {/if}
      </ScreenGroup>
    </div>

    <div class="area-tasks flex min-w-0 flex-col gap-2">
      <ScreenGroup label="Tasks" count="{shownTasks.length} of {tasks.length}">
        {#snippet actions()}
          <Button
            variant="outline"
            size="sm"
            onclick={() => (ascending = !ascending)}
            title={ascending ? "Sorted ascending" : "Sorted descending"}
          >
            {ascending ? "Ascending" : "Descending"}
          </Button>
        {/snippet}

        <div class="flex flex-col gap-2">
          <ScreenFilters
            placeholder="Search tasks"
            matched={shownTasks.length}
            total={tasks.length}
            sorts={SORTS}
            bind:sort={order}
            bind:value={taskSearch}
          >
            <select
              class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
              bind:value={persona}
              aria-label="Managing persona"
            >
              <option value="all">Any persona</option>
              {#each personas as row (row.id)}
                <option value={row.id}>{row.name}</option>
              {/each}
            </select>
            <select
              class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
              bind:value={state_}
              aria-label="State"
            >
              {#each STATES as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <select
              class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
              bind:value={started}
              aria-label="Started by"
            >
              {#each STARTED as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </ScreenFilters>

          {#if shownTasks.length === 0}
            <ScreenEmpty
              kind="no-matches"
              title="No task matches"
              onclear={() => {
                taskSearch = "";
                persona = "all";
                state_ = "all";
                started = "all";
              }}
            >
              Nothing running or finished fits all of those at once.
            </ScreenEmpty>
          {:else}
            <ScreenTable columns={["Task", "Persona", "Started by", "State", "Started"]}>
              {#each shownTasks as row (row.id)}
                <ScreenRow selected={view.selection?.kind === "task" && view.selection?.id === row.id}>
                  <ScreenCell>
                    <span
                      role="presentation"
                      ondblclick={() => openTask(row.id)}
                      class="flex items-center gap-1.5"
                    >
                      <button
                        type="button"
                        class="hover:text-ink-primary text-start"
                        onclick={() => view.inspect("agents.task", { kind: "task", id: row.id })}
                      >
                        {row.title}
                      </button>
                      {#if row.firedBy}
                        <PanelChip tone="accent-1">Automation</PanelChip>
                      {/if}
                    </span>
                  </ScreenCell>
                  <ScreenCell icon={Bot} name={nameOf(row.persona)} />
                  <ScreenCell>{row.startedBy}</ScreenCell>
                  <ScreenCell>
                    <PanelChip tone={STATE_TONE[row.state]}>{row.state}</PanelChip>
                  </ScreenCell>
                  <ScreenCell num>{row.started}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {/if}
        </div>
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * One column, three bands: who the agents are, then what they are doing. The
   * task table gets the depth because it is the band that changes minute to
   * minute; the persona grid above it is a roster and settles.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "personas"
      "tasks";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-personas {
    grid-area: personas;
  }
  .area-tasks {
    grid-area: tasks;
  }
</style>
