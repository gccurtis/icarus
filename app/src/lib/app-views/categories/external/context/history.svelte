<script lang="ts">
  import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
  import { Panel, PanelBanner, PanelSearch, PanelSkeleton } from "$authored-components/panel";
  import {
    externalFileHistory,
    externalHistoryIn
  } from "$app-views/categories/external/procedures";
  import { startExternalClock } from "$app-views/categories/external/procedures/effects/clock.svelte";
  import {
    inspectExternalHistoryActor,
    inspectExternalHistoryFile
  } from "$app-views/categories/external/procedures/history-navigation";
  import { externalHistoryLabel, matchingExternalHistory } from "$app-views/categories/external/procedures/history-query";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
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
            <button type="button" class="history-target"
              aria-label={`Inspect file ${entry.name}`}
              onclick={() => inspectExternalHistoryFile(view, entry.externalFileId)}></button>
            <span class="icon"><ClockArrowLeft size={13} aria-hidden="true" /></span>
            <div class="entry-copy">
              <strong>{externalHistoryLabel(entry.event)} {entry.name}</strong>
              <span class="meta"><span title={new Date(entry.at).toLocaleString()}>{entry.when}</span><span aria-hidden="true">·</span><button
                type="button" class="actor" title={`Inspect ${entry.actorName}`}
                onclick={() => inspectExternalHistoryActor(view, entry.actorId)}>{entry.actorName}</button></span>
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
  article { display: grid; position: relative; grid-template-columns: auto minmax(0, 1fr); gap: calc(var(--token-spacing-unit) * 2); padding: calc(var(--token-spacing-unit) * 2.5) calc(var(--token-spacing-unit) * 1.5); border-bottom: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); }
  article:hover { background: var(--token-surface-panel-hover); }
  .history-target { position: absolute; z-index: 0; inset: 0; cursor: pointer; border-radius: inherit; }
  .history-target:focus-visible { outline: 2px solid var(--token-border-strong); outline-offset: -2px; }
  .entry-copy, .icon { display: flex; position: relative; z-index: 1; min-width: 0; flex-direction: column; gap: calc(var(--token-spacing-unit) * .5); pointer-events: none; }
  .icon { padding-top: 2px; color: var(--token-ink-muted); }
  .meta { display: flex; min-width: 0; align-items: baseline; gap: calc(var(--token-spacing-unit) * 1); }
  .actor { position: relative; z-index: 2; min-width: 0; overflow: hidden; color: var(--token-ink-muted); text-align: start; text-overflow: ellipsis; white-space: nowrap; pointer-events: auto; }
  .actor:hover, .actor:focus-visible { color: var(--token-ink-secondary); text-decoration: underline; }
  strong, span, small, p { overflow: hidden; margin: 0; font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); text-overflow: ellipsis; }
  strong { color: var(--token-ink-secondary); font-weight: 500; }
  span, small, p { color: var(--token-ink-muted); }
  small { font-family: var(--token-font-mono); white-space: nowrap; }
  article p { margin-top: calc(var(--token-spacing-unit) * 1); white-space: normal; }
</style>
