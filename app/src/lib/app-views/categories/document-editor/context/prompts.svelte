<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import {
    Panel,
    PanelBanner,
    PanelEmpty,
    PanelNote,
    PanelProgress
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import {
    createDerivedOutput,
    readDerivedOutput,
    readDerivedOutputValue,
    refreshDerivedOutput
  } from "$capabilities/derived-output/index.remote";
  import { processSemanticSyncQueue } from "$capabilities/semantic-overlay/index.remote";
  import {
    appendPromptBlock,
    promptBlocksIn
  } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import { announcePromptOutput } from "$app-views/categories/document-editor/procedures/prompt-output-events";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  type Phase = "creating" | "saving" | "indexing" | "generating";

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  let draft = $state("");
  let phase = $state<Phase>();
  let actionError = $state<string>();

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const blocks = $derived(promptBlocksIn(body));
  const busy = $derived(phase !== undefined);

  const PHASE: Record<Phase, string> = {
    creating: "Creating Derived Output",
    saving: "Saving Prompt Block",
    indexing: "Indexing pending sources",
    generating: "Generating response"
  };

  const inspect = (blockId: string) => {
    const current = runtime;
    if (current !== undefined) current.scrollTo = blockId;
    view.inspect("document-editor.prompt-block", { kind: "prompt", id: blockId });
  };

  const create = async () => {
    const prompt = draft.trim();
    const current = runtime;
    const currentBody = body;
    if (prompt.length === 0 || current === undefined || currentBody === undefined || busy) return;

    actionError = undefined;
    phase = "creating";
    let blockId: string | undefined;
    let derivedOutputId: Awaited<ReturnType<typeof createDerivedOutput>>["_id"] | undefined;

    try {
      const output = await createDerivedOutput({ prompt });
      derivedOutputId = output._id;
      const insertion = appendPromptBlock(currentBody, output._id);
      blockId = insertion.block.id;
      current.apply([insertion.op]);
      inspect(insertion.block.id);

      phase = "saving";
      await current.flush();
      if (current.failure !== undefined) throw new Error(current.failure.detail);

      phase = "indexing";
      const queue = await processSemanticSyncQueue({ limit: 50 });
      const failed = queue.processed.find((job) => job.error !== undefined);
      if (failed?.error !== undefined) throw new Error(failed.error);

      phase = "generating";
      const detail = readDerivedOutput({ derivedOutputId: output._id });
      const value = readDerivedOutputValue({ derivedOutputId: output._id });
      const refreshed = await refreshDerivedOutput({ derivedOutputId: output._id }).updates(
        detail,
        value
      );
      if (refreshed === null) throw new Error("The Derived Output disappeared during creation");
      if (refreshed.outcome === "failed") {
        throw new Error(refreshed.output.error ?? "The response could not be generated");
      }

      draft = "";
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
      if (blockId !== undefined) inspect(blockId);
    } finally {
      if (derivedOutputId !== undefined) announcePromptOutput(derivedOutputId);
      phase = undefined;
    }
  };
</script>

<Panel title="Prompts">
  {#if body === undefined}
    <PanelProgress label="Loading document" />
  {:else}
    <form
      class="composer"
      onsubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <label for="document-prompt">Ask project sources</label>
      <Textarea
        id="document-prompt"
        bind:value={draft}
        rows={4}
        maxlength={8000}
        placeholder="What should this block derive from the project?"
        disabled={busy}
      />
      <Button type="submit" size="sm" disabled={busy || draft.trim().length === 0}>
        <Sparkles aria-hidden="true" />
        Create and generate
      </Button>
    </form>

    {#if phase !== undefined}
      <PanelProgress label={PHASE[phase]} tone="intelligence" />
    {/if}

    {#if actionError !== undefined}
      <PanelBanner title="The Prompt Block needs attention" tone="attention">
        {actionError}. If the block was inserted, select it and try Refresh.
      </PanelBanner>
    {/if}

    <div class="divider" aria-hidden="true"></div>

    <section class="existing" aria-labelledby="document-prompts-heading">
      <h3 id="document-prompts-heading">In this document</h3>
      {#if blocks.length === 0}
        <PanelEmpty flush title="No Prompt Blocks yet." />
      {:else}
        <div class="prompt-list">
          {#each blocks as block, index (block.id)}
            <button type="button" onclick={() => inspect(block.id)}>
              <span>Prompt {index + 1}</span>
              <code>{block.derivedOutputId ?? "unlinked"}</code>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <PanelNote>
      New blocks use the whole project as their Resource Set. Up to 50 pending semantic-ingestion
      jobs are processed before each generation.
    </PanelNote>
  {/if}
</Panel>

<style>
  .composer {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 3);
    flex-direction: column;
  }

  .composer label,
  .existing h3 {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .composer :global(textarea) {
    min-height: 5.5rem;
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .divider {
    margin: calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid var(--token-border-subtle);
  }

  .existing {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .prompt-list {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    flex-direction: column;
  }

  .prompt-list button {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2);
    text-align: left;
  }

  .prompt-list button + button {
    border-top: 1px solid var(--token-border-subtle);
  }

  .prompt-list button:hover {
    background: var(--token-surface-panel-hover);
  }

  .prompt-list span {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  .prompt-list code {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--token-ink-muted);
    font-size: 0.65625rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
