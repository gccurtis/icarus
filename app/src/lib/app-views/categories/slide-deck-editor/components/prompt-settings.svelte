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
    evidenceTitles,
    resourceIndex
  } from "$app-views/categories/slide-deck-editor/procedures/resource-index";
  import {
    promptBlockIn,
    type Id,
    type LinkedPromptBlock
  } from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
  import PromptScope from "$app-views/categories/slide-deck-editor/components/prompt-scope.svelte";
  import { PromptSettingsState } from "$app-views/categories/slide-deck-editor/components/prompt-settings.state.svelte";
  import { readPromptOutput } from "$app-views/categories/slide-deck-editor/procedures/read-prompt-output";
  import { setPromptScope } from "$app-views/categories/slide-deck-editor/procedures/set-prompt-scope";
  import { refreshPromptBlock } from "$app-views/categories/slide-deck-editor/procedures/refresh-prompt-block";
  import { synchronizePromptSettings } from "$app-views/categories/slide-deck-editor/procedures/effects/prompt-settings.svelte";
  import { publishesPromptOutput } from "$app-views/categories/slide-deck-editor/procedures/effects/publishes-prompt-output.svelte";
  import { publishPromptOutput } from "$app-views/categories/slide-deck-editor/procedures/publish-prompt-output";
  import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";
  import {
    compactEvidenceSourceTitle,
    exactEvidenceText
  } from "$app-views/categories/slide-deck-editor/procedures/evidence";
  import { workspaceState } from "$model/client/workspace-state";
  import { isExternalFileResourceKind } from "$representation/data/behavior/core/resource";
  import type { ResourceRef } from "$representation/data/types/core/resource";
  import type { SemanticCitation } from "$representation/data/types/semantic/derived-output";

  let {
    blockId,
    derivedOutputId
  }: { blockId: string; derivedOutputId: string } = $props();

  const outputId = $derived(derivedOutputId as Id<"derivedOutputs">);
  const view = workspaceState();
  const deckId = view.active.resourceId;

  const runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  const state = new PromptSettingsState();

  const held = $derived(
    runtime?.body === undefined ? undefined : promptBlockIn(runtime.body, blockId)
  );
  const block = $derived(
    held?.derivedOutputId === outputId ? (held as LinkedPromptBlock) : undefined
  );

  // A keyed component instance belongs to one immutable Derived Output identity.
  // svelte-ignore state_referenced_locally
  const detailQuery = readPromptOutput(outputId);
  const resources = resourceIndex();

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
  const busy = $derived(state.running || serverRefreshing);
  const definitionChanged = $derived(output !== undefined && state.promptDraft.trim() !== output.prompt);
  const responseChanged = $derived(output !== undefined && currentResponse !== storedResponse);
  const queryError = $derived(
    detailQuery.error === undefined ? undefined : String(detailQuery.error)
  );
  const refreshError = $derived(
    detail?.refresh.state === "failed" ? detail.refresh.error : undefined
  );
  const shownError = $derived(
    busy ? undefined : state.actionError ?? refreshError ?? output?.error ?? queryError
  );
  const sourceTitles = $derived(evidenceTitles(resources));

  synchronizePromptSettings({
    outputId: () => outputId,
    state,
    prompt: () => output?.prompt,
    refreshing: () => serverRefreshing,
    refresh: () => detailQuery.refresh()
  });
  publishesPromptOutput({
    output: () => output,
    publish: (current) => runtime === undefined
      ? Promise.resolve()
      : publishPromptOutput({ blockId, output: current, runtime }),
    fail: (error) => state.fail(error)
  });

  const setScope = (next: unknown) => setPromptScope({
    busy,
    outputId,
    outputPrompt: output?.prompt,
    next,
    state,
    refresh: () => detailQuery.refresh()
  });

  const generate = () => refreshPromptBlock({
    busy,
    block,
    blockId,
    output,
    outputId,
    currentResponse,
    definitionChanged,
    responseChanged,
    runtime,
    state
  });

  const sourceTitle = (citation: SemanticCitation, ref: ResourceRef): string =>
    compactEvidenceSourceTitle(
      sourceTitles.get(`${ref.kind}:${ref.id}`) ??
      (citation.evidenceKind === "text" ? "Open source" : citation.material.name)
    );

  const citationRef = (citation: SemanticCitation): ResourceRef =>
    citation.evidenceKind === "text"
      ? citation.source.ref
      : citation.material.placement?.ref ?? citation.material.source.ref;

  const citationKey = (citation: SemanticCitation): string => {
    if (citation.evidenceKind === "text") {
      return `text:${citation.source.ref.kind}:${citation.source.ref.id}:${citation.span.from}`;
    }
    return `${citation.evidenceKind}:${citation.material.materialId}:${JSON.stringify(citation.evidenceKind === "descriptor" ? citation.facet : citation.selection)}`;
  };

  const citationLabel = (citation: SemanticCitation): string => {
    if (citation.evidenceKind === "text") return exactEvidenceText(citation);
    if (citation.evidenceKind === "descriptor") return citation.text;
    if (citation.evidenceKind === "visual") {
      return `Original image${citation.selection.kind === "image" && citation.selection.crop !== undefined ? " crop" : ""}`;
    }
    if (citation.evidenceKind === "code") return String(citation.value);
    const value = JSON.stringify(citation.value);
    return value.length > 800 ? `${value.slice(0, 797)}…` : value;
  };

  const citationKind = (citation: SemanticCitation): string => {
    if (citation.evidenceKind === "text") return "Exact text";
    if (citation.evidenceKind === "descriptor") return "Interpreted summary";
    if (citation.evidenceKind === "visual") return "Visual evidence";
    if (citation.evidenceKind === "code") return "Exact code";
    return "Structured evidence";
  };

  const openSource = (kind: ResourceRef["kind"], id: string) => {
    if (kind === "document") view.open({ category: "document-editor", resourceId: id });
    else if (kind === "slides") view.open({ category: "slide-deck-editor", resourceId: id });
    else if (kind === "spreadsheet") view.open({ category: "spreadsheet-editor", resourceId: id });
    else if (isExternalFileResourceKind(kind)) inspectExternalFile(view, id);
  };
</script>

{#if !detailQuery.ready}
  <PanelProgress label="Loading Prompt Block" />
{:else if block === undefined || runtime === undefined}
  <PanelBanner title="The Prompt Block is missing" tone="attention">
    The slide deck no longer contains the Prompt Block linked to this Derived Output.
  </PanelBanner>
{:else if output === undefined}
  <PanelBanner title="The Derived Output is missing" tone="attention">
    This text box still holds its ID, but its generated resource could not be found.
  </PanelBanner>
{:else}
  <div class="settings">
    <label for={`slide-prompt-${blockId}`}>Prompt</label>
    <Textarea
      id={`slide-prompt-${blockId}`}
      bind:value={state.promptDraft}
      rows={5}
      maxlength={8000}
      disabled={state.running}
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
      disabled={busy || state.promptDraft.trim().length === 0}
      title={busy ? "A shared refresh is already in progress" : "Refresh from project sources"}
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
