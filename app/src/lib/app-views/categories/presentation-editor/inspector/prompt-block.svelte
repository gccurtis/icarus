<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import {
    Panel,
    PanelActions,
    PanelBanner,
    PanelButton,
    PanelCrumbs,
    PanelEmpty,
    PanelProgress
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import CommentAction from "$app-views/categories/presentation-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/presentation-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/presentation-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/presentation-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/presentation-editor/components/element-paint.svelte";
  import PromptSettings from "$app-views/categories/presentation-editor/components/prompt-settings.svelte";
  import PromptScope from "$app-views/categories/presentation-editor/components/prompt-scope.svelte";
  import PromptTemplateSection from "$app-views/categories/presentation-editor/components/prompt-template-section.svelte";
  import TextSpacing from "$app-views/categories/presentation-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import {
    promptBlockIn,
    promptElementIn,
    promptSlotOps,
    promptScopeOps,
    type LinkedPromptBlock
  } from "$app-views/categories/presentation-editor/procedures/prompt-blocks";
  import {
    selectedIds,
    slideSignal
  } from "$app-views/categories/presentation-editor/procedures/selecting";
  import {
    PromptBlockState,
    type PromptBlockPhase
  } from "$app-views/categories/presentation-editor/inspector/prompt-block.state.svelte";
  import { createPromptBlock } from "$app-views/categories/presentation-editor/procedures/create-prompt-block";
  import { synchronizePromptBlockDraft } from "$app-views/categories/presentation-editor/procedures/effects/prompt-block-draft.svelte";
  import { setPromptDefinition } from "$app-views/categories/presentation-editor/procedures/set-prompt-definition";
  import {
    resourceTemplate,
    stageIn
  } from "$app-views/categories/presentation-editor/procedures/templating";
  import { workspaceState } from "$model/client/workspace-state";

  const PHASE: Record<PromptBlockPhase, string> = {
    creating: "Creating Derived Output",
    saving: "Saving Prompt Block",
    generating: "Generating response"
  };

  const view = workspaceState();
  const presentationId = view.active.resourceId;

  const runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  const state = new PromptBlockState();
  const templateQuery = $derived(
    presentationId === undefined ? undefined : resourceTemplate(presentationId)
  );
  const templateStage = $derived(
    stageIn(templateQuery?.ready ? templateQuery.current : undefined)
  );

  const body = $derived(runtime?.body);
  const elementId = $derived(selectedIds(view.selection)[0] ?? "");
  const element = $derived(
    body === undefined || elementId === "" ? undefined : promptElementIn(body, elementId)
  );
  const block = $derived(element?.content.type === "prompt" ? element.content.block : undefined);
  const linked = $derived(
    block?.derivedOutputId === undefined ? undefined : (block as LinkedPromptBlock)
  );
  const slide = $derived(
    body === undefined || element === undefined ? undefined : slideHolding(body, element.id)
  );
  const position = $derived(
    body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1
  );

  const confirmScope = (next: unknown) => {
    if (block === undefined || runtime === undefined) return;
    const ops = promptScopeOps(block, next);
    if (ops.length > 0) runtime.apply(ops);
  };

  synchronizePromptBlockDraft(state, () => block);

  const create = () => createPromptBlock({
    blockId: block?.id ?? "",
    presentationId,
    runtime,
    state
  });
</script>

<Panel title="Prompt block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Presentation" },
        { label: `Slide ${position}`, key: "presentation-editor.slide" },
        { label: "Prompt block" }
      ]}
      onnavigate={() => {
        if (slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection);
      }}
    />
  {/snippet}

  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element === undefined || block === undefined || runtime === undefined}
    <PanelEmpty title="Pick a Prompt Block on the slide" />
  {:else}
    {#if state.phase !== undefined}
      <PanelProgress label={PHASE[state.phase]} tone="intelligence" />
    {/if}

    {#if state.actionError !== undefined}
      <PanelBanner title="This Prompt Block needs attention" tone="attention">
        {state.actionError}. The text box remains editable so you can try again.
      </PanelBanner>
    {/if}

    {#if linked === undefined}
      <div class="setup">
        <label for={`new-slide-prompt-${block.id}`}>Prompt</label>
        <Textarea
          id={`new-slide-prompt-${block.id}`}
          bind:value={state.promptDraft}
          oninput={(event) => setPromptDefinition({
            block,
            prompt: event.currentTarget.value,
            runtime
          })}
          rows={5}
          maxlength={8000}
          placeholder="What should this text box derive from project sources?"
          disabled={state.phase !== undefined}
        />

        <PromptScope
          blockId={block.id}
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

    {#if templateStage !== undefined}
      {#key linked?.derivedOutputId ?? "unlinked"}
        <PromptTemplateSection
          blockId={block.id}
          derivedOutputId={linked?.derivedOutputId}
          disabled={state.phase !== undefined}
        />
      {/key}
    {/if}

    <TextStyle blockId={block.id} whole wrapping />
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementOrder elementId={element.id} />
    <TextSpacing blockId={block.id} />
    <ElementEffects elementId={element.id} />
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
