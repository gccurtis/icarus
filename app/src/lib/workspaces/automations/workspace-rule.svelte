<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Clock from "@lucide/svelte/icons/clock";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FolderSync from "@lucide/svelte/icons/folder-sync";
  import Hand from "@lucide/svelte/icons/hand";
  import Play from "@lucide/svelte/icons/play";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    PanelActor,
    PanelChip,
    PanelField,
    PanelFields,
    PanelLink,
    PanelQuote,
    PanelSentence
  } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCard,
    ScreenGroup,
    ScreenNote,
    ScreenSurface
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import { Switch } from "$lib/simple-components/switch";
  import {
    actionsFor,
    automation,
    triggersFor,
    type ActionOption,
    type GeneratedBlock,
    type TriggerOption
  } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Automations — one rule, entered from Open.
   *
   * `docs/screen-panel-views/screens/automations/workspace-rule.md` is the
   * specification. A rule is a sentence with two blanks in it: the screen states
   * the sentence across the full width, then gives one column per blank.
   *
   * **The tracks are 1fr and 1fr**, because the two halves are equals — one
   * trigger and one action, neither subordinate to the other. Giving either more
   * width would say the rule was mostly about that half. *Last fired* sits in the
   * second column under the action, because the action is what fired.
   *
   * **The sentence's halves are coloured to the cards under them** — accent-2 for
   * the trigger, intelligence for the agent's half — so reading the rule never
   * requires reading the two columns. The chosen card in each column carries the
   * same role on its chip, which is what makes the colouring a map rather than a
   * decoration.
   *
   * **Choosing is local and the detail follows the choice.** Only the stored half
   * carries its detail — a rule that is not on a schedule has no schedule to show
   * — so picking another card says so plainly rather than inventing one.
   */
  let {
    automationId = "nightly-digest",
    onback = () => {}
  }: {
    automationId?: string;
    onback?: () => void;
  } = $props();

  const rule = $derived(automation(automationId).current);
  const triggers = $derived(triggersFor(automationId).current);
  const actions = $derived(actionsFor(automationId).current);
  const fire = $derived(rule.lastFire);

  /** The switch, over what the door stored. It is the one control that changes
   * whether the rule exists in practice, which is why it is in the header. */
  let switched = $state<boolean | undefined>(undefined);
  const on = $derived(switched ?? rule.enabled);

  let pickedTrigger = $state<string | undefined>(undefined);
  let pickedAction = $state<string | undefined>(undefined);

  const storedTrigger = $derived(triggers.find((option) => option.chosen) ?? triggers[0]);
  const storedAction = $derived(actions.find((option) => option.chosen) ?? actions[0]);

  const trigger = $derived(
    triggers.find((option: TriggerOption) => option.kind === pickedTrigger) ?? storedTrigger
  );
  const action = $derived(
    actions.find((option: ActionOption) => option.kind === pickedAction) ?? storedAction
  );

  const TRIGGER_ICON = {
    schedule: Clock,
    "resource-change": FilePen,
    "connector-sync": FolderSync,
    "finding-accepted": CircleCheck,
    manual: Hand
  };

  const ACTION_ICON = { "ask-agent": Bot, "refresh-block": RefreshCw };

  const RESULT_TONE = {
    Started: "success",
    "Couldn't start": "danger",
    Never: "neutral"
  } as const;
</script>

<ScreenSurface wide>
  <div class="board">
    <!--
      The way back, the name, and the switch. `Saved` is a chip beside the name
      rather than a control: there is nothing to press, it is a state.
    -->
    <div class="area-screen-header">
      <ScreenBar title={rule.name} {onback} backLabel="Back to list">
        {#snippet meta()}
          <PanelChip>Saved</PanelChip>
        {/snippet}
        {#snippet actions()}
          <Switch
            checked={on}
            onCheckedChange={(next: boolean) => (switched = next)}
            aria-label={`${rule.name} — on`}
          />
          <span class="text-caption text-ink-secondary">{on ? "On" : "Off"}</span>
          <Button variant="outline" size="xs" title="Fire it now, with what is saved">
            <Play aria-hidden="true" />
            Run now
          </Button>
        {/snippet}
      </ScreenBar>
    </div>

    <div class="area-the-sentence flex flex-col gap-1">
      <!--
        The same renderer the list and the lens use, at heading size. The role
        colours go inside the clauses, so the map onto the columns survives
        without the sentence being set a second way.
      -->
      <div class="max-w-prose">
        <PanelSentence size="head" join="">
          {#snippet when()}<span class="text-accent-2-text">{rule.sentence.triggerClause}</span>{/snippet}
          {#snippet then()}<span class="text-intelligence-text">{rule.sentence.actionClause}</span>{/snippet}
        </PanelSentence>
      </div>
      <p class="text-body-sm text-ink-muted m-0 max-w-prose">
        One trigger, one action. Two things to do means two Automations.
      </p>
    </div>

    <!--
      Five cards rather than a dropdown: the five are the vocabulary of the whole
      feature, and hiding four of them makes the feature look smaller than it is.
    -->
    <div class="area-when">
      <ScreenGroup label="When">
        <div class="flex flex-col gap-2">
          {#each triggers as option (option.kind)}
            <ScreenCard
              title={option.name}
              sub={option.blurb}
              icon={TRIGGER_ICON[option.kind]}
              selected={option.kind === trigger.kind}
              onselect={() => {
                pickedTrigger = option.kind;
                if (option.kind === "schedule" && option.chosen) {
                  mockWorkbench.inspect("agents.schedule-trigger", {
                    kind: "trigger",
                    id: automationId
                  });
                }
              }}
            >
              {#if option.chosen}
                <span class="flex"><PanelChip tone="accent-2">Chosen</PanelChip></span>
              {/if}
            </ScreenCard>
          {/each}
        </div>

        <div class="detail flex flex-col gap-2 py-2">
          {#if trigger.kind === "schedule" && trigger.schedule}
            <PanelFields>
              <PanelField label="At">
                {trigger.schedule.at}
                {trigger.schedule.repeats.toLowerCase()}
              </PanelField>
              <PanelField label="Timezone" mono>{trigger.schedule.timezone}</PanelField>
              <PanelField label="Next">
                {trigger.schedule.nextFire ?? "Nothing next while it is off"}
              </PanelField>
            </PanelFields>
            <div class="px-3">
              <ScreenNote>Next run comes from the scheduler, not from the browser.</ScreenNote>
            </div>
          {:else if trigger.kind === "resource-change" && trigger.watches}
            <PanelFields>
              <PanelField label="Watches">{trigger.watches}</PanelField>
            </PanelFields>
          {:else if trigger.kind === "connector-sync" && trigger.connector}
            <PanelFields>
              <PanelField label="Connector">{trigger.connector}</PanelField>
            </PanelFields>
            <div class="px-3">
              <ScreenNote>
                It fires when the sync finishes, once, however many files changed.
              </ScreenNote>
            </div>
          {:else if trigger.kind === "finding-accepted" && trigger.chosen}
            <PanelFields>
              <PanelField label="Under">{trigger.question ?? "Any question"}</PanelField>
            </PanelFields>
          {:else if trigger.kind === "manual"}
            <div class="px-3">
              <ScreenNote>Never fires on its own. Run now is the point of it.</ScreenNote>
            </div>
          {:else}
            <div class="px-3">
              <ScreenNote>
                Nothing is set for this one. The rule is stored as
                {storedTrigger.name.toLowerCase()}, so there is no detail to show here yet.
              </ScreenNote>
            </div>
          {/if}
        </div>
      </ScreenGroup>
    </div>

    <div class="area-do-this">
      <ScreenGroup label="Do this">
        <div class="flex flex-col gap-2">
          {#each actions as option (option.kind)}
            <ScreenCard
              title={option.name}
              sub={option.blurb}
              icon={ACTION_ICON[option.kind]}
              selected={option.kind === action.kind}
              onselect={() => {
                pickedAction = option.kind;
                if (option.chosen) {
                  mockWorkbench.inspect(
                    option.kind === "ask-agent" ? "agents.agent-action" : "agents.refresh-action",
                    { kind: "action", id: automationId }
                  );
                }
              }}
            >
              {#if option.chosen}
                <span class="flex"><PanelChip tone="intelligence">Chosen</PanelChip></span>
              {/if}
            </ScreenCard>
          {/each}
        </div>

        <div class="detail flex flex-col gap-2 py-2">
          {#if action.kind === "ask-agent" && action.agent && action.agentName}
            {@const agent = action.agent}
            {@const agentName = action.agentName}
            <PanelFields>
              <PanelField label="Agent">
                <PanelActor
                  name={agentName}
                  kind="agent"
                  onselect={() =>
                    mockWorkbench.inspect("agents.persona", { kind: "persona", id: agent })}
                />
              </PanelField>
            </PanelFields>
            <!-- Verbatim: nothing is added to the instruction and nothing is
                 templated into it, so it is quoted rather than paraphrased. -->
            <PanelQuote>{action.prompt}</PanelQuote>
          {:else if action.kind === "refresh-block"}
            <div class="flex flex-col gap-1.5 px-3">
              {#each action.blocks as block (block.id)}
                {@render blockRow(block, block.id === action.chosenBlock)}
              {/each}
            </div>
            <div class="px-3">
              <ScreenNote tone="gap">
                Where a block lives is a reverse query: a generated output keeps no pointer back to
                the resource holding it, so this names what it can and no more.
              </ScreenNote>
            </div>
          {:else}
            <div class="px-3">
              <ScreenNote>
                Nothing is set for this one. The rule is stored as
                {storedAction.name.toLowerCase()}, so there is no detail to show here yet.
              </ScreenNote>
            </div>
          {/if}
        </div>
      </ScreenGroup>
    </div>

    <!--
      Under the action column, because the action is what fired. One fire, and
      nothing here may read as the head of a list.
    -->
    <div class="area-last-fired">
      <ScreenGroup label="Last fired">
        <div class="detail flex flex-col gap-2 py-2">
          <PanelFields>
            <PanelField label="Last fired">{fire.when}</PanelField>
            <PanelField label="Result">
              <PanelChip tone={RESULT_TONE[fire.result]}>{fire.result}</PanelChip>
            </PanelField>
            {#if fire.why}
              <PanelField label="Why">{fire.why}</PanelField>
            {/if}
            <PanelField label="Fired about" mono>
              {fire.firedAbout === 0 ? "never" : `~${fire.firedAbout} times`}
            </PanelField>
            {#if fire.task}
              {@const task = fire.task}
              <PanelField label="Task">
                <PanelLink
                  label={task.title}
                  title="What the fire started"
                  onselect={() => mockWorkbench.inspect("copilot.task", { kind: "task", id: task.id })}
                />
              </PanelField>
            {/if}
          </PanelFields>

          <div class="px-3">
            <ScreenNote tone="gap">
              There is no run table. This is the whole history of the rule rather than its most
              recent line, and the count is an estimate.
            </ScreenNote>
          </div>
        </div>
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

{#snippet blockRow(block: GeneratedBlock, chosen: boolean)}
  <button
    type="button"
    class="border-border-subtle rounded-control hover:bg-surface-panel-hover flex flex-col gap-0.5 border px-2 py-1.5 text-start"
    class:bg-surface-work={chosen}
    onclick={() => mockWorkbench.inspect("agents.refresh-action", { kind: "block", id: block.id })}
  >
    <span class="text-body-sm text-ink-primary flex items-center gap-1.5">
      {block.name}
      {#if chosen}<PanelChip tone="intelligence">Chosen</PanelChip>{/if}
    </span>
    <span class="text-caption text-ink-muted">{block.resource} · {block.location}</span>
  </button>
{/snippet}

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. Two equal
   * tracks: the sentence has one blank per column, and neither blank is the
   * larger half of a rule.
   *
   * `when` runs down three rows and `do-this` down two exactly as the table has
   * it — the trigger offers five cards to the action's two, so the left column is
   * the taller of the pair and *last fired* takes the row the right column has
   * left over.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "screen-header screen-header"
      "the-sentence  the-sentence"
      "when          do-this"
      "when          do-this"
      "when          last-fired";
    align-content: start;
  }

  .area-screen-header {
    grid-area: screen-header;
  }
  .area-the-sentence {
    grid-area: the-sentence;
  }
  .area-when {
    grid-area: when;
    min-width: 0;
  }
  .area-do-this {
    grid-area: do-this;
    min-width: 0;
  }
  .area-last-fired {
    grid-area: last-fired;
    min-width: 0;
  }

  /** The box under a chooser, holding whichever choice is marked. */
  .detail {
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
  }

  /*
    One column below the width where two halves of a sentence stop fitting side
    by side. The sentence leads, then the halves in the order it reads them, and
    the fire stays under the action.
  */
  @media (max-width: 60rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "screen-header"
        "the-sentence"
        "when"
        "do-this"
        "last-fired";
    }
  }
</style>
