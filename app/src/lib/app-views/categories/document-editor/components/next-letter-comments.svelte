<script lang="ts">
  import { PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
  import {
    commentsQuery,
    peopleIn,
    remarksIn,
    remarksOf,
    threadsIn,
    threadsOf
  } from "$app-views/categories/document-editor/procedures/comments";
  import { threadsOn } from "$app-views/categories/document-editor/procedures/comment-anchors";
  import { ago, nameOf, textOf } from "$app-views/categories/document-editor/procedures/comment-copy";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = view.active.resourceId;
  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const selection = $derived(view.selection);
  const comments = commentsQuery();
  const users = $derived(peopleIn(comments));
  const remarks = $derived(remarksIn(comments));
  const threads = $derived(threadsOf(threadsIn(comments), documentId ?? ""));
  const here = $derived(body === undefined ? [] : threadsOn(threads, body, selection));
  const now = Date.now();

  const openThread = (id: string) =>
    view.inspect("document-editor.comment", { kind: "comment", id });
  const openPerson = (id: string) => view.inspect("general.person", { kind: "person", id });
</script>

<PanelSection title="Comments" count={here.length} open={here.length > 0} chevron="end" flush>
  {#if here.length === 0}
    <div class="px-3 pb-1">
      <PanelNote tone="muted">No open comment contains the caret.</PanelNote>
    </div>
  {:else}
    <div class="flex flex-col gap-2.5 pb-1">
      <span class="text-caption text-ink-muted px-3 font-medium">Open conversations under the caret</span>
      {#each here as thread (thread._id)}
        {@const first = remarksOf(remarks, thread._id)[0]}
        <PanelQuote
          source={nameOf(users, thread.createdBy)}
          when={ago(thread._creationTime, now)}
          onopen={() => thread.createdBy.kind === "user" && openPerson(thread.createdBy.userId)}
        >
          <button
            type="button"
            title="Open the thread"
            class="text-body-sm text-ink-secondary m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start"
            onclick={() => openThread(thread._id)}
          >
            {first === undefined ? (thread.quote ?? "") : textOf(first)}
          </button>
        </PanelQuote>
      {/each}
    </div>
  {/if}
</PanelSection>
