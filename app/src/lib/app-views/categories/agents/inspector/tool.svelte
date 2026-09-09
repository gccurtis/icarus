<script lang="ts">
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
  import { agentsLibrary, messageOf, ownerOf } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { setTools } from "$app-views/categories/agents/procedures/set-tools";
  import {
    isToolId,
    orderedTools,
    toolOf,
    type ToolId
  } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

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

  const toggle = (next: boolean) => {
    if (owner === undefined || toolId === undefined) return;
    const held = owner;
    const set = new Set<ToolId>(held.tools);
    if (next) set.add(toolId);
    else set.delete(toolId);
    const tools = orderedTools([...set]);
    void run(surface, "tools", () => setTools(view, held, tools));
  };

  const back = () => {
    if (owner === undefined) return;
    inspectAgent(view, { kind: owner.kind, id: owner.id });
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

    {#if surface.failure}
      <PanelBanner title="That did not save" tone="attention">{surface.failure}</PanelBanner>
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
            <PanelToggle
              checked={allowed}
              label="Allow {tool.name}"
              disabled={surface.busy !== undefined}
              onchange={toggle}
            />
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
