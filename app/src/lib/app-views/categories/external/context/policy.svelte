<script lang="ts">
  import { Panel, PanelBanner, PanelSkeleton } from "$authored-components/panel";
  import {
    bytesLabel,
    externalFileLibrary
  } from "$app-views/categories/external/procedures/library.svelte";

  const library = externalFileLibrary();
</script>

<Panel title="Policy">
  {#if library.error}
    <PanelBanner title="Policy unavailable" tone="danger">
      {library.error instanceof Error ? library.error.message : String(library.error)}
    </PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="fields" count={8} />
  {:else}
    {@const limits = library.current.limits}
    <div class="stack">
      <section>
        <h3>Upload bounds</h3>
        <dl>
          <dt>Files per batch</dt><dd>{limits.maxFiles}</dd>
          <dt>Each file</dt><dd>{bytesLabel(limits.maxFileBytes)}</dd>
          <dt>Whole batch</dt><dd>{bytesLabel(limits.maxBatchBytes)}</dd>
          <dt>Relative path</dt><dd>{limits.maxPathBytes} UTF-8 bytes</dd>
        </dl>
      </section>
      <section>
        <h3>File management</h3>
        <p>Rename changes the project-local display name only. Original name, relative path, SHA-256 identity, and native bytes remain unchanged.</p>
        <p>Delete is refused while represented documents, decks, templates, resource sets, or findings refer to the file.</p>
      </section>
      <section>
        <h3>Meaning by type</h3>
        <p>UTF-8 text is eligible for exact search. Code, CSV, and images also receive bounded material profiles and may receive generated summaries.</p>
        <p>PDF, Office, audio, video, and unknown formats remain downloadable managed files without claimed extraction.</p>
      </section>
      <section>
        <h3>Download</h3>
        <p>Verified bytes are served as attachments with range support, a SHA-256 ETag, <code>nosniff</code>, and a sandboxing CSP.</p>
      </section>
      <p class="deferred"><strong>Deferred:</strong> Findings will join External later. No inactive Findings controls are rendered now.</p>
    </div>
  {/if}
</Panel>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 5);
    padding: 0 calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 4);
  }

  h3,
  p,
  dl {
    margin: 0;
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  h3 {
    margin-bottom: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-muted);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  p {
    color: var(--token-ink-muted);
  }

  p + p {
    margin-top: calc(var(--token-spacing-unit) * 2);
  }

  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-muted);
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    color: var(--token-ink-secondary);
    text-align: end;
  }

  code {
    font-family: var(--token-font-mono);
    color: var(--token-ink-secondary);
  }

  .deferred {
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px dashed var(--token-border-subtle);
    border-radius: var(--token-radius-control);
  }
</style>
