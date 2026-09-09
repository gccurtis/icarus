<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import {
    Panel,
    PanelActions,
    PanelBanner,
    PanelButton,
    PanelCrumbs,
    PanelNote,
    PanelProgress
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import PromptSettings from "$app-views/categories/document-editor/components/prompt-settings.svelte";
  import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
  import {
    promptScopeOps,
    type LinkedPromptBlock
  } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import PromptScope from "$app-views/categories/document-editor/components/prompt-scope.svelte";
  import PromptTemplateSection from "$app-views/categories/document-editor/components/prompt-template-section.svelte";
  import {
    PromptBlockState,
    type PromptBlockPhase
  } from "$app-views/categories/document-editor/inspector/prompt-block.state.svelte";
  import { createPromptBlock } from "$app-views/categories/document-editor/procedures/create-prompt-block";
  import { synchronizePromptBlockDraft } from "$app-views/categories/document-editor/procedures/effects/prompt-block-draft.svelte";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";


  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  const runtime = $derived(
    documentId === undefined ? undefined : view.documentRuntime(documentId)
  );
  const state = new PromptBlockState();

  const body = $derived(runtime?.body);
  const blockId = $derived(view.selection?.id ?? "");
  const held = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const prompt = $derived(held?.type === "prompt" ? held : undefined);
  const linked = $derived(
    prompt?.derivedOutputId === undefined ? undefined : (prompt as LinkedPromptBlock)
  );

  const PHASE: Record<PromptBlockPhase, string> = {
    creating: "Creating Derived Output",
    saving: "Saving Prompt Block",
    generating: "Generating response"
  };

  synchronizePromptBlockDraft(state, () => prompt?.id);

  const create = () => createPromptBlock({ blockId, documentId, runtime, state });

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };

  const confirmScope = (next: unknown) => {
    if (prompt === undefined || runtime === undefined) return;
    const ops = promptScopeOps(prompt, next);
    if (ops.length > 0) runtime.apply(ops);
  };
</script>

<Panel title="Prompt block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Prompt block" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if prompt === undefined || runtime === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The Prompt Block is gone.</PanelNote>
    </div>
  {:else}
    {#if state.phase !== undefined}
      <div class="pt-2">
        <PanelProgress label={PHASE[state.phase]} tone="intelligence" />
      </div>
    {/if}

    {#if state.actionError !== undefined}
      <div class="pt-2">
        <PanelBanner title="This Prompt Block needs attention" tone="attention">
          {state.actionError}. The block remains available so you can try again.
        </PanelBanner>
      </div>
    {/if}

    {#if linked === undefined}
      <div class="setup">
        <label for={`new-prompt-${prompt.id}`}>Prompt</label>
        <Textarea
          id={`new-prompt-${prompt.id}`}
          bind:value={state.promptDraft}
          rows={5}
          maxlength={8000}
          placeholder="What should this block derive from project sources?"
          disabled={state.phase !== undefined}
        />

        <PromptScope
          blockId={prompt.id}
          disabled={state.phase !== undefined}
          onconfirm={confirmScope}
        />
      </div>

      <PanelActions>
        <Button
          size="xs"
          disabled={state.phase !== undefined || state.promptDraft.trim().length === 0}
          onclick={create}
        >
          <Sparkles aria-hidden="true" />
          Generate
        </Button>
      </PanelActions>
    {:else}
      {#key linked.derivedOutputId}
        <PromptSettings blockId={linked.id} derivedOutputId={linked.derivedOutputId} />
      {/key}
    {/if}

    {#key linked?.derivedOutputId ?? "unlinked"}
      <PromptTemplateSection
        blockId={prompt.id}
        derivedOutputId={linked?.derivedOutputId}
        disabled={state.phase !== undefined}
      />
    {/key}
  {/if}
</Panel>

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .setup label {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .setup :global(textarea) {
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

</style>
