<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { automation, triggersFor, type TriggerOption } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A schedule trigger: when the rule fires, and when it fires next.
   *
   * `docs/screen-panel-views/inspector/agents/schedule-trigger.md` is the
   * specification. The timezone is a field rather than an assumption — "02:00"
   * without one is ambiguous to everyone but its author, and a digest that runs
   * at the wrong hour fails silently.
   *
   * **The next fire comes from the scheduler and is never computed here.** A
   * panel that worked out its own next-fire time and disagreed with the
   * scheduler would be worse than one that said nothing.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const rule = $derived(automation(automationId).current);

  type ScheduleOption = Extract<TriggerOption, { kind: "schedule" }>;
  const isSchedule = (option: TriggerOption): option is ScheduleOption =>
    option.kind === "schedule";

  /** Present only when the schedule is the rule's chosen trigger: a rule that is
   * not on a schedule has no schedule to show. */
  const schedule = $derived(triggersFor(automationId).current.find(isSchedule)?.schedule);

  /** Held locally: the door is a read, and an edit that vanished on the next read
   * would be worse than one that is plainly local. */
  let timeDraft = $state<string | undefined>(undefined);
  let repeatsDraft = $state<string | undefined>(undefined);

  const REPEATS = [
    { value: "Daily", label: "Daily" },
    { value: "Weekdays", label: "Weekdays" },
    { value: "Weekly", label: "Weekly" },
    { value: "Custom", label: "Custom" }
  ] as const;
</script>

<Panel title="Schedule">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: rule.name, key: "agents.automation" },
        { label: "When" },
        { label: "Schedule" }
      ]}
      onnavigate={(key: string) =>
        mockWorkbench.inspect(key, { kind: "automation", id: automationId })}
    />
  {/snippet}

  {#if schedule}
    <PanelSection title="On a schedule" flush>
      <PanelFields>
        <PanelField label="At">
          <PanelEditableText
            label="At"
            value={timeDraft ?? schedule.at}
            mono
            onchange={(next: string) => (timeDraft = next)}
          />
        </PanelField>
        <PanelField label="Timezone" mono>{schedule.timezone}</PanelField>
        <PanelField label="Repeats" stacked>
          <PanelChoice
            label="Repeats"
            value={repeatsDraft ?? schedule.repeats}
            options={REPEATS}
            flush
            onchange={(next: string) => (repeatsDraft = next)}
          />
        </PanelField>
      </PanelFields>

      <PanelNote>
        The timezone is stored rather than inferred. A time without one is
        ambiguous to everyone but its author.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Next" flush>
      <PanelFields>
        <PanelField label="Next fire">{schedule.nextFire ?? "None"}</PanelField>
      </PanelFields>
      {#if schedule.nextFire}
        <PanelNote>From the scheduler, not computed in this panel.</PanelNote>
      {:else}
        <!-- Absent rather than blank: an off rule has no next fire to report. -->
        <PanelNote>
          The scheduler reports no next fire, which is what a rule that is off
          looks like.
        </PanelNote>
      {/if}
    </PanelSection>

    <!-- The stored form, for people who want it. Not the reason the panel was
         opened, so it arrives shut. -->
    <PanelSection title="Advanced" open={false} flush>
      <PanelFields>
        <PanelField label="Cron" mono>{schedule.cron}</PanelField>
      </PanelFields>
      <PanelNote tone="gap">
        An invalid cron expression and an unsupported timezone are separate
        failures and have to be reported separately. One "invalid schedule"
        message for both leaves the author guessing which half is wrong.
      </PanelNote>
    </PanelSection>
  {:else}
    <PanelNote>
      This rule is not on a schedule. Its trigger is something else happening, and
      there is no time to show.
    </PanelNote>
  {/if}
</Panel>
