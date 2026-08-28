<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Play from "@lucide/svelte/icons/play";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { triggersFor, type TriggerOption } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The trigger half of an Automation: the five things that can start a rule.
   *
   * `docs/screen-panel-views/context/agents/when.md` is the specification. A
   * rule has exactly one trigger, so this is a chooser rather than a list of
   * settings — the chosen one is expanded and marked, the other four collapse to
   * their names.
   *
   * **All five are always drawn.** They are the vocabulary of the feature, and
   * hiding the four that are not chosen makes the feature look smaller than it
   * is.
   *
   * **The set is keyed on the choice.** `PanelSection` reads `open` once, so
   * that a section a reader shut does not spring open again; choosing a
   * different trigger has to re-open the sections, and re-mounting them is how.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const options = $derived(triggersFor(automationId).current);

  const stored = $derived(
    options.find((option: TriggerOption) => option.chosen)?.kind ?? "manual"
  );

  /** The choice in this session, once someone has made one. */
  let picked = $state<TriggerOption["kind"] | undefined>(undefined);
  const chosen = $derived(picked ?? stored);

  const storedName = $derived(
    options.find((option: TriggerOption) => option.kind === stored)?.name ?? "nothing"
  );

  /** A dispatch is a fact about this session, not a state of the rule. */
  let dispatched = $state(false);
</script>

<Panel title="When">
  {#if chosen !== stored}
    <PanelNote>
      Not saved. The rule still starts on {storedName} until this is written back.
    </PanelNote>
  {/if}

  {#key chosen}
    {#each options as option (option.kind)}
      <PanelSection title={option.name} open={option.kind === chosen}>
        {#if option.kind !== chosen}
          <PanelNote>{option.blurb}.</PanelNote>
          <PanelButton
            label="Start on this instead"
            icon={Check}
            onclick={() => (picked = option.kind)}
          />
        {:else if option.kind === "schedule"}
          <PanelChip tone="active">Chosen</PanelChip>
          {#if option.schedule}
            {@const schedule = option.schedule}
            <PanelFields>
              <PanelField label="At">{schedule.at} {schedule.repeats.toLowerCase()}</PanelField>
              <!-- Stored, never inferred: "02:00" with no timezone is ambiguous to
                   everyone but its author. -->
              <PanelField label="Timezone" mono>{schedule.timezone}</PanelField>
              <PanelField label="Next">
                {schedule.nextFire ?? "Nothing next while the rule is off"}
              </PanelField>
            </PanelFields>

            <PanelSection title="Advanced" open={false}>
              <PanelFields>
                <PanelField label="Cron" mono>{schedule.cron}</PanelField>
              </PanelFields>
            </PanelSection>
          {:else}
            <PanelNote>No time set yet.</PanelNote>
          {/if}
        {:else if option.kind === "resource-change"}
          <PanelChip tone="active">Chosen</PanelChip>
          <PanelFields>
            <PanelField label="Watches">{option.watches ?? "Nothing yet"}</PanelField>
          </PanelFields>
          <PanelNote tone="gap">
            Created, edited, renamed and deleted are four different things, and
            the model has one word for all of them. A rule that fires on every one
            of them is rarely what anyone meant.
          </PanelNote>
        {:else if option.kind === "connector-sync"}
          <PanelChip tone="active">Chosen</PanelChip>
          {#if option.connector}
            {@const connector = option.connector}
            <PanelFields>
              <PanelField label="Connector">
                <PanelLink
                  label={connector}
                  title="{connector} — connector"
                  onselect={() =>
                    view.inspect("project.connector", {
                      kind: "connector",
                      id: connector
                    })}
                />
              </PanelField>
            </PanelFields>
          {:else}
            <PanelNote>No connector chosen yet.</PanelNote>
          {/if}
        {:else if option.kind === "finding-accepted"}
          <PanelChip tone="active">Chosen</PanelChip>
          <PanelFields>
            <PanelField label="Only under" stacked>
              {option.question ?? "Any question in this project"}
            </PanelField>
          </PanelFields>
        {:else}
          <PanelChip tone="active">Chosen</PanelChip>
          <PanelNote>
            This rule never fires on its own. Run now is the point of it.
          </PanelNote>
          <PanelButton
            label="Run now"
            icon={Play}
            tone="primary"
            title="Dispatches using the saved rule"
            onclick={() => (dispatched = true)}
          />
          {#if dispatched}
            <PanelNote>Dispatched using the saved configuration.</PanelNote>
          {/if}
        {/if}
      </PanelSection>
    {/each}
  {/key}
</Panel>
