<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { Panel, PanelEmpty } from "$authored-components/panel";
  import { promptBlocksIn } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const blocks = $derived(promptBlocksIn(runtime?.body));

  const inspect = (blockId: string) => {
    const current = runtime;
    if (current !== undefined) current.scrollTo = blockId;
    view.inspect("document-editor.prompt-block", { kind: "prompt", id: blockId });
  };
</script>

<Panel title="Prompts">
  <section class="prompt-index" aria-labelledby="document-prompts-heading">
    <h3 id="document-prompts-heading">In this document</h3>
    {#if blocks.length === 0}
      <PanelEmpty flush title="No Prompt Blocks yet." />
    {:else}
      <div class="prompt-list">
        {#each blocks as block, index (block.id)}
          <button type="button" onclick={() => inspect(block.id)}>
            <Sparkles size={14} aria-hidden="true" />
            <span>
              <strong>Prompt {index + 1}</strong>
              <small>{block.display || "Unconfigured Prompt Block"}</small>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </section>

</Panel>

<style>
  .prompt-index {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
  }

  .prompt-index h3 {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .prompt-list {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    flex-direction: column;
  }

  .prompt-list button {
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 2);
    align-items: start;
    padding: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    text-align: left;
  }

  .prompt-list button + button {
    border-top: 1px solid var(--token-border-subtle);
  }

  .prompt-list button:hover {
    background: var(--token-surface-panel-hover);
  }

  .prompt-list button > :global(svg) {
    margin-top: 0.1rem;
    color: var(--token-color-intelligence-text);
  }

  .prompt-list span {
    display: grid;
    min-width: 0;
    gap: 0.1rem;
  }

  .prompt-list strong,
  .prompt-list small {
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .prompt-list strong {
    color: var(--token-ink-secondary);
    font-weight: 500;
  }

  .prompt-list small {
    overflow: hidden;
    color: var(--token-ink-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

</style>
