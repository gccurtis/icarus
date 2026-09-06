<script lang="ts">
  import { startThread } from "$capabilities/comments/index.remote";
  import { read } from "$capabilities/store/index.remote";
  import { Panel, PanelButton, PanelChoice, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { elementIn, labelOf, slideHolding, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  type Thread = {
    _id: string;
    _creationTime: number;
    target: { kind: string; id: string };
    within?: { kind: string; elementId?: string; slideId?: string; blockId?: string };
    quote?: string;
    resolution?: unknown;
    createdBy: { kind: string; userId?: string };
  };
  type Comment = { _id: string; _creationTime: number; threadId: string; blocks: { display?: string }[]; author: { userId?: string } };
  type User = { _id: string; name?: string; displayName?: string };

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

  const threadRows = read({ path: "commentThreads" });
  const commentRows = read({ path: "comments" });
  const userRows = read({ path: "users" });

  const rowsOf = <T,>(answer: ReturnType<typeof read>): T[] => {
    const found = answer.current;
    return found?.kind === "table" ? (found.rows as unknown as T[]) : [];
  };

  const threads = $derived(rowsOf<Thread>(threadRows).filter((thread) => thread.target?.id === deckId));
  const comments = $derived(rowsOf<Comment>(commentRows));
  const users = $derived(new Map(rowsOf<User>(userRows).map((user) => [user._id, user.name ?? user.displayName ?? user._id])));

  let wanted = $state("deck");
  const chips = $derived([
    { value: "deck", label: "Deck" },
    ...(slide ? [{ value: "slide", label: `Slide ${slideIndexOf(body!, slide.id) + 1}` }] : []),
    ...(element ? [{ value: "element", label: labelOf(element) }] : [])
  ]);
  const chip = $derived(chips.some((held) => held.value === wanted) ? wanted : "deck");

  const slideOfThread = (thread: Thread): string | undefined => {
    if (thread.within?.kind === "slide") return thread.within.slideId;
    if (thread.within?.kind === "element" && body && thread.within.elementId) return slideHolding(body, thread.within.elementId)?.id;
    return undefined;
  };

  const matches = (thread: Thread): boolean => {
    if (chip === "element") return thread.within?.kind === "element" && thread.within.elementId === selected;
    if (chip === "slide") return slideOfThread(thread) === slide?.id;
    return true;
  };

  const anchorOf = (thread: Thread): string => {
    const held = slideOfThread(thread);
    const position = held && body ? slideIndexOf(body, held) + 1 : undefined;
    if (thread.within?.kind === "element" && body && thread.within.elementId) {
      const target = elementIn(body, thread.within.elementId);
      return `Slide ${position} · ${target ? labelOf(target) : (thread.quote ?? "object")}`;
    }
    return position === undefined ? "Deck" : `Slide ${position}`;
  };

  const firstComment = (thread: Thread) =>
    comments.filter((comment) => comment.threadId === thread._id).sort((a, b) => a._creationTime - b._creationTime)[0];

  const ago = (at: number): string => {
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  };

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

  const openThread = (thread: Thread) => view.inspect("general.comment", { kind: "comment", id: thread._id });
</script>

<Panel title="Comments">
  {#snippet actions()}
    <PanelChoice label="Show" value={chip} options={chips} flush onchange={(value) => (wanted = value)} />
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
            source={users.get(first?.author.userId ?? thread.createdBy.userId ?? "") ?? "Someone"}
            when={`${anchorOf(thread)} · ${ago(thread._creationTime)}`}
            onopen={() => openThread(thread)}
          >
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first?.blocks[0]?.display ?? thread.quote ?? "(no text)"}
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
          <PanelQuote source={users.get(first?.author.userId ?? "") ?? "Someone"} when={anchorOf(thread)} onopen={() => openThread(thread)}>
            <button type="button" class="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start" onclick={() => openThread(thread)}>
              {first?.blocks[0]?.display ?? thread.quote ?? ""}
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
