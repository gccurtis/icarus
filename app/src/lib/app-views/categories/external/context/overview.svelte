<script lang="ts">
  import { Panel, PanelBanner, PanelSkeleton } from "$authored-components/panel";
  import {
    bytesLabel,
    externalFileLibrary,
    externalFilesIn
  } from "$app-views/categories/external/procedures";

  const library = externalFileLibrary();
  const files = $derived(externalFilesIn(library.ready ? library.current : undefined, Date.now()));
  const knownBytes = $derived(files.reduce((total, file) => total + file.size, 0));
  const ready = $derived(files.filter((file) => file.semanticTone === "current").length);
  const processing = $derived(files.filter((file) => file.semanticTone === "queued").length);
  const attention = $derived(files.filter((file) => file.semanticTone === "failed").length);
</script>

<Panel title="Overview">
  {#if library.error}
    <PanelBanner title="External Files unavailable" tone="danger">
      {library.error instanceof Error ? library.error.message : String(library.error)}
    </PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={7} />
  {:else}
    <div class="stack">
      <section>
        <p class="eyebrow">Library</p>
        <p class="total">{files.length}</p>
        <p class="caption">managed {files.length === 1 ? "file" : "files"}</p>
      </section>
      <div class="divider" aria-hidden="true"></div>
      <section>
        <h3>Native storage</h3>
        <dl>
          <dt>Known footprint</dt><dd>{bytesLabel(knownBytes)}</dd>
          <dt>Quarantined metadata</dt><dd>{library.current.unavailable.length}</dd>
        </dl>
      </section>
      <section>
        <h3>Semantic coverage</h3>
        <dl>
          <dt>Ready</dt><dd>{ready}</dd>
          <dt>Queued / running</dt><dd>{processing}</dd>
          <dt>Needs attention</dt><dd>{attention}</dd>
          <dt>Managed only</dt><dd>{files.filter((file) => file.semanticTone === "limited").length}</dd>
        </dl>
      </section>
    </div>
  {/if}
</Panel>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .eyebrow,
  h3,
  .caption {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .eyebrow,
  h3 {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .total {
    margin: calc(var(--token-spacing-unit) * 1) 0 0;
    color: var(--token-ink-primary);
    font-size: calc(var(--token-text-body-lg) * 1.6);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .caption {
    margin-top: calc(var(--token-spacing-unit) * 1);
  }

  .divider {
    border-top: 1px solid var(--token-border-subtle);
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    margin: calc(var(--token-spacing-unit) * 2) 0 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    color: var(--token-ink-secondary);
    font-variant-numeric: tabular-nums;
  }
</style>
