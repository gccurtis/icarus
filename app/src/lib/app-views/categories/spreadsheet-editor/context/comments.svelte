<script lang="ts">
  import { Panel, PanelEmpty, PanelQuote, PanelSection } from "$authored-components/panel";
  import { gridOf, indexOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import {
    ago,
    anchorLabel,
    anchorOf,
    nameOf,
    remarksOf,
    resolvedOf,
    textOf,
    threadsOf,
    type Thread
  } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { cellSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { rowsOf, tableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));

  const threadRows = tableQuery("commentThreads");
  const remarkRows = tableQuery("comments");
  const userRows = tableQuery("users");

  const users = $derived(rowsOf(userRows, "users"));
  const remarks = $derived(rowsOf(remarkRows, "comments"));
  const threads = $derived(rowsOf(threadRows, "commentThreads"));
  const open = $derived(sheetId === undefined ? [] : threadsOf(threads, sheetId));
  const resolved = $derived(sheetId === undefined ? [] : resolvedOf(threads, sheetId));
  const selected = $derived(selectedRef(view.selection));
  const current = $derived.by(() => {
    if (view.inspected === "general.comment") return view.selection?.id;
    if (selected === undefined) return undefined;
    return open.find((thread) => {
      const anchor = anchorOf(thread);
      return anchor?.rowId === selected.rowId && anchor?.columnId === selected.columnId;
    })?._id;
  });
  const now = Date.now();

  const bodyOf = (thread: Thread): string => {
    const [first] = remarksOf(remarks, thread._id);
    return first === undefined ? (thread.quote ?? "") : textOf(first);
  };

  const gone = (thread: Thread): boolean => {
    const anchor = anchorOf(thread);
    return anchor !== undefined && indexOf(grid, anchor) === undefined;
  };

  const show = (thread: Thread) => {
    const anchor = anchorOf(thread);
    if (anchor === undefined || sheet === undefined || runtime === undefined || gone(thread)) {
      view.inspect("general.comment", { kind: "comment", id: thread._id });
      return;
    }
    runtime.scrollTo = anchor;
    const signal = cellSignal(sheet, grid, anchor);
    view.inspect(signal.key, signal.selection);
  };
</script>

{#snippet card(thread: Thread)}
  <div class="thread" class:current={current === thread._id}>
    <PanelQuote source={nameOf(users, thread.createdBy)} when={ago(thread.updatedAt, now)} onopen={() => show(thread)}>
      <button type="button" class="open" title="Open the thread" onclick={() => show(thread)}>
        <span class="where">
          {anchorLabel(grid, thread)}
          {#if thread.quote}
            <span class="quoted">· “{thread.quote}”</span>
          {/if}
        </span>
        <span class="said">{bodyOf(thread)}</span>
        {#if gone(thread)}
          <span class="lost">The cell this was on is gone.</span>
        {/if}
      </button>
    </PanelQuote>
  </div>
{/snippet}

<Panel title="Comments">
  {#if sheet === undefined}
    <PanelEmpty title="Open a spreadsheet to see its comments" />
  {:else if open.length === 0 && resolved.length === 0}
    <PanelEmpty title="No comments yet" action="Select a cell and write one in the inspector" />
  {:else}
    <div class="flex flex-col gap-2.5 pt-1">
      {#each open as thread (thread._id)}
        {@render card(thread)}
      {/each}
      {#if open.length === 0}
        <PanelEmpty title="Everything is resolved" flush />
      {/if}
    </div>

    {#if resolved.length > 0}
      <PanelSection title="Resolved" count={resolved.length} open={false} chevron="end" flush>
        <div class="flex flex-col gap-2.5">
          {#each resolved as thread (thread._id)}
            {@render card(thread)}
          {/each}
        </div>
      </PanelSection>
    {/if}
  {/if}
</Panel>

<style>
  .current :global(figure) {
    border-inline-start-color: var(--token-color-active-border);
  }

  .open {
    display: flex;
    width: 100%;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.5);
    border: 0;
    background: transparent;
    text-align: start;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .where {
    color: var(--token-ink-primary);
    font-weight: 500;
  }

  .quoted {
    font-style: italic;
    font-weight: 400;
  }

  .lost {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }
</style>
