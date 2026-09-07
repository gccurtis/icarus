<script lang="ts">
  import { Panel, PanelEmpty, PanelQuote, PanelSection } from "$authored-components/panel";
  import {
    ago,
    detached,
    firstAnchorBlockId,
    nameOf,
    remarksOf,
    textOf,
    threadsOf,
    type Thread
  } from "$app-views/categories/document-editor/procedures/comments";
  import { rowsIn, rowsOf, tableQuery } from "$app-views/categories/document-editor/procedures/store";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const threadsQuery = tableQuery("commentThreads");
  const remarksQuery = tableQuery("comments");

  const body = $derived(runtime?.body);
  const users = $derived(rowsIn("users"));
  const remarks = $derived(rowsOf(remarksQuery, "comments"));
  const all = $derived(
    rowsOf(threadsQuery, "commentThreads").filter(
      (thread) => thread.target.kind === "document" && thread.target.id === documentId
    )
  );
  const open = $derived(threadsOf(all, documentId ?? ""));
  const resolved = $derived(all.filter((thread) => thread.resolution !== undefined));
  const current = $derived(view.inspected === "document-editor.comment" ? view.selection?.id : undefined);
  const now = Date.now();

  const bodyOf = (thread: Thread): string => {
    const first = remarksOf(remarks, thread._id)[0];
    return first === undefined ? (thread.quote ?? "") : textOf(first);
  };

  const show = (thread: Thread) => {
    const blockId = firstAnchorBlockId(thread);
    if (runtime !== undefined && blockId !== undefined) runtime.scrollTo = blockId;
    view.inspect("document-editor.comment", { kind: "comment", id: thread._id });
  };
</script>

{#snippet card(thread: Thread)}
  <div class="thread" class:current={current === thread._id}>
    <PanelQuote
      source={nameOf(users, thread.createdBy)}
      when={ago(thread.updatedAt, now)}
      onopen={() => show(thread)}
    >
      <button type="button" class="open" title="Open the thread" onclick={() => show(thread)}>
        {#if thread.quote}
          <span class="quoted">“{thread.quote}”</span>
        {/if}
        <span class="said">{bodyOf(thread)}</span>
        {#if body !== undefined && detached(thread, body)}
          <span class="gone">The text this was on is gone.</span>
        {/if}
      </button>
    </PanelQuote>
  </div>
{/snippet}

<Panel title="Comments">
  {#if body === undefined}
    <PanelEmpty title="Open a document to see its comments" />
  {:else if all.length === 0}
    <PanelEmpty title="No comments yet" action="Select some text and write one in the inspector" />
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

  .quoted {
    color: var(--token-ink-primary);
    font-style: italic;
  }

  .gone {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }
</style>
