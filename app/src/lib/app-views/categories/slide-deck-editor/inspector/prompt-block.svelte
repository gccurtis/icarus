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
  import {
    createDerivedOutput,
    refreshDerivedOutput,
    updateDerivedOutput
  } from "$capabilities/derived-output/index.remote";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import PromptSettings from "$app-views/categories/slide-deck-editor/components/prompt-settings.svelte";
  import {
    builderView,
    defaultScopeOf,
    draftOf,
    narrowed,
    nextHoleName,
    offeringOf,
    projectResources,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn,
    termFor,
    withTerm,
    withWholeProject,
    withoutTerm,
    type OfferSource,
    type ScopeDraft,
    type ScopeSide
  } from "$app-views/categories/slide-deck-editor/procedures/templating";
  import { OverlayModal } from "$authored-components/overlay";
  import { PromptTemplate } from "$authored-components/prompt-template";
  import { ScopeBuilder } from "$authored-components/scope-builder";
  import TextSpacing from "$app-views/categories/slide-deck-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import {
    slideHolding,
    slideIndexOf
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import {
    linkPromptBlockOps,
    promptBlockIn,
    promptElementIn,
    promptHoleOps,
    promptScopeOps,
    syncPromptBlockOps,
    type Id,
    type LinkedPromptBlock
  } from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
  import {
    selectedIds,
    slideSignal
  } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { announcePromptOutput } from "$app-views/categories/slide-deck-editor/procedures/prompt-output-events";
  import {
    workspaceState,
    type SlideDeckRuntime
  } from "$model/client/workspace-state";

  type Phase = "creating" | "saving" | "generating";

  const PHASE: Record<Phase, string> = {
    creating: "Creating Derived Output",
    saving: "Saving Prompt Block",
    generating: "Generating response"
  };

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  let promptDraft = $state("");
  let draftedFor = $state("");
  let phase = $state<Phase>();
  let actionError = $state<string>();

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

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

  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));

  const offered = $derived(body === undefined ? "Hole 1" : nextHoleName(body));
  const named = $derived(block?.hole);
  const reads = $derived(ruleOf(defaultScopeOf(block?.scope), setNames));

  let contextOpen = $state(false);
  let draft = $state<ScopeDraft>(draftOf(undefined));
  const view$ = $derived(builderView(draft, offering));
  const scopeBlocked = $derived(
    draft.include.length === 0 ? "Include something, or choose everything in the project." : undefined
  );

  const write = (ops: readonly unknown[]) => {
    if (runtime === undefined || ops.length === 0) return;
    runtime.apply(ops as Parameters<SlideDeckRuntime["apply"]>[0]);
  };

  const make = () => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name: offered }));
  };

  const rename = (name: string) => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name, description: named?.description }));
  };

  const describe = (description: string) => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name: named?.name ?? offered, description }));
  };

  const openContext = () => {
    draft = draftOf(block?.scope);
    contextOpen = true;
  };

  const confirmContext = () => {
    if (block === undefined) return;
    write(promptScopeOps(block, narrowed(draft) ?? draft));
    contextOpen = false;
  };

  $effect(() => {
    const current = block;
    if (current === undefined || current.id === draftedFor) return;
    draftedFor = current.id;
    promptDraft = "";
    actionError = undefined;
  });

  const currentPrompt = (currentRuntime: SlideDeckRuntime) => {
    const currentBody = currentRuntime.body;
    if (currentBody === undefined) throw new Error("The slide deck is not loaded");
    const current = promptBlockIn(currentBody, block?.id ?? "");
    if (current === undefined) throw new Error("The Prompt Block is no longer in the slide deck");
    return current;
  };

  const saveFailed = (current: SlideDeckRuntime): boolean => current.sync === "error";

  const create = async () => {
    const currentRuntime = runtime;
    const promptText = promptDraft.trim();
    if (
      currentRuntime === undefined ||
      deckId === undefined ||
      promptText.length === 0 ||
      phase !== undefined
    ) return;
    const previous = currentPrompt(currentRuntime).display;

    phase = "creating";
    actionError = undefined;
    let derivedOutputId: Id<"derivedOutputs"> | undefined;

    try {
      const created = await createDerivedOutput({
        prompt: promptText,
        origin: { kind: "slides", id: deckId }
      });
      derivedOutputId = created._id;
      const seeded = previous.length === 0
        ? created
        : await updateDerivedOutput({
            derivedOutputId: created._id,
            prompt: promptText,
            lastResponse: previous
          });
      if (seeded === null) throw new Error("The Derived Output disappeared during creation");

      phase = "saving";
      const before = currentPrompt(currentRuntime);
      currentRuntime.apply([
        ...linkPromptBlockOps(before, created._id),
        ...syncPromptBlockOps(before, seeded)
      ]);
      await currentRuntime.flush();
      if (saveFailed(currentRuntime)) throw new Error("The Prompt Block link could not be saved");

      phase = "generating";
      const refreshed = await refreshDerivedOutput({ derivedOutputId: created._id });
      if (refreshed === null) throw new Error("The Derived Output disappeared during generation");
      const after = currentPrompt(currentRuntime);
      const ops = syncPromptBlockOps(after, refreshed.output);
      if (ops.length > 0) currentRuntime.apply(ops);
      await currentRuntime.flush();
      if (saveFailed(currentRuntime)) throw new Error("The generated slide text could not be saved");
      if (refreshed.outcome === "failed") {
        throw new Error(refreshed.output.error ?? "The response could not be generated");
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      if (derivedOutputId !== undefined) announcePromptOutput(derivedOutputId);
      phase = undefined;
    }
  };
</script>

<Panel title="Prompt block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Deck" },
        { label: `Slide ${position}`, key: "slide-deck-editor.slide" },
        { label: "Prompt block" }
      ]}
      onnavigate={() => {
        if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection);
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
    {#if phase !== undefined}
      <PanelProgress label={PHASE[phase]} tone="intelligence" />
    {/if}

    {#if actionError !== undefined}
      <PanelBanner title="This Prompt Block needs attention" tone="attention">
        {actionError}. The text box remains editable so you can try again.
      </PanelBanner>
    {/if}

    {#if linked === undefined}
      <div class="setup">
        <label for={`new-slide-prompt-${block.id}`}>Prompt</label>
        <Textarea
          id={`new-slide-prompt-${block.id}`}
          bind:value={promptDraft}
          rows={5}
          maxlength={8000}
          placeholder="What should this text box derive from project sources?"
          disabled={phase !== undefined}
        />

        <div class="scope">
          <span>Scope</span>
          <div class="scope-control">
            <PanelButton
              label={reads}
              disabled={phase !== undefined}
              title="Choose what this prompt reads"
              onclick={openContext}
            />
          </div>
        </div>
      </div>

      <PanelActions>
        <Button
          size="xs"
          disabled={phase !== undefined || promptDraft.trim().length === 0}
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

    <PromptTemplate
      name={named?.name}
      description={named?.description ?? ""}
      {offered}
      standing={reads}
      disabled={phase !== undefined}
      onmake={make}
      onname={rename}
      ondescription={describe}
    />

    <TextStyle blockId={block.id} whole wrapping />
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementOrder elementId={element.id} />
    <TextSpacing blockId={block.id} />
    <ElementEffects elementId={element.id} />
  {/if}
</Panel>

<OverlayModal
  bind:open={contextOpen}
  title="What this prompt reads"
  description="The sources it is answered from. If it is a hole, this is also what the hole selects until whoever places the template says otherwise."
  confirm="Set the scope"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={confirmContext}
>
  <ScopeBuilder
    {...view$}
    onmode={(whole) => (draft = whole ? withWholeProject() : { include: [], exclude: [] })}
    onadd={(side: ScopeSide, source: string, key: string) => {
      const term = termFor(source as OfferSource, key);
      if (term !== undefined) draft = withTerm(draft, side, term);
    }}
    ondrop={(side: ScopeSide, key: string) => (draft = withoutTerm(draft, side, key))}
    onclear={() => (draft = { include: [], exclude: [] })}
  />
</OverlayModal>

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .setup label,
  .scope span {
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

  .scope {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: 2rem;
  }

  .scope-control {
    width: 9.25rem;
  }
</style>
