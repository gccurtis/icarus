<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Plus from "@lucide/svelte/icons/plus";
  import Zap from "@lucide/svelte/icons/zap";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelStat,
    PanelStats
  } from "$authored-components/panel";
  import {
    automationsIn,
    personasIn,
    tasksIn,
    type AutomationRow,
    type PersonaRow,
    type TaskRow
  } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Agents overview — what is running right now, and what is standing by.
   *
   * The orientation panel for a screen whose subject changes under you: a task
   * finishes while you are reading a persona. So the figures are the state of the
   * whole screen rather than of whatever centre happens to be showing, and they
   * stay put while you move between the four.
   *
   * **Running comes first and failed comes second.** A finished task is a result
   * you go and read; a failed one is a thing to decide about, and the panel that
   * orients you should say so before it says how much has gone well.
   */
  const personas = $derived(personasIn(view.project).current);
  const tasks = $derived(tasksIn(view.project).current);
  const rules = $derived(automationsIn(view.project).current);

  const running = $derived(
    tasks.filter((row: TaskRow) => row.state === "running" || row.state === "waiting")
  );
  const failed = $derived(tasks.filter((row: TaskRow) => row.state === "failed"));
  const on = $derived(rules.filter((rule: AutomationRow) => rule.enabled));

  const nameOf = (id: string): string =>
    personas.find((row: PersonaRow) => row.id === id)?.name ?? id;
</script>

<Panel title="Agents">
  {#snippet actions()}
    <PanelButton
      label="Persona"
      icon={Plus}
      tone="primary"
      onclick={() => view.showSubscreen("persona", "new")}
    />
    <PanelButton
      label="Automation"
      icon={Zap}
      onclick={() => view.showSubscreen("automation", "new")}
    />
  {/snippet}

  <PanelStats label="Right now">
    <PanelStat value={String(running.length)} label="Running" tone="attention" />
    <PanelStat
      value={String(failed.length)}
      label="Failed"
      tone={failed.length > 0 ? "danger" : "default"}
    />
    <PanelStat value={String(personas.length)} label="Personas" />
  </PanelStats>

  <PanelSection title="Running" count={running.length} open flush>
    {#each running as row (row.id)}
      <PanelRow
        title={row.title}
        sub="{nameOf(row.persona)} · {row.started}"
        icon={Bot}
        tone="active"
        onselect={() => view.showSubscreen("task", row.id)}
      />
    {:else}
      <PanelNote>Nothing is running.</PanelNote>
    {/each}
  </PanelSection>

  {#if failed.length > 0}
    <PanelSection title="Failed" count={failed.length} open flush>
      {#each failed as row (row.id)}
        <PanelRow
          title={row.title}
          sub={nameOf(row.persona)}
          icon={Bot}
          tone="danger"
          titleTone="danger"
          onselect={() => view.showSubscreen("task", row.id)}
        />
      {/each}
    </PanelSection>
  {/if}

  <PanelSection title="Automations on" count={on.length} open={false} flush>
    {#each on as rule (rule.id)}
      <PanelRow
        title={rule.name}
        sub={rule.when}
        icon={Zap}
        onselect={() => view.showSubscreen("automation", rule.id)}
      />
    {:else}
      <PanelNote>Every rule is off.</PanelNote>
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    An Automation is a task with a trigger. Its runs are tasks, and the task is
    what carries the results.
  </PanelNote>
</Panel>
