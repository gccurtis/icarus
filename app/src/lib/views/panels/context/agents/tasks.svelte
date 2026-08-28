<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Zap from "@lucide/svelte/icons/zap";

  import {
    Panel,
    PanelRow,
    PanelSearch,
    PanelSection,
    PanelSelect
  } from "$components/authored/panel";
  import {
    personasIn,
    taskGroup,
    tasksIn,
    type PersonaRow,
    type TaskRow
  } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Every task in this project, grouped by whether it needs you.
   *
   * The map for the Agents screen: what the workspace's table holds, in the
   * narrow column, so you can move between tasks without going back to the
   * library. Selecting one opens it in the centre — a task is a place you work
   * rather than a thing you glance at, so the panel navigates rather than
   * inspects.
   *
   * **Three groups, and *failed* is its own.** Rolling failures in with finished
   * work is how a run that produced nothing gets counted as one that did.
   */
  const tasks = $derived(tasksIn(view.project).current);
  const personas = $derived(personasIn(view.project).current);

  let search = $state("");
  let persona = $state("all");

  const nameOf = (id: string): string =>
    personas.find((row: PersonaRow) => row.id === id)?.name ?? id;

  const options = $derived([
    { value: "all", label: "Any persona" },
    ...personas.map((row: PersonaRow) => ({ value: String(row.id), label: row.name }))
  ]);

  const shown = $derived(
    tasks
      .filter((row: TaskRow) =>
        row.title.toLowerCase().includes(search.trim().toLowerCase())
      )
      .filter((row: TaskRow) => persona === "all" || row.persona === persona)
  );

  const inGroup = (group: "running" | "failed" | "done"): readonly TaskRow[] =>
    shown.filter((row: TaskRow) => taskGroup(row) === group);

  const open = (row: TaskRow) => view.showSubscreen("task", row.id);
</script>

<Panel title="Tasks">
  <PanelSearch
    placeholder="Search tasks"
    matched={shown.length}
    total={tasks.length}
    empty="No task matches."
    bind:value={search}
    flush
  >
    <div class="px-3">
      <PanelSelect
        label="Persona"
        value={persona}
        {options}
        onchange={(next: string) => (persona = next)}
      />
    </div>

    <PanelSection title="Running" count={inGroup("running").length} open flush>
      {#each inGroup("running") as row (row.id)}
        <PanelRow
          title={row.title}
          sub="{nameOf(row.persona)} · {row.started}"
          icon={row.firedBy ? Zap : Bot}
          tone="active"
          selected={view.active.focus === row.id}
          onselect={() => open(row)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Failed" count={inGroup("failed").length} open flush>
      {#each inGroup("failed") as row (row.id)}
        <PanelRow
          title={row.title}
          sub={nameOf(row.persona)}
          icon={row.firedBy ? Zap : Bot}
          tone="danger"
          titleTone="danger"
          selected={view.active.focus === row.id}
          onselect={() => open(row)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Done" count={inGroup("done").length} open={false} flush>
      {#each inGroup("done") as row (row.id)}
        <PanelRow
          title={row.title}
          sub="{nameOf(row.persona)} · {row.results} results"
          icon={row.firedBy ? Zap : Bot}
          selected={view.active.focus === row.id}
          onselect={() => open(row)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
