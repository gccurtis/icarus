<script lang="ts">
  import { startThread } from "$capabilities/comments/index.remote";
  import { Panel, PanelButton, PanelChoice, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import {
    ago,
    nameOf,
    remarksOf,
    rowsOf,
    tableQuery,
    textOf,
    type CommentThread
  } from "$app-views/categories/slide-deck-editor/procedures/comments";
  import { elementIn, labelOf, slideHolding, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const slide = $derived(body?.slides[body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined)]);
  const selected = $derived(selectedIds(view.selection)[0]);
  const element = $derived(body === undefined || selected === undefined ? undefined : elementIn(body, selected));

  const threadRows = tableQuery("commentThreads");
  const commentRows = tableQuery("comments");
  const userRows = tableQuery("users");

  const threads = $derived(
    rowsOf(threadRows, "commentThreads").filter(
      (thread) => thread.target.kind === "slides" && thread.target.id === deckId
    )
  );
  const comments = $derived(rowsOf(commentRows, "comments"));
  const users = $derived(rowsOf(userRows, "users"));
  const now = Date.now();

  let wanted = $state("deck");
  const chips = $derived([
    { value: "deck", label: "Deck" },
    ...(slide ? [{ value: "slide", label: `Slide ${slideIndexOf(body!, slide.id) + 1}` }] : []),
    ...(element ? [{ value: "element", label: labelOf(element) }] : [])
  ]);
  const chip = $derived(chips.some((held) => held.value === wanted) ? wanted : "deck");

  const slideOfThread = (thread: CommentThread): string | undefined => {
    if (thread.within?.kind === "slide") return thread.within.slideId;
    if (thread.within?.kind === "element" && body && thread.within.elementId) return slideHolding(body, thread.within.elementId)?.id;
    return undefined;
  };

  const matches = (thread: CommentThread): boolean => {
    if (chip === "element") return thread.within?.kind === "element" && thread.within.elementId === selected;
    if (chip === "slide") return slideOfThread(thread) === slide?.id;
    return true;
  };

  const anchorOf = (thread: CommentThread): string => {
    const held = slideOfThread(thread);
    const position = held && body ? slideIndexOf(body, held) + 1 : undefined;
    if (thread.within?.kind === "element" && body && thread.within.elementId) {
      const target = elementIn(body, thread.within.elementId);
      return `Slide ${position} · ${target ? labelOf(target) : (thread.quote ?? "object")}`;
    }
    return position === undefined ? "Deck" : `Slide ${position}`;
  };

  const firstComment = (thread: CommentThread) => remarksOf(comments, thread._id)[0];

  const shown = $derived(threads.filter(matches).sort((a, b) => b._creationTime - a._creationTime));
  const open = $derived(shown.filter((thread) => thread.resolution === undefined));
  const resolved = $derived(shown.filter((thread) => thread.resolution !== undefined));

  let composing = $state("");
  let posting = $state(false);

  const subject = $derived(chip === "element" && element ? labelOf(element) : chip === "slide" && slide && body ? `slide ${slideIndexOf(body, slide.id) + 1}` : "the deck");

  const post = async () => {
    const text = composing.trim();
    if (deckId === undefined || text === "" || posting) return;
    posting = true;
    try {
      const within =
        chip === "element" && selected !== undefined
          ? { kind: "element" as const, elementId: selected }
          : chip === "slide" && slide !== undefined
            ? { kind: "slide" as const, slideId: slide.id }
            : undefined;
      await startThread({
        target: { kind: "slides", id: deckId },
        within,
        text
      });
      composing = "";
      await Promise.all([threadRows.refresh(), commentRows.refresh()]);
    } finally {
      posting = false;
    }
  };

  const openThread = (thread: CommentThread) =>
    view.inspect("slide-deck-editor.comment", { kind: "comment", id: thread._id });
</script>

<Panel title="Comments">
  {#snippet actions()}
    <PanelChoice label="Show" value={chip} options={chips} flush fill onchange={(value) => (wanted = value)} />
  {/snippet}

  {#if body}
    <div class="flex flex-col gap-2 px-3 pb-2">
      <Textarea
        placeholder="Write a comment on {subject}…"
        bind:value={composing}
        class="text-body-sm field-sizing-content min-h-14 resize-none"
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void post();
          }
        }}
      />
      <div class="flex"><PanelButton label={posting ? "Posting…" : "Comment"} tone="primary" disabled={posting || composing.trim() === ""} onclick={() => void post()} /></div>
    </div>

    <PanelSection title="Open" count={`${open.length} of ${threads.length}`} flush>
      {#each open as thread (thread._id)}
        {@const first = firstComment(thread)}
        <div class="py-1">
          <PanelQuote
            source={nameOf(users, first?.author ?? thread.createdBy)}
            when={`${anchorOf(thread)} · ${ago(thread._creationTime, now)}`}
            onopen={() => openThread(thread)}
          >
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first === undefined ? (thread.quote ?? "(no text)") : textOf(first)}
            </button>
          </PanelQuote>
        </div>
      {/each}
      {#if open.length === 0}
        <PanelEmpty title="No open threads here." />
      {/if}
    </PanelSection>

    <PanelSection title="Resolved" count={resolved.length} open={false} chevron="end" flush>
      {#each resolved as thread (thread._id)}
        {@const first = firstComment(thread)}
        <div class="py-1 opacity-70">
          <PanelQuote source={nameOf(users, first?.author ?? thread.createdBy)} when={anchorOf(thread)} onopen={() => openThread(thread)}>
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first === undefined ? (thread.quote ?? "") : textOf(first)}
            </button>
          </PanelQuote>
        </div>
      {/each}
      {#if resolved.length === 0}
        <PanelNote>Nothing has been resolved yet.</PanelNote>
      {/if}
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a deck to see its comments" />
  {/if}
</Panel>
