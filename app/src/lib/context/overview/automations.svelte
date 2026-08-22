<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import {
    automation,
    automationGroup,
    automationsIn,
    type AutomationRow
  } from "$mock-capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What an Automation is, what this project has, and what is selected.
   *
   * `docs/screen-panel-views/context/overview/automations.md` is the
   * specification. The concept is stated rather than left to be discovered,
   * because the constraint *is* the definition: one trigger, one action, and two
   * triggers means two rules.
   *
   * **Open and Run now sit inside *Selected*, not at the foot of the panel.**
   * They act on the rule above them, and a control below content of unbounded
   * length is a control nobody finds.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const rules = $derived(automationsIn(view.project).current);
  const it = $derived(automation(automationId).current);

  const counted = (group: "on" | "off" | "not working") =>
    rules.filter((rule: AutomationRow) => automationGroup(rule) === group).length;

  let enabledDraft = $state<boolean | undefined>(undefined);
  const enabled = $derived(enabledDraft ?? it.enabled);

  /** A dispatch is a fact about this session, not a state of the rule. */
  let dispatched = $state(false);

  const RESULT_TONE = {
    Started: "success",
    "Couldn't start": "danger",
    Never: "neutral"
  } as const;
</script>

<Panel title="Overview">
  <PanelNote>
    An Automation is a standing rule: when one thing happens, do one other thing.
    A rule has exactly one trigger and one action — two triggers means two rules.
  </PanelNote>

  <PanelSection title="In this project">
    <PanelFields>
      <PanelField label="Rules" mono>{rules.length}</PanelField>
      <PanelField label="On" mono>{counted("on")}</PanelField>
      <PanelField label="Not working" mono>{counted("not working")}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Selected">
    <PanelFields>
      <PanelField label="Name" stacked>{it.name}</PanelField>

      <!--
        Generated from the trigger and the action, never typed. It is how a rule
        is read everywhere on this screen, so the two clauses keep their halves.
      -->
      <PanelField label="Reads" stacked>
        <span class="text-ink-secondary">
          <span class="text-ink-primary font-semibold">When</span>
          {it.sentence.triggerClause},
          <span class="text-ink-primary font-semibold">{it.sentence.actionClause}</span>.
        </span>
      </PanelField>

      <PanelField label="On">
        <PanelToggle
          label="{it.name} is on"
          checked={enabled}
          onchange={(next: boolean) => (enabledDraft = next)}
        />
      </PanelField>

      <PanelField label="Last result">
        <PanelChip tone={RESULT_TONE[it.lastFire.result]}>
          {it.lastFire.result} · {it.lastFire.when}
        </PanelChip>
      </PanelField>

      <PanelField label="Fired about" mono>~{it.lastFire.firedAbout} times</PanelField>
    </PanelFields>

    <PanelNote>
      There is no run table to count, so the fire count is approximate and the
      last fire is the entire history.
    </PanelNote>

    <PanelActions>
      <PanelButton
        label="Open"
        icon={SquareArrowOutUpRight}
        onclick={() => view.selectContext("agents.when")}
      />
      <PanelButton
        label="Run now"
        icon={Play}
        tone="primary"
        title="Dispatches using the saved rule"
        onclick={() => (dispatched = true)}
      />
    </PanelActions>

    {#if dispatched}
      <PanelNote>Dispatched using the saved configuration, not the edited one.</PanelNote>
    {/if}
  </PanelSection>
</Panel>
