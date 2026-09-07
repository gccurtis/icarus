<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    PanelActions,
    PanelBanner,
    PanelField,
    PanelFields,
    PanelNote,
    PanelProgress,
    PanelSection
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import {
    readDerivedOutput,
    refreshDerivedOutput,
    updateDerivedOutput
  } from "$capabilities/derived-output/index.remote";
  import { processSemanticSyncQueue } from "$capabilities/semantic-overlay/index.remote";
  import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
  import {
    announcePromptOutput,
    observePromptOutput
  } from "$app-views/categories/document-editor/procedures/prompt-output-events";
  import {
    syncPromptBlockOps,
    type Id,
    type LinkedPromptBlock,
    type PromptBlock
  } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import { workspaceState, type DocumentRuntime } from "$model/client/workspace-state";
  import type { DerivedState } from "$representation/data/types/semantic/derived-output";
  import { onMount } from "svelte";

  let {
    blockId,
    derivedOutputId
  }: { blockId: string; derivedOutputId: string } = $props();
  const outputId = $derived(derivedOutputId as Id<"derivedOutputs">);

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const held = $derived(
    runtime?.body === undefined ? undefined : blockIn(runtime.body, blockId)
  );
  const block = $derived(
    held?.type === "prompt" && held.derivedOutputId === outputId
      ? (held as LinkedPromptBlock)
      : undefined
  );

  // One settings instance belongs to one immutable Derived Output identity.
  // svelte-ignore state_referenced_locally
  const detailQuery = readDerivedOutput({ derivedOutputId: outputId });

  let running = $state(false);
  let actionError = $state<string>();
  let promptDraft = $state("");
  let hydrated = $state(false);
  let migrated = $state(false);

  const detail = $derived(detailQuery.ready ? detailQuery.current : undefined);
  const output = $derived(detail?.output);
  const storedResponse = $derived(
    output?.lastResponse?.type === "text" ? output.lastResponse.display : ""
  );
  const normalizedBlock = $derived(block?.display.replace(/\s+/g, " ").trim() ?? "");
  const definitionChanged = $derived(output !== undefined && promptDraft.trim() !== output.prompt);
  const responseChanged = $derived(output !== undefined && normalizedBlock !== storedResponse);
  const status = $derived<DerivedState>(
    running
      ? "generating"
      : definitionChanged || responseChanged || block?.state === "stale"
        ? "stale"
        : (detail?.effectiveState ?? output?.state ?? block?.state ?? "idle")
  );
  const needsRefresh = $derived(
    output !== undefined && (definitionChanged || responseChanged || status !== "fresh")
  );
  const queryError = $derived(
    detailQuery.error === undefined ? undefined : String(detailQuery.error)
  );
  const shownError = $derived(actionError ?? output?.error ?? queryError);

  const LABEL: Record<DerivedState, string> = {
    idle: "Not generated",
    generating: "Generating",
    fresh: "Current",
    stale: "Needs refresh",
    error: "Needs attention"
  };

  $effect(() => {
    if (output === undefined || hydrated) return;
    promptDraft = output.prompt;
    hydrated = true;
  });

  // Blocks created by the earlier live-card prototype migrate when inspected.
  $effect(() => {
    const held = output;
    const currentBlock = block;
    const currentRuntime = runtime;
    if (
      migrated ||
      held?.lastResponse?.type !== "text" ||
      currentBlock === undefined ||
      currentRuntime === undefined ||
      currentBlock.display.length > 0 ||
      currentBlock.state !== "idle"
    ) {
      return;
    }
    migrated = true;
    const currentBody = currentRuntime.body;
    if (currentBody === undefined) return;
    const current = blockIn(currentBody, blockId);
    if (current?.type !== "prompt") return;
    const ops = syncPromptBlockOps(current, held);
    if (ops.length === 0) return;
    currentRuntime.apply(ops);
    void currentRuntime.flush();
  });

  onMount(() =>
    observePromptOutput(outputId, () => {
      void detailQuery.refresh();
    })
  );

  const currentBlock = (): PromptBlock => {
    const currentRuntime = runtime;
    if (currentRuntime === undefined) throw new Error("The document is not loaded");
    const currentBody = currentRuntime.body;
    if (currentBody === undefined) throw new Error("The document is not loaded");
    const current = blockIn(currentBody, blockId);
    if (current?.type !== "prompt") throw new Error("The Prompt Block is no longer in the document");
    return current;
  };

  const generate = async () => {
    const prompt = promptDraft.trim();
    const currentRuntime = runtime;
    if (
      running ||
      output === undefined ||
      block === undefined ||
      currentRuntime === undefined ||
      prompt.length === 0 ||
      !needsRefresh
    ) return;

    running = true;
    actionError = undefined;
    try {
      if (definitionChanged || responseChanged) {
        const changed = await updateDerivedOutput({
          derivedOutputId: outputId,
          prompt,
          ...(responseChanged
            ? { lastResponse: normalizedBlock.length === 0 ? null : normalizedBlock }
            : {})
        }).updates(detailQuery);
        if (changed === null) throw new Error("The Derived Output no longer exists");
      }

      const queue = await processSemanticSyncQueue({ limit: 50 });
      const failed = queue.processed.find((job) => job.error !== undefined);
      if (failed?.error !== undefined) throw new Error(failed.error);

      const refreshed = await refreshDerivedOutput({
        derivedOutputId: outputId
      }).updates(detailQuery);
      if (refreshed === null) throw new Error("The Derived Output no longer exists");

      const ops = syncPromptBlockOps(currentBlock(), refreshed.output);
      if (ops.length > 0) currentRuntime.apply(ops);
      await currentRuntime.flush();
      if (currentRuntime.failure !== undefined) throw new Error(currentRuntime.failure.detail);
      if (refreshed.outcome === "failed") {
        throw new Error(refreshed.output.error ?? "The response could not be generated");
      }
      promptDraft = refreshed.output.prompt;
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      announcePromptOutput(outputId);
      running = false;
    }
  };

  const sourceLabel = (index: number): string => {
    const source = output?.evidence[index]?.source;
    return source === undefined ? "Source" : `${source.ref.kind} · ${source.ref.id}`;
  };
</script>

{#if !detailQuery.ready}
  <PanelProgress label="Loading Prompt Block" />
{:else if block === undefined || runtime === undefined}
  <PanelBanner title="The Prompt Block is missing" tone="attention">
    The document no longer contains the Prompt Block linked to this Derived Output.
  </PanelBanner>
{:else if output === undefined}
  <PanelBanner title="The Derived Output is missing" tone="attention">
    This block still holds its ID, but its generated resource could not be found.
  </PanelBanner>
{:else}
  <div class="settings">
    <label for={`prompt-${blockId}`}>Prompt</label>
    <Textarea
      id={`prompt-${blockId}`}
      bind:value={promptDraft}
      rows={5}
      maxlength={8000}
      disabled={running}
    />

    <div class="scope">
      <span>Resource Set</span>
      <strong>Whole project</strong>
      <small>Saved Resource Set selection is a later control.</small>
    </div>

    <div class="status-line" data-state={status}>
      <span>{LABEL[status]}</span>
      {#if output.lastRevision !== undefined}<code>revision {output.lastRevision}</code>{/if}
    </div>
  </div>

  <PanelNote>
    The text in the document is the current response. Edit and format it there; text edits become
    the previous response supplied for continuity on the next refresh.
  </PanelNote>

  {#if shownError !== undefined}
    <PanelBanner title="This Prompt Block needs attention" tone="attention">
      {shownError}
    </PanelBanner>
  {/if}

  <PanelActions>
    <Button
      variant="outline"
      size="xs"
      disabled={running || promptDraft.trim().length === 0 || !needsRefresh}
      title={!needsRefresh ? "The response is current" : "Refresh from project sources"}
      onclick={generate}
    >
      <RefreshCw class={running ? "spin" : undefined} aria-hidden="true" />
      Refresh
    </Button>
  </PanelActions>

  {#if running}
    <PanelProgress label="Reading project sources and generating" tone="intelligence" />
  {/if}

  {#if output.evidence.length > 0}
    <PanelSection title="Evidence" count={output.evidence.length} open chevron="end">
      <div class="evidence">
        {#each output.evidence as citation, index (`${citation.source.ref.kind}:${citation.source.ref.id}:${citation.span.from}`)}
          <article>
            <code>{sourceLabel(index)}</code>
            <q>{citation.span.text}</q>
            <small>{citation.span.from}–{citation.span.to} · {citation.selections.map((selection) => selection.evidenceId).join(", ")}</small>
          </article>
        {/each}
      </div>
    </PanelSection>
  {/if}

  <PanelSection title="Details" chevron="end">
    <PanelFields>
      <PanelField label="Derived Output ID" mono stacked>{derivedOutputId}</PanelField>
      {#if output.lastGeneration !== undefined}
        <PanelField label="Overlay generation" mono stacked>{output.lastGeneration}</PanelField>
      {/if}
    </PanelFields>
  </PanelSection>
{/if}

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .settings > label,
  .scope > span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .settings :global(textarea) {
    min-height: 7rem;
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .scope {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.15rem calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
  }

  .scope strong {
    color: var(--token-ink-primary);
    font-size: var(--token-text-caption);
    font-weight: 500;
  }

  .scope small {
    grid-column: 1 / -1;
    color: var(--token-ink-muted);
    font-size: 0.6875rem;
  }

  .status-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .status-line > span {
    color: var(--token-color-intelligence-text);
    font-weight: 600;
  }

  .status-line[data-state="error"] > span {
    color: var(--token-color-danger-text);
  }

  .status-line[data-state="stale"] > span {
    color: var(--token-color-attention-text);
  }

  .status-line code,
  .evidence code,
  .evidence small {
    font-family: var(--token-font-mono);
    font-size: 0.65625rem;
  }

  .evidence {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 3);
  }

  .evidence article {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    border-left: 2px solid var(--token-color-intelligence-border);
    padding-left: calc(var(--token-spacing-unit) * 2);
  }

  .evidence code,
  .evidence small {
    overflow: hidden;
    color: var(--token-ink-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .evidence q {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  :global(.spin) {
    animation: turn 0.9s linear infinite;
  }

  @keyframes turn {
    to { transform: rotate(360deg); }
  }
</style>
