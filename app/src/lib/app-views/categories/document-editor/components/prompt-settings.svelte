<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    PanelActions,
    PanelBanner,
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
  import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
  import {
    announcePromptOutput,
    observePromptOutput
  } from "$app-views/categories/document-editor/procedures/prompt-output-events";
  import {
    compactEvidenceSourceTitle,
    exactEvidenceText
  } from "$app-views/categories/document-editor/procedures/evidence";
  import {
    promptScopeOps,
    syncPromptBlockOps,
    type Id,
    type LinkedPromptBlock,
    type PromptBlock
  } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import { readableScope } from "$app-views/categories/document-editor/procedures/templating";
  import PromptScope from "$app-views/categories/document-editor/components/prompt-scope.svelte";
  import { rowsOf, tableQuery } from "$app-views/categories/document-editor/procedures/store";
  import { workspaceState, type DocumentRuntime } from "$model/client/workspace-state";
  import type { ResourceRef } from "$representation/data/types/core/resource";
  import type { SemanticCitation } from "$representation/data/types/semantic/derived-output";
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
  const documentsQuery = tableQuery("documents");
  const slideDecksQuery = tableQuery("slideDecks");
  const spreadsheetsQuery = tableQuery("spreadsheets");

  let running = $state(false);
  let actionError = $state<string>();
  let promptDraft = $state("");
  let hydratedPrompt = $state<string>();
  let migrated = $state(false);

  const detail = $derived(detailQuery.ready ? detailQuery.current : undefined);
  const output = $derived(detail?.output);
  const storedResponse = $derived(
    output?.lastResponse?.type === "text" ? output.lastResponse.display : ""
  );
  const currentResponse = $derived(block?.display ?? "");
  const refreshState = $derived(detail?.refresh.state ?? "idle");
  const serverRefreshing = $derived(
    refreshState === "queued" || refreshState === "running"
  );
  const busy = $derived(running || serverRefreshing);
  const definitionChanged = $derived(output !== undefined && promptDraft.trim() !== output.prompt);
  const responseChanged = $derived(output !== undefined && currentResponse !== storedResponse);
  const queryError = $derived(
    detailQuery.error === undefined ? undefined : String(detailQuery.error)
  );
  const refreshError = $derived(
    detail?.refresh.state === "failed" ? detail.refresh.error : undefined
  );
  const shownError = $derived(
    busy ? undefined : actionError ?? refreshError ?? output?.error ?? queryError
  );
  const sourceTitles = $derived.by(() => {
    const titles = new Map<string, string>();
    for (const document of rowsOf(documentsQuery, "documents")) {
      titles.set(`document:${document._id}`, document.title);
    }
    for (const deck of rowsOf(slideDecksQuery, "slideDecks")) {
      titles.set(`slides:${deck._id}`, deck.title);
    }
    for (const sheet of rowsOf(spreadsheetsQuery, "spreadsheets")) {
      titles.set(`spreadsheet:${sheet._id}`, sheet.title);
    }
    return titles;
  });

  $effect(() => {
    const nextPrompt = output?.prompt;
    if (nextPrompt === undefined || nextPrompt === hydratedPrompt) return;
    // Accept a collaborator's server revision while this browser has no local
    // draft. Preserve an intentional local edit for the user's next refresh.
    if (hydratedPrompt === undefined || promptDraft === hydratedPrompt) {
      promptDraft = nextPrompt;
    }
    hydratedPrompt = nextPrompt;
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

  onMount(() => {
    const stopObserving = observePromptOutput(outputId, () => {
      void detailQuery.refresh();
    });
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (stopped) return;
      // Polling is the current collaboration transport. It discovers work
      // started by another browser and then tightens while that work is live.
      const delay = serverRefreshing ? 600 : 1_500;
      timer = setTimeout(async () => {
        try {
          await detailQuery.refresh();
        } catch {
          // The query object owns and exposes its error. Polling must continue
          // so a transient transport failure does not strand shared status.
        } finally {
          schedule();
        }
      }, delay);
    };
    schedule();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      stopObserving();
    };
  });

  const currentBlock = (): PromptBlock => {
    const currentRuntime = runtime;
    if (currentRuntime === undefined) throw new Error("The document is not loaded");
    const currentBody = currentRuntime.body;
    if (currentBody === undefined) throw new Error("The document is not loaded");
    const current = blockIn(currentBody, blockId);
    if (current?.type !== "prompt") throw new Error("The Prompt Block is no longer in the document");
    return current;
  };

  /**
   * One write, to the one thing that holds it.
   *
   * A linked prompt keeps no scope of its own, so there is nothing on the block
   * to keep in step: a failure leaves the old scope everywhere, and a second
   * editor changing it at the same time is one row's last write rather than two
   * halves that disagree.
   */
  const setScope = async (next: unknown) => {
    if (busy || output === undefined) return;
    const reading = readableScope(next);
    if (reading === undefined) return;
    running = true;
    actionError = undefined;
    try {
      const changed = await updateDerivedOutput({
        derivedOutputId: outputId,
        prompt: promptDraft.trim().length === 0 ? output.prompt : promptDraft.trim(),
        scope: reading
      });
      if (changed === null) throw new Error("The Derived Output no longer exists");
      await detailQuery.refresh();
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      announcePromptOutput(outputId);
      running = false;
    }
  };

  const generate = async () => {
    const prompt = promptDraft.trim();
    const currentRuntime = runtime;
    if (
      busy ||
      output === undefined ||
      block === undefined ||
      currentRuntime === undefined ||
      prompt.length === 0
    ) return;

    running = true;
    actionError = undefined;
    try {
      if (definitionChanged || responseChanged) {
        const changed = await updateDerivedOutput({
          derivedOutputId: outputId,
          prompt,
          ...(responseChanged
            ? { lastResponse: currentResponse.length === 0 ? null : currentResponse }
            : {})
        });
        if (changed === null) throw new Error("The Derived Output no longer exists");
      }

      const refreshed = await refreshDerivedOutput({
        derivedOutputId: outputId
      });
      if (refreshed === null) throw new Error("The Derived Output no longer exists");

      const ops = syncPromptBlockOps(currentBlock(), refreshed.output);
      if (ops.length > 0) currentRuntime.apply(ops);
      await currentRuntime.flush();
      if (currentRuntime.failure !== undefined) throw new Error(currentRuntime.failure.detail);
      if (refreshed.outcome === "failed") {
        throw new Error(refreshed.output.error ?? "The response could not be generated");
      }
      promptDraft = refreshed.output.prompt;
      hydratedPrompt = refreshed.output.prompt;
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    } finally {
      announcePromptOutput(outputId);
      running = false;
    }
  };

  const sourceTitle = (citation: SemanticCitation, ref: ResourceRef): string =>
    compactEvidenceSourceTitle(
      sourceTitles.get(`${ref.kind}:${ref.id}`) ??
      ("material" in citation ? citation.material.name : "Open source")
    );

  const citationRef = (citation: SemanticCitation): ResourceRef =>
    "span" in citation
      ? citation.source.ref
      : citation.material.placement?.ref ?? citation.material.source.ref;

  const citationKey = (citation: SemanticCitation): string => {
    if ("span" in citation) {
      return `text:${citation.source.ref.kind}:${citation.source.ref.id}:${citation.span.from}`;
    }
    return `${citation.evidenceKind}:${citation.material.materialId}:${JSON.stringify("facet" in citation ? citation.facet : citation.selection)}`;
  };

  const citationLabel = (citation: SemanticCitation): string => {
    if ("span" in citation) return exactEvidenceText(citation);
    if (citation.evidenceKind === "descriptor") return citation.text;
    if (citation.evidenceKind === "visual") return `Original image${citation.selection.kind === "image" && citation.selection.crop !== undefined ? " crop" : ""}`;
    if (citation.evidenceKind === "code") return String(citation.value);
    const value = JSON.stringify(citation.value);
    return value.length > 800 ? `${value.slice(0, 797)}…` : value;
  };

  const citationKind = (citation: SemanticCitation): string => {
    if ("span" in citation) return "Exact text";
    if (citation.evidenceKind === "descriptor") return "Interpreted summary";
    if (citation.evidenceKind === "visual") return "Visual evidence";
    if (citation.evidenceKind === "code") return "Exact code";
    return "Structured evidence";
  };

  const openSource = (kind: string, id: string) => {
    if (kind === "document") view.open({ category: "document-editor", resourceId: id });
    else if (kind === "slides") view.open({ category: "slide-deck-editor", resourceId: id });
    else if (kind === "spreadsheet") view.open({ category: "spreadsheet-editor", resourceId: id });
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

    <PromptScope {blockId} {derivedOutputId} disabled={busy} onconfirm={setScope} />
  </div>

  {#if shownError !== undefined}
    <PanelBanner title="This Prompt Block needs attention" tone="attention">
      {shownError}
    </PanelBanner>
  {/if}

  <PanelActions>
    <Button
      variant="outline"
      size="xs"
      disabled={busy || promptDraft.trim().length === 0}
      title="Refresh from project sources"
      onclick={generate}
    >
      <RefreshCw class={busy ? "spin" : undefined} aria-hidden="true" />
      Refresh
    </Button>
  </PanelActions>

  {#if busy}
    <PanelProgress
      label={refreshState === "queued" ? "Refresh queued" : "Reading project sources and generating"}
      tone="intelligence"
    />
  {/if}

  {#if output.evidence.length > 0}
    <PanelSection title="Evidence" open chevron="end">
      <div class="evidence">
        {#each output.evidence as citation (citationKey(citation))}
          {@const ref = citationRef(citation)}
          {@const label = citationLabel(citation)}
          <article>
            <small>{citationKind(citation)}</small>
            {#if label}<q>{label}</q>{/if}
            <button
              type="button"
              class="source-link"
              onclick={() => openSource(ref.kind, ref.id)}
            >{sourceTitle(citation, ref)}</button>
          </article>
        {/each}
      </div>
    </PanelSection>
  {/if}
{/if}

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .settings > label {
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

  .evidence q {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .evidence small {
    color: var(--token-ink-muted);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .source-link {
    width: fit-content;
    border: 0;
    background: transparent;
    color: var(--token-color-active-text);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 0.14em;
    cursor: pointer;
  }

  :global(.spin) {
    animation: turn 0.9s linear infinite;
  }

  @keyframes turn {
    to { transform: rotate(360deg); }
  }
</style>
