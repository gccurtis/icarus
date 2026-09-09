<script lang="ts">
  import { ScreenNote } from "$authored-components/screen";
  import { Switch } from "$vendored-components/switch";
  import { agentsLibrary, ownerOf } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { setTools } from "$app-views/categories/agents/procedures/set-tools";
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

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

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

  const toggle = (toolId: ToolId, next: boolean) => {
    const set = new Set<ToolId>(current);
    if (next) set.add(toolId);
    else set.delete(toolId);
    const tools = orderedTools([...set]);
    if (held === undefined) {
      onchange?.(tools.join(","));
      return;
    }
    const owner = held;
    void run(surface, "tools", () => setTools(view, owner, tools));
  };
</script>

{#if surface.failure}
  <ScreenNote tone="gap">{surface.failure}</ScreenNote>
{/if}
<ul class="tools surface-seam-grid">
  {#each TOOLS as tool (tool.id)}
    <li>
      <Switch
        size="sm"
        checked={current.includes(tool.id)}
        aria-label="Allow {tool.name}"
        disabled={disabled || surface.busy !== undefined || held?.finished === true}
        onCheckedChange={(next: boolean) => toggle(tool.id, next)}
      />
      <div class="words">
        {#if held !== undefined}
          <button
            type="button"
            class="name hover:underline"
            onclick={() => inspectAgent(view, { kind: "tool", id: tool.id, at: held.id })}
          >
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
