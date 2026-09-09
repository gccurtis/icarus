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
  import {
    createDerivedOutput,
    refreshDerivedOutput,
    updateDerivedOutput
  } from "$capabilities/derived-output/index.remote";
  import PromptSettings from "$app-views/categories/document-editor/components/prompt-settings.svelte";
  import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
  import {
    linkPromptBlockOps,
    promptHoleOps,
    promptScopeOps,
    syncPromptBlockOps,
    type Id,
    type LinkedPromptBlock,
    type PromptBlock
  } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import {
    defaultScopeOf,
    nextHoleName,
    offeringOf,
    projectResources,
    readableScope,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn
  } from "$app-views/categories/document-editor/procedures/templating";
  import PromptScope from "$app-views/categories/document-editor/components/prompt-scope.svelte";
  import { PromptTemplate } from "$authored-components/prompt-template";
  import { announcePromptOutput } from "$app-views/categories/document-editor/procedures/prompt-output-events";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";
  type Phase = "creating" | "saving" | "generating";


  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  let promptDraft = $state("");
  let draftedFor = $state("");
  let phase = $state<Phase>();
  let actionError = $state<string>();

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const blockId = $derived(view.selection?.id ?? "");
  const held = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const prompt = $derived(held?.type === "prompt" ? held : undefined);
  const linked = $derived(
    prompt?.derivedOutputId === undefined ? undefined : (prompt as LinkedPromptBlock)
  );

  const PHASE: Record<Phase, string> = {
    creating: "Creating Derived Output",
    saving: "Saving Prompt Block",
    generating: "Generating response"
  };

  $effect(() => {
    const current = prompt;
    if (current === undefined || current.id === draftedFor) return;
    draftedFor = current.id;
    promptDraft = "";
    actionError = undefined;
  });

  const currentPrompt = (): PromptBlock => {
    const currentBody = runtime?.body;
    if (currentBody === undefined) throw new Error("The document is not loaded");
    const current = blockIn(currentBody, blockId);
    if (current?.type !== "prompt") throw new Error("The Prompt Block is no longer in the document");
    return current;
  };

  const failureDetail = (held: DocumentRuntime): string | undefined => held.failure?.detail;

  const create = async () => {
    const currentRuntime = runtime;
    const promptText = promptDraft.trim();
    if (currentRuntime === undefined || documentId === undefined || promptText.length === 0 || phase !== undefined) return;
    const previous = currentPrompt().display;

    phase = "creating";
    actionError = undefined;
    let derivedOutputId: Id<"derivedOutputs"> | undefined;

    try {
      const reading = readableScope(currentPrompt().scope);
      const created = await createDerivedOutput({
        prompt: promptText,
        origin: { kind: "document", id: documentId },
        ...(reading === undefined ? {} : { scope: reading })
      });
      derivedOutputId = created._id;
      const seeded =
        previous.length === 0
          ? created
          : await updateDerivedOutput({
              derivedOutputId: created._id,
              prompt: promptText,
              lastResponse: previous
            });
      if (seeded === null) throw new Error("The Derived Output disappeared during creation");

      phase = "saving";
      const before = currentPrompt();
      currentRuntime.apply([
        ...linkPromptBlockOps(before, created._id),
        ...syncPromptBlockOps(before, seeded)
      ]);
      await currentRuntime.flush();
      const linkFailure = failureDetail(currentRuntime);
      if (linkFailure !== undefined) throw new Error(linkFailure);

      phase = "generating";
      const refreshed = await refreshDerivedOutput({ derivedOutputId: created._id });
      if (refreshed === null) throw new Error("The Derived Output disappeared during generation");
      const after = currentPrompt();
      const ops = syncPromptBlockOps(after, refreshed.output);
      if (ops.length > 0) currentRuntime.apply(ops);
      await currentRuntime.flush();
      const responseFailure = failureDetail(currentRuntime);
      if (responseFailure !== undefined) throw new Error(responseFailure);
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

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };

  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));

  const offered = $derived(body === undefined ? "Hole 1" : nextHoleName(body));
  const named = $derived(prompt?.hole);
  const reads = $derived(ruleOf(defaultScopeOf(prompt?.scope), setNames));

  const write = (ops: readonly unknown[]) => {
    if (runtime === undefined || ops.length === 0) return;
    runtime.apply(ops as Parameters<DocumentRuntime["apply"]>[0]);
  };

  const make = () => {
    if (prompt === undefined) return;
    write(promptHoleOps(prompt, { name: offered }));
  };

  const rename = (name: string) => {
    if (prompt === undefined) return;
    write(promptHoleOps(prompt, { name, description: named?.description }));
  };

  const describe = (description: string) => {
    if (prompt === undefined) return;
    write(promptHoleOps(prompt, { name: named?.name ?? offered, description }));
  };

  const confirmScope = (next: unknown) => {
    if (prompt === undefined) return;
    write(promptScopeOps(prompt, next));
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
    {#if phase !== undefined}
      <div class="pt-2">
        <PanelProgress label={PHASE[phase]} tone="intelligence" />
      </div>
    {/if}

    {#if actionError !== undefined}
      <div class="pt-2">
        <PanelBanner title="This Prompt Block needs attention" tone="attention">
          {actionError}. The block remains available so you can try again.
        </PanelBanner>
      </div>
    {/if}

    {#if linked === undefined}
      <div class="setup">
        <label for={`new-prompt-${prompt.id}`}>Prompt</label>
        <Textarea
          id={`new-prompt-${prompt.id}`}
          bind:value={promptDraft}
          rows={5}
          maxlength={8000}
          placeholder="What should this block derive from project sources?"
          disabled={phase !== undefined}
        />

        <PromptScope
          blockId={prompt.id}
          disabled={phase !== undefined}
          onconfirm={confirmScope}
        />
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
