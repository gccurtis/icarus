<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection,
    PanelSentence,
    PanelToggle
  } from "$authored-components/panel";
  import { Separator } from "$vendored-components/separator";
  import { automation } from "$capabilities/agents";
  import { PEOPLE, type Person } from "$capabilities/cast";
  import { viewState } from "$model/client/view-state";

  /**
   * An Automation: the rule as a sentence, whether it is on, and what happened
   * the one time there is a record of.
   *
   * `docs/screen-panel-views/inspector/agents/automation.md` is the
   * specification. The sentence is the rule — trigger and action fields are how
   * it is stored, and this is how it is read, in the same two clauses the list
   * and the workspace heading use.
   *
   * **Turning it off is the removal.** A rule that is off never fires and keeps
   * everything attributed to it, so there is no Delete here rather than a
   * disabled one: past tasks name this rule, and hard deletion would break those
   * labels.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const view = viewState();

  const rule = $derived(automation(automationId).current);

  /** Held locally: the door is a read, and an edit that vanished on the next read
   * would be worse than one that is plainly local. */
  let renamed = $state<string | undefined>(undefined);
  let enabledDraft = $state<boolean | undefined>(undefined);

  const name = $derived(renamed ?? rule.name);
  const enabled = $derived(enabledDraft ?? rule.enabled);

  /** A dispatch is a fact about this session, not a state of the rule. */
  let dispatched = $state(false);

  const RESULT_TONE = {
    Started: "success",
    "Couldn't start": "danger",
    Never: "neutral"
  } as const;

  /** The creator is an actor, so it is a face and a way in rather than a string. */
  const creator = $derived(PEOPLE.find((person: Person) => person.name === rule.createdBy));
</script>

<Panel title={name}>
  <!--
    Open and Run now act on the whole rule, so they sit in the panel's action row
    rather than beside one of its fields.
  -->
  {#snippet actions()}
    <PanelButton
      label="Open"
      icon={SquareArrowOutUpRight}
      title="Open the trigger in the rail"
      onclick={() => view.selectContext("agents.when")}
    />
    <PanelButton
      label="Run now"
      icon={Play}
      tone="primary"
      title="Dispatches using the saved rule"
      onclick={() => (dispatched = true)}
    />
  {/snippet}

  <PanelSection title="This rule" flush>
    <PanelFields>
      <PanelField label="Name" stacked>
        <PanelEditableText label="Name" value={name} onchange={(next: string) => (renamed = next)} />
      </PanelField>

      <PanelField label="On">
        <PanelToggle
          label="{rule.name} is on"
          checked={enabled}
          onchange={(next: boolean) => (enabledDraft = next)}
        />
      </PanelField>

      <PanelField label="Reads" stacked>
        <!-- The comma is the whole connective: the action clause carries its own verb.
             Inert clauses, because the record names no trigger or action to open. -->
        <PanelSentence join="">
          {#snippet when()}{rule.sentence.triggerClause}{/snippet}
          {#snippet then()}{rule.sentence.actionClause}{/snippet}
        </PanelSentence>
      </PanelField>
    </PanelFields>

    <PanelNote>
      The sentence is the rule. Trigger and action fields are how it is stored;
      this is how it is read, everywhere it appears.
    </PanelNote>

    {#if dispatched}
      <!-- Started, not succeeded: what a fire does is create a task. -->
      <PanelNote>Started, using the saved rule rather than the edited one.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Last fired" flush>
    <PanelFields>
      <PanelField label="When">
        <PanelLink
          label={rule.lastFire.when}
          title="Open the last fire"
          onselect={() =>
            view.inspect("agents.last-fired", { kind: "automation", id: automationId })}
        />
      </PanelField>
      <PanelField label="Result">
        <PanelChip tone={RESULT_TONE[rule.lastFire.result]}>{rule.lastFire.result}</PanelChip>
      </PanelField>
      {#if rule.lastFire.why}
        <PanelField label="Why" stacked>{rule.lastFire.why}</PanelField>
      {/if}
    </PanelFields>

    <PanelNote>
      The one piece of history there is. There is no run table, so this is the
      whole record rather than the most recent of a series.
    </PanelNote>
  </PanelSection>

  <!-- Provenance rather than the reason the panel was opened, so it arrives shut. -->
  <PanelSection title="Attribution" open={false} flush>
    <PanelFields>
      <PanelField label="Created by">
        {#if creator}
          <PanelActor
            name={creator.name}
            kind="person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: creator.id })}
          />
        {:else}
          {rule.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Revision" mono>{rule.revision}</PanelField>
    </PanelFields>
  </PanelSection>

  <!-- Last and separated, and it holds sentences rather than a control. -->
  <Separator />

  <PanelSection title="Removal" flush>
    <PanelNote>
      Turning it off is the safe removal. A rule that is off never fires and keeps
      everything attributed to it.
    </PanelNote>
    <PanelNote tone="gap">
      Hard deletion stays gated until there is a tombstone policy: past tasks are
      attributed to this rule by name, and deleting it would break every one of
      those labels. A disabled Delete would imply the policy exists.
    </PanelNote>
  </PanelSection>
</Panel>
