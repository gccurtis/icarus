<script lang="ts">
  import { startThread } from "$capabilities/comments/index.remote";
  import { read } from "$capabilities/store/index.remote";
  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { elementIn, labelOf, slideHolding, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { elementsSignal, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  type Thread = { _id: string; _creationTime: number; target: { id: string }; within?: { kind: string; elementId?: string; slideId?: string }; resolution?: unknown; createdBy: { userId?: string } };
  type Comment = { _id: string; _creationTime: number; threadId: string; blocks: { display?: string }[]; author: { userId?: string } };
  type User = { _id: string; name?: string; displayName?: string };

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

  const threadRows = read({ path: "commentThreads" });
  const commentRows = read({ path: "comments" });
  const userRows = read({ path: "users" });

  const rowsOf = <T,>(answer: ReturnType<typeof read>): T[] => {
    const found = answer.current;
    return found?.kind === "table" ? (found.rows as unknown as T[]) : [];
  };

  const threads = $derived(
    rowsOf<Thread>(threadRows)
      .filter((thread) => thread.target?.id === deckId)
      .filter((thread) => (element ? thread.within?.kind === "element" && thread.within.elementId === anchor : thread.within?.kind === "slide" && thread.within.slideId === anchor))
      .sort((a, b) => b._creationTime - a._creationTime)
  );
  const open = $derived(threads.filter((thread) => thread.resolution === undefined));
  const resolved = $derived(threads.filter((thread) => thread.resolution !== undefined));
  const comments = $derived(rowsOf<Comment>(commentRows));
  const users = $derived(new Map(rowsOf<User>(userRows).map((user) => [user._id, user.name ?? user.displayName ?? user._id])));

  const ago = (at: number): string => {
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  };

  const inThread = (thread: Thread) => comments.filter((comment) => comment.threadId === thread._id).sort((a, b) => a._creationTime - b._creationTime);
  const subject = $derived(element ? labelOf(element) : `Slide ${position}`);

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

  const openThread = (thread: Thread) => view.inspect("general.comment", { kind: "comment", id: thread._id });
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

  <PanelSection title="Open" count={open.length} flush>
    {#each open as thread (thread._id)}
      {@const held = inThread(thread)}
      {@const first = held[0]}
      <div class="py-1">
        <PanelQuote
          source={users.get(first?.author.userId ?? thread.createdBy.userId ?? "") ?? "Someone"}
          when={`${ago(thread._creationTime)}${held.length > 1 ? ` · ${held.length - 1} repl${held.length === 2 ? "y" : "ies"}` : ""}`}
          onopen={() => openThread(thread)}
        >
          <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
            {first?.blocks[0]?.display ?? "(no text)"}
          </button>
        </PanelQuote>
      </div>
    {/each}
    {#if open.length === 0}
      <PanelEmpty title="No open threads on {subject}." />
    {/if}
  </PanelSection>

  {#if resolved.length > 0}
    <PanelSection title="Resolved" count={resolved.length} open={false} chevron="end" flush>
      {#each resolved as thread (thread._id)}
        {@const first = inThread(thread)[0]}
        <div class="py-1 opacity-70">
          <PanelQuote source={users.get(first?.author.userId ?? thread.createdBy.userId ?? "") ?? "Someone"} when={ago(thread._creationTime)} onopen={() => openThread(thread)}>
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first?.blocks[0]?.display ?? "(no text)"}
            </button>
          </PanelQuote>
        </div>
      {/each}
    </PanelSection>
  {/if}
</Panel>
