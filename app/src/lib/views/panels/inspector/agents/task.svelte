<script lang="ts">
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelMeter,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import Ban from "@lucide/svelte/icons/ban";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    personasIn,
    resultsOf,
    task as taskDoor,
    type PersonaRow,
    type TaskRow
  } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * One agentic task, from wherever it was picked: a table row, a persona's list,
   * an Automation's run history.
   *
   * **A lens, not the manager.** Everything needed to decide *whether to go and
   * look* is here — what it was asked, how far it got, what it produced — and
   * the step that follows is a button rather than a scroll. The prompt is clamped
   * because a lens that held 300 characters of prose would push the decision off
   * the bottom of a 320px panel.
   */
  let { taskId }: { taskId?: string } = $props();

  const id = $derived(taskId ?? view.selection?.id ?? "t-feeder12");

  const it = $derived(taskDoor(id).current);
  const results = $derived(resultsOf(id).current);
  const personas = $derived(personasIn(view.project).current);

  const persona = $derived(personas.find((row: PersonaRow) => row.id === it.persona));

  const TONE: Record<TaskRow["state"], "neutral" | "success" | "danger" | "attention"> = {
    running: "attention",
    waiting: "neutral",
    completed: "success",
    failed: "danger"
  };

  const running = $derived(it.state === "running" || it.state === "waiting");
</script>

<Panel title={it.title}>
  {#snippet actions()}
    <PanelButton
      label="Open"
      icon={Maximize2}
      tone="primary"
      onclick={() => view.showSubscreen("task", it.id)}
    />
    {#if running}
      <!--
        Disabled, and the reason is a dispatch rather than a missing button:
        stopping a task means reaching the agent that is running it, and no
        capability reaches an agent.
      -->
      <PanelButton
        label="Stop"
        icon={Ban}
        disabled
        title="No capability reaches a running agent."
      />
    {:else}
      <PanelButton
        label="Run again"
        icon={RotateCcw}
        disabled
        title="No capability dispatches a task."
      />
    {/if}
  {/snippet}

  <PanelFields>
    <PanelField label="State"><PanelChip tone={TONE[it.state]}>{it.state}</PanelChip></PanelField>
    <PanelField label="Started by">{it.startedBy}</PanelField>
    <PanelField label="Started">{it.started}</PanelField>
    {#if it.firedBy}
      <PanelField label="Fired by"><PanelChip tone="accent-1">Automation</PanelChip></PanelField>
    {/if}
  </PanelFields>

  <PanelSection title="Asked">
    <p class="text-body-sm text-ink-primary m-0 line-clamp-4">{it.prompt}</p>
  </PanelSection>

  <PanelSection title="Progress">
    <PanelMeter
      label="How far along"
      detail={it.step}
      value={Math.round(it.progress * 100)}
      tone={it.state === "failed" ? "danger" : running ? "attention" : "success"}
    />
  </PanelSection>

  {#if persona}
    <PanelSection title="Run by" flush>
      <PanelRow
        title={persona.name}
        sub={persona.describes}
        onselect={() =>
          view.inspect("agents.persona", { kind: "persona", id: String(persona.id) })}
      />
    </PanelSection>
  {/if}

  <PanelSection title="Produced" count={results.length} flush>
    {#each results as result (result.id)}
      <PanelRow
        title={result.title}
        sub={result.detail}
        meta={result.resource}
        onselect={() =>
          view.inspect("agents.task-results", { kind: "result", id: result.id })}
      />
    {:else}
      <PanelNote>Nothing yet.</PanelNote>
    {/each}
  </PanelSection>

  <PanelActions>
    <PanelNote tone="gap">
      Steering a task means reaching the agent running it, and nothing here
      reaches an agent — so what a task did is readable and what it does next is
      not yet decidable from this panel.
    </PanelNote>
  </PanelActions>
</Panel>
