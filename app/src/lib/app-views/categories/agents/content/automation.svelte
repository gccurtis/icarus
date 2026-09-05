<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Clock from "@lucide/svelte/icons/clock";
  import Play from "@lucide/svelte/icons/play";

  import { PanelActor, PanelChip } from "$authored-components/panel";
  import {
    ScreenBar,
    ScreenCell,
    ScreenEmpty,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenRow,
    ScreenStat,
    ScreenStats,
    ScreenSurface,
    ScreenTable
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { Switch } from "$vendored-components/switch";
  import {
    actionsFor,
    automation as automationDoor,
    personasIn,
    tasksIn,
    triggersFor,
    type ActionOption,
    type PersonaRow,
    type TaskRow,
    type TriggerOption
  } from "$app-views/categories/agents/procedures/agents";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  /**
   * One Automation: the trigger, what it does, and what it has produced.
   *
   * **An Automation is a task with a trigger**, which is why this centre is a
   * sibling of the task manager rather than a category of its own kind. Everything
   * below the details band is tasks — the ones this rule dispatched.
   *
   * **Behaviour left, trigger right.** What it does is the part someone writes
   * and rewrites; when it happens is the part they set once and check. The
   * setting goes on the side the eye returns to less often.
   *
   * **On and off is on the bar, not buried in the trigger.** It is the one
   * control anybody reaches for in a hurry, and a rule that is off says so where
   * its name is.
   */
  const id = $derived(view.active.focus ?? "nightly-digest");

  const it = $derived(automationDoor(id).current);
  const triggers = $derived(triggersFor(id).current);
  const actions = $derived(actionsFor(id).current);
  const personas = $derived(personasIn(view.project).current);

  /** Every task this rule fired. The run history the rule itself does not keep. */
  const runs = $derived(
    tasksIn(view.project).current.filter((row: TaskRow) => row.firedBy === it.id)
  );

  const trigger = $derived(
    triggers.find((option: TriggerOption) => option.chosen) ?? triggers[0]
  );
  const action = $derived(actions.find((option: ActionOption) => option.chosen) ?? actions[0]);

  const persona = $derived(
    action.kind === "ask-agent"
      ? personas.find((row: PersonaRow) => row.id === action.agent)
      : undefined
  );

  const STATE_TONE: Record<TaskRow["state"], "neutral" | "success" | "danger" | "attention"> = {
    running: "attention",
    waiting: "neutral",
    completed: "success",
    failed: "danger"
  };

  /** Local until something can write it back. A switch that did nothing would lie. */
  let enabled = $state<boolean | undefined>(undefined);
  const on = $derived(enabled ?? it.enabled);

  const succeeded = $derived(runs.filter((row: TaskRow) => row.state === "completed").length);
  const failed = $derived(runs.filter((row: TaskRow) => row.state === "failed").length);
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-bar">
      <ScreenBar
        title={it.name}
        backLabel="All agents"
        onback={() => view.showContent("agents.library")}
      >
        {#snippet meta()}
          <PanelChip tone={on ? "active" : "neutral"}>{on ? "On" : "Off"}</PanelChip>
          <PanelChip>Revision {it.revision}</PanelChip>
        {/snippet}
        {#snippet actions()}
          <label class="text-caption text-ink-secondary flex items-center gap-2">
            <Switch checked={on} onCheckedChange={(next) => (enabled = next)} />
            Enabled
          </label>
          <Button variant="outline" size="sm" onclick={() => view.showContent("agents.library")}>
            <Play size={14} aria-hidden="true" />
            Run now
          </Button>
        {/snippet}
      </ScreenBar>
    </div>

    <!--
      The rule as one sentence, in the two clauses the model stores it as. Read
      before any of the configuration below it, because the configuration is only
      legible once you know which sentence it is building.
    -->
    <div class="area-overview flex flex-col gap-3">
      <p class="text-body text-ink-primary m-0 leading-relaxed">
        <span class="text-ink-muted">When</span>
        {it.sentence.triggerClause},
        <span class="text-ink-muted">then</span>
        {it.sentence.actionClause}.
      </p>

      <div class="flex flex-wrap items-center gap-4">
        {#if persona}
          <button
            type="button"
            class="hover:bg-surface-panel-hover rounded-control -m-1 flex items-center gap-2 p-1"
            onclick={() => view.showContent("agents.persona", persona.id)}
          >
            <PanelActor name={persona.name} kind="agent" size="row" />
            <span class="text-caption text-ink-secondary">{persona.name}</span>
          </button>
        {/if}
        <span class="text-caption text-ink-muted flex items-center gap-1.5">
          <Clock size={14} aria-hidden="true" />
          Last fired {it.lastFire.when} · {it.lastFire.result.toLowerCase()}
        </span>
        <span class="text-caption text-ink-muted">Built by {it.createdBy}</span>
      </div>

      <ScreenStats label="Its record">
        <ScreenStat value="~{it.lastFire.firedAbout}" label="Times fired" />
        <ScreenStat value={String(succeeded)} label="Completed" tone="success" />
        <ScreenStat value={String(failed)} label="Failed" tone={failed > 0 ? "danger" : "default"} />
      </ScreenStats>

      {#if it.lastFire.why}
        <ScreenNote tone="gap">{it.lastFire.why}</ScreenNote>
      {/if}
    </div>

    <div class="area-behaviour min-w-0">
      <ScreenGroup label="What it does">
        <ScreenList label="Actions">
          {#each actions as option (option.kind)}
            <ScreenItem
              title={option.name}
              excerpt={option.kind === "ask-agent" && option.chosen && option.prompt
                ? option.prompt
                : option.blurb}
              meta={option.chosen ? "chosen" : undefined}
              selected={option.chosen}
              onselect={() =>
                view.inspect("agents.agent-action", { kind: "action", id: option.kind })}
            >
              {#snippet lead()}<Bot size={16} aria-hidden="true" />{/snippet}
            </ScreenItem>
          {/each}
        </ScreenList>
      </ScreenGroup>
    </div>

    <div class="area-trigger min-w-0">
      <ScreenGroup label="When it happens" tone="intelligence">
        <ScreenList label="Triggers">
          {#each triggers as option (option.kind)}
            <ScreenItem
              title={option.name}
              excerpt={option.blurb}
              meta={option.chosen ? "chosen" : undefined}
              selected={option.chosen}
              onselect={() =>
                view.inspect("agents.trigger", { kind: "trigger", id: option.kind })}
            >
              {#snippet lead()}<Clock size={16} aria-hidden="true" />{/snippet}
            </ScreenItem>
          {/each}
        </ScreenList>
      </ScreenGroup>
    </div>

    <div class="area-runs min-w-0">
      <ScreenGroup label="Previous runs" count={String(runs.length)}>
        {#if runs.length === 0}
          <ScreenEmpty title="It has fired, but no run is still on record">
            The rule keeps only its last fire. A run becomes a task, and a task is
            what carries the results.
          </ScreenEmpty>
        {:else}
          <ScreenTable columns={["Run", "Persona", "Started", "Results", "State"]}>
            {#each runs as row (row.id)}
              <ScreenRow>
                <ScreenCell
                  name={row.title}
                  onselect={() => view.showContent("agents.task", row.id)}
                />
                <ScreenCell>
                  {personas.find((p: PersonaRow) => p.id === row.persona)?.name ?? row.persona}
                </ScreenCell>
                <ScreenCell num>{row.started}</ScreenCell>
                <ScreenCell num>{row.results}</ScreenCell>
                <ScreenCell>
                  <PanelChip tone={STATE_TONE[row.state]}>{row.state}</PanelChip>
                </ScreenCell>
              </ScreenRow>
            {/each}
          </ScreenTable>
        {/if}
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's two halves, and the trigger is the right one. Behaviour
   * is prose someone rewrites; a trigger is a setting they check.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 3fr 2fr;
    grid-template-areas:
      "bar       bar"
      "overview  overview"
      "behaviour trigger"
      "runs      runs";
    align-content: start;
  }

  .area-bar {
    grid-area: bar;
  }
  .area-overview {
    grid-area: overview;
    max-width: 70ch;
  }
  .area-behaviour {
    grid-area: behaviour;
  }
  .area-trigger {
    grid-area: trigger;
  }
  .area-runs {
    grid-area: runs;
  }

  @media (max-width: 64rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "bar"
        "overview"
        "trigger"
        "behaviour"
        "runs";
    }
  }
</style>
