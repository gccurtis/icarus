<script lang="ts">
  import { startThread } from "$capabilities/comments/index.remote";
  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
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
  import { elementsSignal, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { resourceTemplate } from "$app-views/categories/slide-deck-editor/procedures/templating";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const anchor = $derived(view.selection?.kind === "threads" ? view.selection.id : undefined);
  const element = $derived(body === undefined || anchor === undefined ? undefined : elementIn(body, anchor));
  const slide = $derived(body === undefined || anchor === undefined ? undefined : element ? slideHolding(body, anchor) : body.slides.find((held) => held.id === anchor));
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);

  const threadRows = tableQuery("commentThreads");
  const commentRows = tableQuery("comments");
  const userRows = tableQuery("users");

  const threads = $derived(
    rowsOf(threadRows, "commentThreads")
      .filter((thread) => thread.target.kind === "slides" && thread.target.id === deckId)
      .filter((thread) => (element ? thread.within?.kind === "element" && thread.within.elementId === anchor : thread.within?.kind === "slide" && thread.within.slideId === anchor))
      .sort((a, b) => b._creationTime - a._creationTime)
  );
  const open = $derived(threads.filter((thread) => thread.resolution === undefined));
  const resolved = $derived(threads.filter((thread) => thread.resolution !== undefined));
  const comments = $derived(rowsOf(commentRows, "comments"));
  const users = $derived(rowsOf(userRows, "users"));
  const now = Date.now();

  const inThread = (thread: CommentThread) => remarksOf(comments, thread._id);
  const subject = $derived(element ? labelOf(element) : `Slide ${position}`);
  const templateQuery = $derived(deckId === undefined ? undefined : resourceTemplate(deckId));
  const workingCopy = $derived(templateQuery?.ready === true && templateQuery.current.stage !== null);

  let composing = $state("");
  let posting = $state(false);
  let box = $state<HTMLTextAreaElement | null>(null);

  const post = async () => {
    const text = composing.trim();
    if (deckId === undefined || anchor === undefined || text === "" || posting) return;
    posting = true;
    try {
      await startThread({
        target: { kind: "slides", id: deckId },
        within: element ? { kind: "element", elementId: anchor } : { kind: "slide", slideId: anchor },
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

<Panel title="Comments on {subject}">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "slide-deck-editor.slide" }, ...(element ? [{ label: labelOf(element), key: "slide-deck-editor.shape" }] : []), { label: "Comments" }]}
      onnavigate={(key) => {
        if (key === "slide-deck-editor.slide" && slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection);
        if (key === "slide-deck-editor.shape" && element) { const signal = elementsSignal([element]); if (signal) view.inspect(signal.key, signal.selection); }
      }}
    />
  {/snippet}
  {#if workingCopy}
    <PanelNote tone="gap">A template's working copy takes no comments; they never travel with a template.</PanelNote>
  {:else}
  <div class="flex flex-col gap-1.5 px-3 pb-2">
    <Textarea
      bind:ref={box}
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
    <div class="flex justify-end">
      <PanelButton label={posting ? "Posting…" : "Comment"} tone="primary" disabled={posting || composing.trim() === ""} title="Start a thread on {subject}" onclick={() => void post()} />
    </div>
  </div>
  {/if}

  <section aria-labelledby="slide-thread-open" class="flex flex-col">
    <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5 text-start">
      <h2 id="slide-thread-open" class="text-caption m-0 font-semibold tracking-wide uppercase">Open</h2>
      <span class="text-caption text-ink-muted ms-auto tabular-nums">{open.length}</span>
    </div>
    <div class="flex flex-col gap-1.5 pb-2">
      {#each open as thread (thread._id)}
        {@const held = inThread(thread)}
        {@const first = held[0]}
        <div class="py-1">
          <PanelQuote
            source={nameOf(users, first?.author ?? thread.createdBy)}
            when={`${ago(thread._creationTime, now)}${held.length > 1 ? ` · ${held.length - 1} repl${held.length === 2 ? "y" : "ies"}` : ""}`}
            onopen={() => openThread(thread)}
          >
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first === undefined ? "(no text)" : textOf(first)}
            </button>
          </PanelQuote>
        </div>
      {/each}
      {#if open.length === 0}
        <PanelEmpty title="No open threads on {subject}." />
      {/if}
    </div>
  </section>

  {#if resolved.length > 0}
    <PanelSection title="Resolved" count={resolved.length} open={false} chevron="end" flush>
      {#each resolved as thread (thread._id)}
        {@const first = inThread(thread)[0]}
        <div class="py-1 opacity-70">
          <PanelQuote source={nameOf(users, first?.author ?? thread.createdBy)} when={ago(thread._creationTime, now)} onopen={() => openThread(thread)}>
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first === undefined ? "(no text)" : textOf(first)}
            </button>
          </PanelQuote>
        </div>
      {/each}
    </PanelSection>
  {/if}
</Panel>
