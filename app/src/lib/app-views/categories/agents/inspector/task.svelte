<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Square from "@lucide/svelte/icons/square";
  import Wrench from "@lucide/svelte/icons/wrench";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelChip,
    PanelEmpty,
    PanelLink,
    PanelMeter,
    PanelQuote,
    PanelRow,
    PanelSection,
    PanelSkeleton,
    PanelSteps
  } from "$authored-components/panel";
  import Target from "@lucide/svelte/icons/target";

  import { agentsLibrary, messageOf, taskDetail } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { isSelected, openTask } from "$app-views/categories/agents/procedures/navigate";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import {
    STATE_LABEL,
    STATE_TONE,
    typeLabelOf
  } from "$app-views/categories/agents/procedures/tasks";
  import { updateTask } from "$app-views/categories/agents/procedures/update-task";
  import { scopeRows } from "$app-views/categories/agents/procedures/scope";
  import { elapsed, relativeTime } from "$app-views/categories/agents/procedures/time";
  import { isOpen, toolOf } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const taskId = $derived(view.selection?.kind === "task" ? view.selection.id : undefined);
  const detail = $derived(taskDetail(taskId));

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);
  const clock = startClock(15_000);

  const task = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );
  const STEP_STATE = { pending: "waiting", active: "running", done: "done" } as const;
  const steps = $derived(
    (task?.plan ?? []).map((step) => ({
      id: step.id,
      label: step.title,
      detail: step.note,
      state: STEP_STATE[step.state]
    }))
  );
  const open = $derived((task?.questions ?? []).filter(isOpen));
  const library = agentsLibrary();
  const answer = $derived(library.ready ? library.current : undefined);
  const persona = $derived(answer?.personas.find((row) => row.id === task?.personaId));
  const reach = $derived(
    scopeRows(
      task?.scope ?? persona?.scope ?? null,
      answer?.resourceSets ?? [],
      answer?.resources ?? []
    )
  );

  const finish = () => {
    if (task === undefined) return;
    const held = task;
    void run(surface, "finish", () => updateTask(view, held, { state: "finished" }));
  };
</script>

{#if detail === undefined}
  <Panel title="Task">
    <PanelEmpty title="Select a task to inspect it." />
  </Panel>
{:else if detail.error}
  <Panel title="Task">
    <PanelBanner title="Task unavailable" tone="danger">{messageOf(detail.error)}</PanelBanner>
  </Panel>
{:else if !detail.ready}
  <Panel title="Task">
    <PanelSkeleton shape="fields" count={6} />
  </Panel>
{:else if task === undefined}
  <Panel title="Task">
    <PanelEmpty title="That task is not in this project." />
  </Panel>
{:else}
  <Panel title={task.title}>
    {#snippet actions()}
      <PanelButton label="Open" icon={FolderOpen} tone="primary" onclick={() => openTask(view, task.id)} />
      {#if task.state === "running"}
        <PanelButton label="Stop" icon={Square} disabled={surface.busy !== undefined} onclick={finish} />
      {:else if task.state === "review"}
        <PanelButton label="Mark reviewed" icon={CircleCheck} disabled={surface.busy !== undefined} onclick={finish} />
      {/if}
    {/snippet}

    {#if surface.failure}
      <PanelBanner title="That did not save" tone="attention">{surface.failure}</PanelBanner>
    {/if}

    <div class="facts">
      <div class="chips">
        <PanelChip tone={STATE_TONE[task.state]}>{STATE_LABEL[task.state]}</PanelChip>
        <PanelChip tone="neutral">{typeLabelOf(task)}</PanelChip>
        {#if open.length > 0}
          <PanelChip tone="attention">{open.length} to answer</PanelChip>
        {/if}
      </div>
      <p class="line">
        <PanelLink
          label={task.personaName}
          onselect={() => inspectAgent(view, { kind: "persona", id: task.personaId })}
        />
        <span class="muted">· {relativeTime(task.startedAt, clock.now)}</span>
      </p>
    </div>

    <div class="pt-3">
      <PanelQuote sourceLabel="Sent verbatim to" source={task.personaName}>
        <span class="line-clamp-4 block">{task.instruction}</span>
      </PanelQuote>
    </div>

    <div class="pt-2">
      <PanelSection title="Plan" count={elapsed(task.startedAt, task.finishedAt ?? clock.now)}>
        {#if task.plan.length === 0}
          <PanelEmpty title={task.state === "running" ? "No plan yet. The runner writes it when it picks the task up." : "No plan on record."} flush />
        {:else}
          <PanelMeter
            label="Of the plan done"
            detail={task.progress.current ?? "All steps done"}
            value={task.progress.percent ?? 0}
            tone={task.progress.percent === 100 ? "success" : "neutral"}
            flush
          />
          <PanelSteps label="Steps" {steps} flush />
        {/if}
      </PanelSection>

      <PanelSection title="Questions" count={open.length === 0 ? task.questions.length : `${open.length} open`} flush open={open.length > 0}>
        {#each task.questions as question (question.id)}
          <PanelRow
            title={question.text}
            sub={isOpen(question)
              ? `Asked ${relativeTime(question.askedAt, clock.now)} · waiting on you`
              : question.rejectedAt !== undefined
                ? "Handed back to the agent"
                : `Answered: ${question.answer}`}
            tone={isOpen(question) ? "attention" : "default"}
          />
        {:else}
          <PanelEmpty title="Nothing asked." flush />
        {/each}
      </PanelSection>

      <PanelSection title="Outputs" count={task.outputs.length} open={false}>
        {#each task.outputs as output (output.id)}
          <PanelRow title={output.title} sub={output.detail} meta={output.refName ?? undefined} />
        {:else}
          <PanelEmpty title={task.state === "running" ? "Outputs appear as they are produced." : "Nothing came out."} flush />
        {/each}
      </PanelSection>

      <PanelSection title="Scope" count={reach.length} flush open={false}>
        {#each reach as row (row.key)}
          <PanelRow title={row.title} sub={row.detail} icon={Target} tone="intelligence" />
        {:else}
          <PanelEmpty title="Nothing chosen; it reads nothing." flush />
        {/each}
      </PanelSection>

      <PanelSection title="Tools" count={task.tools.length} flush open={false}>
        {#each task.tools as toolId (toolId)}
          {@const tool = toolOf(toolId)}
          <PanelRow
            title={tool?.name ?? toolId}
            sub={tool?.does}
            icon={Wrench}
            selected={isSelected(view, "tool", toolId) && view.selection?.at === task.id}
            onselect={() => inspectAgent(view, { kind: "tool", id: toolId, at: task.id })}
          />
        {:else}
          <PanelEmpty title="No tool allowed." flush />
        {/each}
      </PanelSection>
    </div>
  </Panel>
{/if}

<style>
  .facts {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin: 0;
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .muted {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }
</style>
