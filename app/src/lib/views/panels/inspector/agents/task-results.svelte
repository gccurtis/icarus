<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";

  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import {
    resultsOf,
    task as taskDoor,
    tasksIn,
    type TaskResult,
    type TaskRow
  } from "$capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * One thing a task produced, and what else came out of the same run.
   *
   * **A result names where it landed, or says it landed nowhere.** That is the
   * whole difference between a finding an agent wrote into a resource and one it
   * only reported — and it is the first thing anyone checking the work needs to
   * know, so it is a field rather than a sentence in the detail.
   *
   * The siblings are listed because results are read against each other: three
   * lines saying the same thing three ways is a different situation from three
   * lines saying three things.
   */
  let { resultId }: { resultId?: string } = $props();

  const id = $derived(resultId ?? view.selection?.id);

  /** Which task holds it. A result id is unique across tasks, so this resolves. */
  const owner = $derived(
    tasksIn(view.project).current.find((row: TaskRow) =>
      resultsOf(row.id).current.some((entry: TaskResult) => entry.id === id)
    )
  );

  const it = $derived(owner ? taskDoor(owner.id).current : undefined);
  const siblings = $derived(owner ? resultsOf(owner.id).current : []);
  const result = $derived(siblings.find((entry: TaskResult) => entry.id === id));
</script>

{#if result && it}
  <Panel title={result.title}>
    {#snippet crumbs()}
      <PanelCrumbs
        trail={[{ label: it.title, key: "agents.task" }, { label: "Results" }]}
        onnavigate={(key: string) => {
          if (isInspectionKey(key)) view.inspect(key, { kind: "task", id: it.id });
        }}
      />
    {/snippet}

    {#snippet actions()}
      <!--
        Disabled, and the reason is that a result has no accepted state to write.
        A finding does; a task's result is a line in a report until someone
        decides where it lands, and that decision is not modelled.
      -->
      <PanelButton
        label="Keep"
        icon={ThumbsUp}
        tone="primary"
        disabled
        title="A result has no accepted state in the model."
      />
      <PanelButton
        label="Reject"
        icon={ThumbsDown}
        disabled
        title="A result has no rejected state in the model."
      />
    {/snippet}

    <PanelSection title="What it found">
      <p class="text-body-sm text-ink-primary m-0">{result.detail}</p>
    </PanelSection>

    <PanelFields>
      <PanelField label="Landed in">{result.resource ?? "Nowhere — reported only"}</PanelField>
      <PanelField label="From">{it.title}</PanelField>
    </PanelFields>

    {#if result.resource}
      <PanelSection title="Where" flush>
        <PanelRow
          title={result.resource}
          icon={ExternalLink}
          onselect={() =>
            view.inspect("project.resource", { kind: "resource", id: result.resource ?? "" })}
        />
      </PanelSection>
    {/if}

    <PanelSection title="From the same run" count={siblings.length - 1} flush>
      {#each siblings.filter((entry: TaskResult) => entry.id !== result.id) as entry (entry.id)}
        <PanelRow
          title={entry.title}
          sub={entry.detail}
          onselect={() =>
            view.inspect("agents.task-results", { kind: "result", id: entry.id })}
        />
      {:else}
        <PanelNote>This was the only one.</PanelNote>
      {/each}
    </PanelSection>

    <PanelNote tone="gap">
      A finding has an accepted state; a task's result does not. Until where a
      kept result lands is decided, keeping one is a word without a destination.
    </PanelNote>
  </Panel>
{:else}
  <Panel title="Result">
    <PanelNote>That result is no longer on any task.</PanelNote>
  </Panel>
{/if}
