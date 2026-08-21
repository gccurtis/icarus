<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { automation, lastFireOf } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The last fire: what happened the one time there is a record of.
   *
   * `docs/screen-panel-views/inspector/agents/last-fired.md` is the
   * specification. There is no run table, so nothing here is the head of a list
   * — the fire count is approximate and carries a tilde for exactly that reason.
   *
   * **A fire is a dispatch.** Started means the task was created; whether it
   * finished is the task's own story, and a later failure never rewrites this
   * line. That is why the distinction is a section rather than a tooltip.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const rule = $derived(automation(automationId).current);
  const fire = $derived(lastFireOf(automationId).current);

  const RESULT_TONE = {
    Started: "success",
    "Couldn't start": "danger",
    Never: "neutral"
  } as const;

  const STATE = {
    waiting: "Waiting",
    running: "Running",
    failed: "Failed",
    completed: "Completed"
  } as const;
</script>

<Panel title="Last fire">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: rule.name, key: "agents.automation" }, { label: "Last fire" }]}
      onnavigate={(key: string) =>
        mockWorkbench.inspect(key, { kind: "automation", id: automationId })}
    />
  {/snippet}

  <PanelSection title="Summary" flush>
    <PanelFields>
      <PanelField label="When">{fire.when}</PanelField>
      <PanelField label="Result">
        <PanelChip tone={RESULT_TONE[fire.result]}>{fire.result}</PanelChip>
      </PanelField>
      {#if fire.why}
        <!-- A fire that could not start made no task, so the reason carries the
             weight the task section cannot. -->
        <PanelField label="Why" stacked>{fire.why}</PanelField>
      {/if}
      <PanelField label="Fired about" mono>~{fire.firedAbout} times</PanelField>
    </PanelFields>

    <PanelNote>
      There is no run table to count. The number is approximate, and this fire is
      the entire history rather than the most recent of a series.
    </PanelNote>
  </PanelSection>

  <PanelSection title="What Started means" flush>
    <PanelNote>
      The task was created. Whether it finished is the task's own story, and a
      later failure never rewrites this line.
    </PanelNote>
    <PanelNote>
      "Succeeded" would be a claim about work this rule never watched. A fire is a
      dispatch, so the word is Started.
    </PanelNote>
  </PanelSection>

  <!-- The way from the dispatch to the work. Context for the summary above, so it
       arrives shut. -->
  <PanelSection title="The task it made" open={false} flush>
    {#if fire.task}
      {@const task = fire.task}
      <PanelRow
        title={task.title}
        sub="{STATE[task.state]} · {task.detail}"
        onselect={() => mockWorkbench.inspect("copilot.task", { kind: "task", id: task.id })}
      />
      <PanelNote>The task is the whole trace, and it opens in the Copilot.</PanelNote>
    {:else}
      <PanelNote>
        No task. A fire that could not start made nothing, and a re-run of a
        generated block leaves no run record of its own.
      </PanelNote>
    {/if}
  </PanelSection>
</Panel>
