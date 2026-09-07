<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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
  import {
    STATE_LABEL,
    automationDetail,
    inspectPersona,
    inspectTask,
    inspectTool,
    isSelected,
    messageOf,
    openAutomation,
    runAutomation,
    updateAutomation
  } from "$app-views/categories/agents/procedures/library.svelte";
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

  let live = true;
  onDestroy(() => {
    live = false;
  });
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const automation = $derived(
    detail !== undefined && detail.ready ? (detail.current ?? undefined) : undefined
  );

  let pending = $state<string>();
  let actionError = $state<string>();

  const toggle = async (enabled: boolean) => {
    if (automation === undefined) return;
    pending = "enabled";
    actionError = undefined;
    try {
      const result = await updateAutomation(view, automation, { enabled });
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const run = async () => {
    if (automation === undefined) return;
    pending = "run";
    actionError = undefined;
    try {
      const result = await runAutomation(view, automation.id);
      if (!live) return;
      if (result.accepted) inspectTask(view, result.taskId);
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
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
      <PanelButton label={pending === "run" ? "Starting" : "Run now"} icon={Play} disabled={pending !== undefined} onclick={run} />
    {/snippet}

    {#if actionError}
      <PanelBanner title="That did not save" tone="attention">{actionError}</PanelBanner>
    {/if}

    <div class="px-3 pb-2">
      <PanelSentence lead="When" join="ask" tone={automation.enabled ? "default" : "inactive"}>
        {#snippet when()}{triggerClause(automation.trigger, automation.triggerRefName ?? undefined)}{/snippet}
        {#snippet then()}{automation.personaName} to {short(automation.instruction)}{/snippet}
      </PanelSentence>
    </div>

    <PanelFields>
      <PanelField label="On">
        <PanelToggle checked={automation.enabled} label="Enabled" disabled={pending !== undefined} onchange={toggle} />
      </PanelField>
      <PanelField label="Trigger">
        <PanelChip tone="neutral">{TRIGGER_LABEL[automation.trigger.kind]}</PanelChip>
      </PanelField>
      <PanelField label="Fires">{triggerSummary(automation.trigger, automation.triggerRefName ?? undefined)}</PanelField>
      <PanelField label="Persona">
        <PanelLink label={automation.personaName} onselect={() => inspectPersona(view, automation.personaId)} />
      </PanelField>
      <PanelField label="Fired">{automation.firedCount} {automation.firedCount === 1 ? "time" : "times"}</PanelField>
      <PanelField label="Last fired">
        {automation.lastFiredAt === null ? "Never" : relativeTime(automation.lastFiredAt, now)}
      </PanelField>
      <PanelField label="Built by">{automation.createdByName}</PanelField>
      <PanelField label="Revision" mono>{automation.revision}</PanelField>
    </PanelFields>

    <div class="pt-2">
      <PanelSection title="Fired tasks" count={automation.fired.length} flush>
        {#each automation.fired.slice(0, 8) as task (task.id)}
          <PanelRow
            title={task.title}
            sub="{STATE_LABEL[task.state]} · {relativeTime(task.startedAt, now)}"
            tone={task.state === "running" ? "active" : task.state === "review" ? "intelligence" : "default"}
            selected={isSelected(view, "task", task.id)}
            onselect={() => inspectTask(view, task.id)}
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
            onselect={() => inspectTool(view, toolId, automation.id)}
          />
        {:else}
          <PanelEmpty title="No tool allowed." flush />
        {/each}
      </PanelSection>
    </div>
  </Panel>
{/if}
