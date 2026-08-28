<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Clock from "@lucide/svelte/icons/clock";
  import Loader from "@lucide/svelte/icons/loader";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { tasks, type TaskRow } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * Tasks — agent work in this project, grouped by state.
   *
   * `docs/screen-panel-views/context/project/tasks.md` is the specification. The
   * same rows the Copilot shows, at project scope, and every one of them opens the
   * Copilot's task lens.
   *
   * **The order is by what needs you first, not by time.** Waiting leads because
   * it has stopped and cannot move without a person; recently completed arrives
   * shut because it needs nobody.
   *
   * **A waiting row carries no Reply and no Resume.** The task model does not
   * record why a task is blocked or who can unblock it, and a control that cannot
   * say which of those it does is a control that guesses.
   */
  let { onopen }: { onopen?: () => void } = $props();

  const view = viewState();

  const work = $derived(tasks().current);

  const ICON = {
    waiting: Clock,
    running: Loader,
    failed: CircleAlert,
    completed: CircleCheck
  };

  const TONE = {
    waiting: "attention",
    running: "active",
    failed: "danger",
    completed: "success"
  } as const;

  const inState = (state: TaskRow["state"]) => work.filter((task) => task.state === state);
</script>

{#snippet band(state: TaskRow["state"], title: string, empty: string, open: boolean)}
  <PanelSection {title} count={inState(state).length} {open} flush>
    {#each inState(state) as task (task.id)}
      <PanelRow
        title={task.title}
        sub="{task.agent} · {task.detail}"
        meta={task.age}
        icon={ICON[state]}
        tone={TONE[state]}
        onselect={() => view.inspect("copilot.task", { kind: "task", id: task.id })}
      />
    {/each}

    {#if inState(state).length === 0}
      <PanelNote>{empty}</PanelNote>
    {/if}
  </PanelSection>
{/snippet}

<Panel title="Tasks">
  {#snippet actions()}
    <PanelButton
      label="Manage Personas"
      icon={ArrowRight}
      disabled={onopen === undefined}
      title="The Personas that do this work, on the Agents screen"
      onclick={onopen}
    />
  {/snippet}

  {@render band("waiting", "Waiting", "Nothing is waiting on you.", true)}
  {@render band("running", "Running", "Nothing is running.", true)}
  {@render band("failed", "Failed", "Nothing has failed.", true)}
  {@render band("completed", "Recently completed", "Nothing finished recently.", false)}
</Panel>
