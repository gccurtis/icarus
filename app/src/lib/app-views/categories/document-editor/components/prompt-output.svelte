<script lang="ts">
  import { onMount } from "svelte";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { Button } from "$vendored-components/button";
  import {
    readDerivedOutput,
    readDerivedOutputValue,
    refreshDerivedOutput
  } from "$capabilities/derived-output/index.remote";
  import { processSemanticSyncQueue } from "$capabilities/semantic-overlay/index.remote";
  import {
    announcePromptOutput,
    observePromptOutput
  } from "$app-views/categories/document-editor/procedures/prompt-output-events";
  import type { Id } from "$representation/data/types/core/id";
  import type { DerivedState } from "$representation/data/types/semantic/derived-output";

  let {
    derivedOutputId,
    surface = "document"
  }: {
    derivedOutputId: Id<"derivedOutputs">;
    surface?: "document" | "inspector";
  } = $props();

  /*
   * These are the canonical reads. The Prompt Block itself carries no answer
   * cache, and command updates invalidate both projections together.
   */
  // This component is mounted for one immutable Prompt Block identity.
  // svelte-ignore state_referenced_locally
  const detailQuery = readDerivedOutput({ derivedOutputId });
  // svelte-ignore state_referenced_locally
  const valueQuery = readDerivedOutputValue({ derivedOutputId });

  let running: boolean = $state(false);
  let actionError: string | undefined = $state();

  const detail = $derived(detailQuery.ready ? detailQuery.current : undefined);
  const resolved = $derived(valueQuery.ready ? valueQuery.current : undefined);
  const output = $derived(detail?.output);
  const prompt = $derived(output?.prompt ?? "Loading prompt…");
  const value = $derived(resolved?.value ?? null);
  const evidence = $derived(resolved?.evidence ?? []);
  const status = $derived<DerivedState>(
    running ? "generating" : (resolved?.state ?? detail?.effectiveState ?? output?.state ?? "idle")
  );
  const queryError = $derived(detailQuery.error ?? valueQuery.error);
  const shownError = $derived(
    actionError ?? output?.error ?? (queryError === undefined ? undefined : String(queryError))
  );

  const LABEL: Record<DerivedState, string> = {
    idle: "Ready",
    generating: "Generating",
    fresh: "Current",
    stale: "Needs refresh",
    error: "Could not generate"
  };

  const actionLabel = $derived(
    status === "idle" ? "Generate" : status === "error" ? "Try again" : "Refresh"
  );

  const reload = () => Promise.all([detailQuery.refresh(), valueQuery.refresh()]);

  onMount(() =>
    observePromptOutput(derivedOutputId, () => {
      void reload();
    })
  );

  const generate = async () => {
    if (running) return;
    running = true;
    actionError = undefined;

    try {
      const queue = await processSemanticSyncQueue({ limit: 50 });
      const failed = queue.processed.find((job) => job.error !== undefined);
      if (failed?.error !== undefined) throw new Error(failed.error);

      const refreshed = await refreshDerivedOutput({ derivedOutputId }).updates(
        detailQuery,
        valueQuery
      );
      if (refreshed === null) throw new Error("The Derived Output no longer exists");
      if (refreshed.outcome === "failed") {
        throw new Error(refreshed.output.error ?? "The response could not be generated");
      }
      announcePromptOutput(derivedOutputId);
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
      announcePromptOutput(derivedOutputId);
    } finally {
      running = false;
    }
  };

  const sourceLabel = (index: number): string => {
    const source = evidence[index]?.source;
    return source === undefined ? "Source" : `${source.ref.kind} · ${source.ref.id}`;
  };
</script>

<section
  class="prompt-output"
  class:inspector={surface === "inspector"}
  data-derived-output={derivedOutputId}
  data-state={status}
  aria-label="Derived output"
>
  <header>
    <span class="kind"><Sparkles size={13} aria-hidden="true" /> Prompt block</span>
    <span class="state">{LABEL[status]}</span>
  </header>

  <p class="prompt">{prompt}</p>

  <div class="answer" aria-live="polite">
    {#if status === "generating"}
      <span class="placeholder">Reading project sources and composing the response…</span>
    {:else if value !== null}
      <p>{value}</p>
    {:else if shownError !== undefined}
      <span class="failure">{shownError}</span>
    {:else if detailQuery.ready && valueQuery.ready}
      <span class="placeholder">Generate this block to resolve its value from project sources.</span>
    {:else}
      <span class="placeholder">Resolving this Derived Output…</span>
    {/if}
  </div>

  <footer>
    <span class="facts">
      {#if resolved?.revision !== null && resolved?.revision !== undefined}
        revision {resolved.revision}
      {:else}
        no revision
      {/if}
      <i aria-hidden="true"></i>
      {evidence.length} evidence {evidence.length === 1 ? "source" : "sources"}
    </span>
    <Button
      variant={status === "idle" ? "default" : "outline"}
      size="xs"
      disabled={running || output?.state === "generating"}
      onclick={generate}
    >
      <RefreshCw class={running ? "spin" : undefined} aria-hidden="true" />
      {actionLabel}
    </Button>
  </footer>

  {#if surface === "inspector"}
    <dl class="identity">
      <dt>Derived Output ID</dt>
      <dd>{derivedOutputId}</dd>
      {#if output?.lastGeneration !== undefined}
        <dt>Overlay generation</dt>
        <dd>{output.lastGeneration}</dd>
      {/if}
    </dl>

    {#if evidence.length > 0}
      <div class="evidence">
        <h3>Evidence</h3>
        {#each evidence as citation, index (`${citation.source.ref.kind}:${citation.source.ref.id}:${citation.span.from}`)}
          <article>
            <span>{sourceLabel(index)}</span>
            <q>{citation.span.text}</q>
            <code>{citation.selections.map((selection) => selection.evidenceId).join(", ")}</code>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .prompt-output {
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--token-color-intelligence-border);
    border-radius: var(--token-radius-panel);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--token-color-intelligence-surface) 86%, transparent), transparent 72%),
      var(--token-surface-elevated);
    color: var(--token-ink-primary);
    white-space: normal;
  }

  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  header {
    border-bottom: 1px solid color-mix(in srgb, var(--token-color-intelligence-border) 62%, transparent);
  }

  .kind {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.25);
    color: var(--token-color-intelligence-text);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .state {
    border-radius: 999px;
    background: color-mix(in srgb, var(--token-color-intelligence-fill) 12%, transparent);
    color: var(--token-color-intelligence-text);
    padding: 0.05rem 0.45rem;
    font-size: 0.6875rem;
    line-height: 1.1rem;
  }

  [data-state="error"] .state {
    background: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
  }

  [data-state="stale"] .state {
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .prompt {
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .answer {
    min-height: 2.75rem;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3)
      calc(var(--token-spacing-unit) * 3);
    font-family: var(--token-font-serif);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
  }

  .answer p {
    margin: 0;
    white-space: pre-wrap;
  }

  .placeholder {
    color: var(--token-ink-muted);
    font-family: var(--token-font-sans);
    font-size: var(--token-text-body-sm);
    font-style: italic;
  }

  .failure {
    color: var(--token-color-danger-text);
    font-family: var(--token-font-sans);
    font-size: var(--token-text-body-sm);
  }

  footer {
    border-top: 1px solid color-mix(in srgb, var(--token-color-intelligence-border) 45%, transparent);
  }

  .facts {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.65625rem;
  }

  .facts i {
    width: 3px;
    height: 3px;
    flex: none;
    border-radius: 999px;
    background: currentColor;
  }

  :global(.spin) {
    animation: turn 0.9s linear infinite;
  }

  .inspector {
    margin: 0 calc(var(--token-spacing-unit) * 3);
    width: calc(100% - var(--token-spacing-unit) * 6);
  }

  .inspector .prompt,
  .inspector .answer {
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .inspector footer {
    align-items: stretch;
    flex-direction: column;
  }

  .inspector footer :global(button) {
    align-self: flex-end;
  }

  .inspector .facts {
    white-space: nowrap;
  }

  .identity {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid color-mix(in srgb, var(--token-color-intelligence-border) 45%, transparent);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .identity dt {
    color: var(--token-ink-muted);
  }

  .identity dd {
    min-width: 0;
    overflow: hidden;
    margin: 0;
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inspector .identity {
    grid-template-columns: minmax(0, 1fr);
  }

  .inspector .identity dt:not(:first-child) {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .evidence {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 3);
  }

  .evidence h3 {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 600;
  }

  .evidence article {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    border-left: 2px solid var(--token-color-intelligence-border);
    padding-left: calc(var(--token-spacing-unit) * 2);
  }

  .evidence article span,
  .evidence article code {
    overflow: hidden;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.65625rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .evidence q {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  @keyframes turn {
    to { transform: rotate(360deg); }
  }
</style>
