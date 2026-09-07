<script lang="ts">
  import { onDestroy } from "svelte";

  import { ScreenNote } from "$authored-components/screen";
  import { Switch } from "$vendored-components/switch";
  import {
    agentsLibrary,
    inspectTool,
    messageOf,
    ownerOf,
    updateAutomation,
    updatePersona,
    updateTask
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { TOOLS, orderedTools, type ToolId } from "$app-views/categories/agents/procedures/vocabulary";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    owner,
    personaId,
    chosen,
    disabled = false,
    onchange
  }: {
    owner?: string;
    personaId?: string;
    chosen?: string;
    disabled?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  const view = workspaceState();
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });

  const answer = $derived(library.ready ? library.current : undefined);
  const held = $derived(owner === undefined ? undefined : ownerOf(answer, owner));
  const fallback = $derived(
    personaId === undefined
      ? undefined
      : answer?.personas.find((persona) => persona.id === personaId)?.tools
  );
  const current = $derived(
    held !== undefined
      ? held.tools
      : chosen === undefined
        ? orderedTools([...(fallback ?? [])])
        : orderedTools(chosen.split(",").map((entry) => entry.trim()))
  );

  let pending = $state(false);
  let actionError = $state<string>();

  const toggle = async (toolId: ToolId, next: boolean) => {
    const set = new Set<ToolId>(current);
    if (next) set.add(toolId);
    else set.delete(toolId);
    const tools = orderedTools([...set]);
    if (held === undefined) {
      onchange?.(tools.join(","));
      return;
    }
    pending = true;
    actionError = undefined;
    try {
      const result =
        held.kind === "persona"
          ? await updatePersona(view, held, { tools })
          : held.kind === "task"
            ? await updateTask(view, held, { tools })
            : await updateAutomation(view, held, { tools });
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = false;
    }
  };
</script>

{#if actionError}
  <ScreenNote tone="gap">{actionError}</ScreenNote>
{/if}
<ul class="tools surface-seam-grid">
  {#each TOOLS as tool (tool.id)}
    <li>
      <Switch
        size="sm"
        checked={current.includes(tool.id)}
        aria-label="Allow {tool.name}"
        disabled={disabled || pending || held?.finished === true}
        onCheckedChange={(next: boolean) => toggle(tool.id, next)}
      />
      <div class="words">
        {#if held !== undefined}
          <button type="button" class="name hover:underline" onclick={() => inspectTool(view, tool.id, held.id)}>
            {tool.name}
          </button>
        {:else}
          <span class="name">{tool.name}</span>
        {/if}
        <span class="does">{tool.does}</span>
      </div>
    </li>
  {/each}
</ul>

<style>
  .tools {
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tools li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: start;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .words {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .name {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    text-align: start;
  }

  .does {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }
</style>
