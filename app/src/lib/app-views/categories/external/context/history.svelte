<script lang="ts">
  import { onMount } from "svelte";
  import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
  import { Panel, PanelBanner, PanelEmpty, PanelSkeleton } from "$authored-components/panel";
  import {
    externalFileHistory,
    externalHistoryIn
  } from "$app-views/categories/external/procedures/library.svelte";

  const history = externalFileHistory();
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const entries = $derived(externalHistoryIn(history.ready ? history.current.entries : undefined, now));
  const label = (event: (typeof entries)[number]["event"]): string => ({
    uploaded: "Uploaded",
    "re-uploaded": "Re-uploaded",
    renamed: "Renamed",
    moved: "Moved",
    deleted: "Deleted",
    "context-updated": "Updated context for"
  })[event];
</script>

<Panel title="History">
  {#if history.error}
    <PanelBanner title="History unavailable" tone="danger">{history.error instanceof Error ? history.error.message : String(history.error)}</PanelBanner>
  {:else if !history.ready}
    <PanelSkeleton shape="rows" count={6} />
  {:else if entries.length === 0}
    <PanelEmpty title="No External changes yet." />
  {:else}
    <div class="history-list">
      {#each entries as entry (entry.id)}
        <article>
          <span class="icon"><ClockArrowLeft size={13} aria-hidden="true" /></span>
          <div>
            <strong>{label(entry.event)} {entry.name}</strong>
            <span>{entry.when} · {entry.actorName}</span>
            <small>{entry.relativePath}</small>
            {#if entry.detail}<p>{entry.detail}</p>{/if}
          </div>
        </article>
      {/each}
      <p class="note">The newest 200 durable upload, re-upload, rename, move, context, and deletion events are shown.</p>
    </div>
  {/if}
</Panel>

<style>
  .history-list { display: flex; flex-direction: column; padding: 0 calc(var(--token-spacing-unit) * 3); }
  article { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: calc(var(--token-spacing-unit) * 2); padding-block: calc(var(--token-spacing-unit) * 2.5); border-bottom: 1px solid var(--token-border-subtle); }
  article div, .icon { display: flex; min-width: 0; flex-direction: column; gap: calc(var(--token-spacing-unit) * .5); }
  .icon { padding-top: 2px; color: var(--token-ink-muted); }
  strong, span, small, p { overflow: hidden; margin: 0; font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); text-overflow: ellipsis; }
  strong { color: var(--token-ink-secondary); font-weight: 500; }
  span, small, p { color: var(--token-ink-muted); }
  small { font-family: var(--token-font-mono); white-space: nowrap; }
  article p { margin-top: calc(var(--token-spacing-unit) * 1); white-space: normal; }
  .note { padding-block: calc(var(--token-spacing-unit) * 3); white-space: normal; }
</style>
