<script lang="ts">
  import Clock3 from "@lucide/svelte/icons/clock-3";
  import { Panel, PanelBanner, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import {
    externalFileLibrary,
    externalFilesIn
  } from "$app-views/categories/external/procedures/library.svelte";

  const library = externalFileLibrary();
  const files = $derived(externalFilesIn(library.ready ? library.current : undefined, Date.now()).slice(0, 12));
</script>

<Panel title="Activity">
  {#if library.error}
    <PanelBanner title="Activity unavailable" tone="danger">
      {library.error instanceof Error ? library.error.message : String(library.error)}
    </PanelBanner>
  {:else if !library.ready}
    <PanelSkeleton shape="rows" count={6} />
  {:else if files.length === 0}
    <PanelEmpty title="No file changes yet." />
  {:else}
    <div class="activity-list">
      {#each files as file (file.id)}
        <article>
          <span class="icon"><Clock3 size={13} aria-hidden="true" /></span>
          <div>
            <strong>{file.revision > 1 ? "Updated" : "Uploaded"} {file.name}</strong>
            <span>{file.updated} · {file.updatedByName}</span>
            <small>{file.relativePath}</small>
          </div>
        </article>
      {/each}
      <p class="note">This feed is projected from current file rows. A durable event journal is not represented yet.</p>
    </div>
  {/if}
</Panel>

<style>
  .activity-list {
    display: flex;
    flex-direction: column;
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  article {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 2);
    padding-block: calc(var(--token-spacing-unit) * 2.5);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  article div,
  .icon {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.5);
  }

  .icon {
    padding-top: 2px;
    color: var(--token-ink-muted);
  }

  strong,
  span,
  small,
  .note {
    overflow: hidden;
    margin: 0;
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--token-ink-secondary);
    font-weight: 500;
  }

  span,
  small,
  .note {
    color: var(--token-ink-muted);
  }

  .note {
    padding-block: calc(var(--token-spacing-unit) * 3);
    white-space: normal;
  }
</style>
