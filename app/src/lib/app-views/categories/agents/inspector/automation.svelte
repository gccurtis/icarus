<script lang="ts">
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Play from "@lucide/svelte/icons/play";
  import Wrench from "@lucide/svelte/icons/wrench";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelChip,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelLink,
    PanelRow,
    PanelSection,
    PanelSentence,
    PanelSkeleton,
    PanelToggle
  } from "$authored-components/panel";
  import { automationDetail, messageOf } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { isSelected, openAutomation } from "$app-views/categories/agents/procedures/navigate";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { runAutomation } from "$app-views/categories/agents/procedures/run-automation";
  import { STATE_LABEL } from "$app-views/categories/agents/procedures/tasks";
  import { updateAutomation } from "$app-views/categories/agents/procedures/update-automation";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import {
    TRIGGER_LABEL,
    toolOf,
    triggerClause,
    triggerSummary
  } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const automationId = $derived(view.selection?.kind === "automation" ? view.selection.id : undefined);
  const detail = $derived(automationDetail(automationId));

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);
  const clock = startClock();

  const automation = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );

  const toggle = (enabled: boolean) => {
    if (automation === undefined) return;
    const held = automation;
    void run(surface, "enabled", () => updateAutomation(view, held, { enabled }));
  };

  const fire = () => {
    if (automation === undefined) return;
    const held = automation;
    void run(
      surface,
      "run",
      () => runAutomation(view, held.id),
      (fired) => inspectAgent(view, { kind: "task", id: fired.taskId })
    );
  };

  const short = (text: string) => (text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text);
</script>

{#if detail === undefined}
  <Panel title="Automation">
    <PanelEmpty title="Select an automation to inspect it." />
  </Panel>
{:else if detail.error}
  <Panel title="Automation">
    <PanelBanner title="Automation unavailable" tone="danger">{messageOf(detail.error)}</PanelBanner>
  </Panel>
{:else if !detail.ready}
  <Panel title="Automation">
    <PanelSkeleton shape="fields" count={6} />
  </Panel>
{:else if automation === undefined}
  <Panel title="Automation">
    <PanelEmpty title="That automation is not in this project." />
  </Panel>
{:else}
  <Panel title={automation.name}>
    {#snippet actions()}
      <PanelButton label="Open" icon={FolderOpen} tone="primary" onclick={() => openAutomation(view, automation.id)} />
      <PanelButton
        label={surface.busy === "run" ? "Starting" : "Run now"}
        icon={Play}
        disabled={surface.busy !== undefined}
        onclick={fire}
      />
    {/snippet}

    {#if surface.failure}
      <PanelBanner title="That did not save" tone="attention">{surface.failure}</PanelBanner>
    {/if}

    <div class="px-3 pb-2">
      <PanelSentence lead="When" join="ask" tone={automation.enabled ? "default" : "inactive"}>
        {#snippet when()}{triggerClause(automation.trigger, automation.triggerRefName ?? undefined)}{/snippet}
        {#snippet then()}{automation.personaName} to {short(automation.instruction)}{/snippet}
      </PanelSentence>
    </div>

    <PanelFields>
      <PanelField label="On">
        <PanelToggle
          checked={automation.enabled}
          label="Enabled"
          disabled={surface.busy !== undefined}
          onchange={toggle}
        />
      </PanelField>
      <PanelField label="Trigger">
        <PanelChip tone="neutral">{TRIGGER_LABEL[automation.trigger.kind]}</PanelChip>
      </PanelField>
      <PanelField label="Fires">{triggerSummary(automation.trigger, automation.triggerRefName ?? undefined)}</PanelField>
      <PanelField label="Persona">
        <PanelLink
          label={automation.personaName}
          onselect={() => inspectAgent(view, { kind: "persona", id: automation.personaId })}
        />
      </PanelField>
      <PanelField label="Fired">{automation.firedCount} {automation.firedCount === 1 ? "time" : "times"}</PanelField>
      <PanelField label="Last fired">
        {automation.lastFiredAt === null ? "Never" : relativeTime(automation.lastFiredAt, clock.now)}
      </PanelField>
      <PanelField label="Built by">{automation.createdByName}</PanelField>
      <PanelField label="Revision" mono>{automation.revision}</PanelField>
    </PanelFields>

    <div class="pt-2">
      <PanelSection title="Fired tasks" count={automation.fired.length} flush>
        {#each automation.fired.slice(0, 8) as task (task.id)}
          <PanelRow
            title={task.title}
            sub="{STATE_LABEL[task.state]} · {relativeTime(task.startedAt, clock.now)}"
            tone={task.state === "running" ? "active" : task.state === "review" ? "intelligence" : "default"}
            selected={isSelected(view, "task", task.id)}
            onselect={() => inspectAgent(view, { kind: "task", id: task.id })}
          />
        {:else}
          <PanelEmpty title="It has not fired yet." flush />
        {/each}
      </PanelSection>

      <PanelSection title="Tools" count={automation.tools.length} flush open={false}>
        {#each automation.tools as toolId (toolId)}
          {@const tool = toolOf(toolId)}
          <PanelRow
            title={tool?.name ?? toolId}
            sub={tool?.does}
            icon={Wrench}
            selected={isSelected(view, "tool", toolId) && view.selection?.at === automation.id}
            onselect={() => inspectAgent(view, { kind: "tool", id: toolId, at: automation.id })}
          />
        {:else}
          <PanelEmpty title="No tool allowed." flush />
        {/each}
      </PanelSection>
    </div>
  </Panel>
{/if}
