<script lang="ts">
  import { onDestroy } from "svelte";

  import {
    Panel,
    PanelBanner,
    PanelCrumbs,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelSection,
    PanelSkeleton,
    PanelToggle
  } from "$authored-components/panel";
  import {
    agentsLibrary,
    inspectAutomation,
    inspectPersona,
    inspectTask,
    messageOf,
    ownerOf,
    updateAutomation,
    updatePersona,
    updateTask
  } from "$app-views/categories/agents/procedures/library.svelte";
  import {
    isToolId,
    orderedTools,
    toolOf,
    type ToolId
  } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });

  const toolId = $derived(
    view.selection?.kind === "tool" && isToolId(view.selection.id) ? view.selection.id : undefined
  );
  const ownerId = $derived(view.selection?.kind === "tool" ? view.selection.at : undefined);
  const tool = $derived(toolId === undefined ? undefined : toolOf(toolId));
  const answer = $derived(library.ready ? library.current : undefined);
  const owner = $derived(ownerId === undefined ? undefined : ownerOf(answer, ownerId));
  const defaults = $derived(
    owner?.personaId === undefined
      ? undefined
      : answer?.personas.find((persona) => persona.id === owner.personaId)?.tools
  );

  const allowed = $derived(owner !== undefined && toolId !== undefined && owner.tools.includes(toolId));
  const byDefault = $derived(defaults !== undefined && toolId !== undefined && defaults.includes(toolId));

  let pending = $state(false);
  let actionError = $state<string>();

  const toggle = async (next: boolean) => {
    if (owner === undefined || toolId === undefined) return;
    const set = new Set<ToolId>(owner.tools);
    if (next) set.add(toolId);
    else set.delete(toolId);
    const tools = orderedTools([...set]);
    pending = true;
    actionError = undefined;
    try {
      const result =
        owner.kind === "persona"
          ? await updatePersona(view, owner, { tools })
          : owner.kind === "task"
            ? await updateTask(view, owner, { tools })
            : await updateAutomation(view, owner, { tools });
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = false;
    }
  };

  const back = () => {
    if (owner === undefined) return;
    if (owner.kind === "persona") inspectPersona(view, owner.id);
    else if (owner.kind === "task") inspectTask(view, owner.id);
    else inspectAutomation(view, owner.id);
  };

  const OWNER_WORD = { persona: "Persona", task: "Task", automation: "Automation" } as const;

  const REACH = {
    scope: "What the persona may read",
    project: "This project",
    unbounded: "Beyond the project"
  } as const;
</script>

{#if tool === undefined}
  <Panel title="Tool">
    <PanelEmpty title="That tool is not in the catalogue." />
  </Panel>
{:else if library.error}
  <Panel title={tool.name}>
    <PanelBanner title="Tool grant unavailable" tone="danger">{messageOf(library.error)}</PanelBanner>
  </Panel>
{:else if !library.ready}
  <Panel title={tool.name}>
    <PanelSkeleton shape="fields" count={3} />
  </Panel>
{:else}
  <Panel title={tool.name}>
    {#snippet crumbs()}
      {#if owner}
        <PanelCrumbs
          trail={[{ label: owner.name, key: owner.id }, { label: "Tools" }, { label: tool.name }]}
          onnavigate={back}
        />
      {/if}
    {/snippet}

    {#if actionError}
      <PanelBanner title="That did not save" tone="attention">{actionError}</PanelBanner>
    {/if}

    <PanelFields>
      <PanelField label="Tool" mono>{tool.id}</PanelField>
      <PanelField label="Reaches">{REACH[tool.reach]}</PanelField>
      {#if owner}
        <PanelField label={OWNER_WORD[owner.kind]}>{owner.name}</PanelField>
        <PanelField label="Allowed">
          {#if owner.finished}
            {allowed ? "Yes, as it ran" : "No, as it ran"}
          {:else}
            <PanelToggle checked={allowed} label="Allow {tool.name}" disabled={pending} onchange={toggle} />
          {/if}
        </PanelField>
        {#if defaults !== undefined}
          <PanelField label="Persona default">{byDefault ? "Yes" : "No"}</PanelField>
        {/if}
      {/if}
    </PanelFields>

    <div class="pt-2">
      <PanelSection title="What granting it means">
        <p class="text-body-sm text-ink-secondary m-0">{tool.does}</p>
      </PanelSection>
    </div>
  </Panel>
{/if}
