<script lang="ts">
  import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
  import { Panel, PanelBanner, PanelSearch, PanelSkeleton } from "$authored-components/panel";
  import {
    externalFileHistory,
    externalHistoryIn
  } from "$app-views/categories/external/procedures";
  import { startExternalClock } from "$app-views/categories/external/procedures/effects/clock.svelte";
  import { matchingExternalHistory } from "$app-views/categories/external/procedures/history-query";

  const history = externalFileHistory();
  const clock = startExternalClock();
  let search = $state("");
  const entries = $derived(
    externalHistoryIn(history.ready ? history.current.entries : undefined, clock.now)
  );
  const matches = $derived(matchingExternalHistory(entries, search));
</script>

<Panel title="History">
  {#if history.error}
    <PanelBanner title="History unavailable" tone="danger">{history.error instanceof Error ? history.error.message : String(history.error)}</PanelBanner>
  {:else if !history.ready}
    <PanelSkeleton shape="rows" count={6} />
  {:else}
    <div title="Search the latest 200 events">
    <PanelSearch placeholder="Search history" bind:value={search}
      matched={matches.length} total={entries.length} flush
      empty={entries.length === 0 ? "No External Files changes yet." : "No recent events match."}>
      <div class="history-list">
        {#each matches as entry (entry.id)}
          <article>
            <span class="icon"><ClockArrowLeft size={13} aria-hidden="true" /></span>
            <div>
              <strong>{entry.what}: {entry.target.label}</strong>
              <span>{entry.when} · {entry.actorName}</span>
              <small title={entry.relativePath}>{entry.relativePath}</small>
              {#if entry.detail}<p>{entry.detail}</p>{/if}
            </div>
          </article>
        {/each}
      </div>
    </PanelSearch>
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
</style>
