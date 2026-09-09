<script lang="ts">
  import { PanelActor, PanelChip } from "$authored-components/panel";
  import { ScreenCell, ScreenEmpty, ScreenRow, ScreenTable } from "$authored-components/screen";
  import { agentsLibrary } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { isSelected, openTask } from "$app-views/categories/agents/procedures/navigate";
  import { filterRows, sortRows, type SortKey } from "$app-views/categories/agents/procedures/sorting";
  import {
    STATE_LABEL,
    STATE_TONE,
    taskRowsIn,
    type OriginKind,
    type TaskRow
  } from "$app-views/categories/agents/procedures/tasks";
  import type { AgentTaskState } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    persona = "any",
    automation,
    query = "",
    kind = "any",
    taskState = "any",
    sort = "started",
    direction = "asc",
    scroll = false,
    withPersona = true,
    onclear
  }: {
    persona?: string;
    automation?: string;
    query?: string;
    kind?: string;
    taskState?: string;
    sort?: string;
    direction?: string;
    scroll?: boolean;
    withPersona?: boolean;
    onclear?: () => void;
  } = $props();

  const view = workspaceState();
  const library = agentsLibrary();

  const clock = startClock();

  const all = $derived(taskRowsIn(library.ready ? library.current : undefined, clock.now));
  const inScope = $derived(
    all.filter(
      (row) =>
        automation === undefined ||
        (row.origin.kind === "automation" && row.origin.automationId === automation)
    )
  );
  const filtered = $derived(
    filterRows(inScope, {
      persona,
      query,
      kind: kind as OriginKind | "any",
      state: taskState as AgentTaskState | "any"
    })
  );
  const rows = $derived(sortRows(filtered, sort as SortKey, direction === "desc" ? "desc" : "asc"));
  const narrowed = $derived(query.trim() !== "" || kind !== "any" || taskState !== "any");

  const COLUMNS = $derived(
    withPersona
      ? ["Task", "Persona", "State", "Progress", "Started", "Started by"]
      : ["Task", "State", "Progress", "Started", "Started by"]
  );

  const progress = (row: TaskRow): string => {
    if (row.progress.total === 0) return row.state === "running" ? "No plan yet" : "—";
    return row.progress.percent === null ? "—" : `${row.progress.percent}%`;
  };
</script>

{#if !library.ready}
  <ScreenEmpty title="Loading tasks">Reading the project's tasks.</ScreenEmpty>
{:else if rows.length === 0}
  <ScreenEmpty
    kind={narrowed ? "no-matches" : "nothing-yet"}
    title={narrowed ? "No task matches" : "Nothing handed to it yet"}
    onclear={narrowed ? onclear : undefined}
  >
    {narrowed
      ? "Nothing fits the type, state and search at once."
      : automation !== undefined
        ? "Each fire makes one task, and the task carries the outputs."
        : "Tasks appear here when someone creates one or an automation fires."}
  </ScreenEmpty>
{:else}
  <ScreenTable {scroll} columns={COLUMNS}>
    {#each rows as row (row.id)}
      <ScreenRow
        selected={isSelected(view, "task", row.id)}
        onselect={() => inspectAgent(view, { kind: "task", id: row.id })}
        onopen={() => openTask(view, row.id)}
      >
        <ScreenCell>
          <button
            type="button"
            class="text-body-sm text-ink-primary min-h-9 text-start hover:underline"
            onclick={() => inspectAgent(view, { kind: "task", id: row.id })}
            ondblclick={() => openTask(view, row.id)}
          >
            {row.title}
            {#if row.openQuestions > 0}
              <span class="text-caption text-attention-text ms-1">
                · {row.openQuestions} {row.openQuestions === 1 ? "question" : "questions"}
              </span>
            {/if}
          </button>
        </ScreenCell>
        {#if withPersona}
          <ScreenCell>
            <button
              type="button"
              class="flex min-h-9 items-center hover:underline"
              title="Inspect {row.personaName}"
              onclick={() => inspectAgent(view, { kind: "persona", id: row.personaId })}
            >
              <PanelActor name={row.personaName} kind="agent" size="row" />
            </button>
          </ScreenCell>
        {/if}
        <ScreenCell>
          <PanelChip tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</PanelChip>
        </ScreenCell>
        <ScreenCell num>{progress(row)}</ScreenCell>
        <ScreenCell num>{row.started}</ScreenCell>
        <ScreenCell>{row.startedByName}</ScreenCell>
      </ScreenRow>
    {/each}
  </ScreenTable>
{/if}
