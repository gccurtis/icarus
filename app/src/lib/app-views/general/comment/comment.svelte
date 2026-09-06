<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Locate from "@lucide/svelte/icons/locate";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelNote,
    PanelQuote
  } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { create, remove, update } from "$capabilities/store/index.remote";
  import {
    ago,
    blockIdOf,
    nameOf,
    refreshAll,
    remarksOf,
    replyFields,
    rowsIn,
    rowsOf,
    tableQuery,
    textOf,
    threadOf,
    userIdOf,
    viewerId,
    type CommentThread
  } from "$app-views/general/comment/threads";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";

  type ElementNode = {
    readonly id: string;
    readonly content: {
      readonly type: string;
      readonly children?: readonly ElementNode[];
    };
  };

  const view = workspaceState();

  const threadId = $derived(view.selection?.id ?? "");
  const threadsQuery = tableQuery("commentThreads");
  const remarksQuery = tableQuery("comments");
  const threads = $derived(rowsOf(threadsQuery, "commentThreads"));
  const thread = $derived(threadOf(threads, threadId));
  const remarks = $derived(thread === undefined ? [] : remarksOf(rowsOf(remarksQuery, "comments"), thread._id));
  const opening = $derived(remarks[0]);
  const users = $derived(rowsIn("users"));
  const viewer = $derived(viewerId());
  const now = Date.now();

  const resolved = $derived(thread?.resolution);
  const inDocument = $derived(
    thread !== undefined && thread.target.kind === "document" && view.active.resourceId === thread.target.id
  );

  let reply = $state("");
  let busy = $state(false);
  let failed = $state<string | undefined>(undefined);
  let composer = $state<HTMLTextAreaElement | null>(null);

  const attempt = async (act: () => Promise<void>) => {
    busy = true;
    failed = undefined;
    try {
      await act();
    } catch (error) {
      failed = error instanceof Error ? error.message : "That did not save.";
    } finally {
      busy = false;
    }
  };

  const send = () =>
    attempt(async () => {
      const held = thread;
      const text = reply.trim();
      if (held === undefined || text.length === 0) return;

      await create({ table: "comments", fields: replyFields(held, text, viewer) });
      await update({ path: `commentThreads.${held._id}.updatedAt`, value: Date.now() });
      reply = "";
      await refreshAll(remarksQuery, threadsQuery);
    });

  const resolve = () =>
    attempt(async () => {
      const held = thread;
      if (held === undefined) return;

      await update({
        path: `commentThreads.${held._id}.resolution`,
        value: { by: viewer, at: Date.now() }
      });
      await refreshAll(threadsQuery);
    });

  const reopen = () =>
    attempt(async () => {
      const held = thread;
      if (held === undefined) return;

      await remove({ path: `commentThreads.${held._id}.resolution` });
      await refreshAll(threadsQuery);
    });

  const elementIn = (elements: readonly ElementNode[], id: string): boolean =>
    elements.some(
      (element) =>
        element.id === id ||
        (element.content.type === "group" && elementIn(element.content.children ?? [], id))
    );

  const deckAnchorOf = (
    held: CommentThread
  ): { slideId?: string; elementId?: string } => {
    if (held.target.kind !== "slides") return {};

    const within = held.within;
    if (within?.kind === "slide") return { slideId: within.slideId };
    if (within?.kind !== "element") return {};

    const slide = view
      .slideDeckRuntime(held.target.id)
      .body?.slides.find((candidate) =>
        elementIn(candidate.elements as unknown as readonly ElementNode[], within.elementId)
      );
    return { ...(slide === undefined ? {} : { slideId: slide.id }), elementId: within.elementId };
  };

  const canLocate = $derived(
    thread !== undefined &&
      (blockIdOf(thread) !== undefined ||
        (thread.target.kind === "slides" &&
          (thread.within?.kind === "slide" || thread.within?.kind === "element")))
  );

  const locate = () => {
    const held = thread;
    if (held === undefined) return;

    if (held.target.kind === "document") {
      const blockId = blockIdOf(held);
      if (blockId === undefined) return;

      if (!inDocument) view.open({ category: "document-editor", resourceId: held.target.id });
      view.documentRuntime(held.target.id).scrollTo = blockId;
      return;
    }

    if (held.target.kind !== "slides") return;
    const anchor = deckAnchorOf(held);
    view.open({
      category: "slide-deck-editor",
      resourceId: held.target.id,
      ...(anchor.slideId === undefined ? {} : { focus: anchor.slideId })
    });

    const id = anchor.elementId ?? anchor.slideId;
    if (id !== undefined) view.inspect("slide-deck-editor.threads", { kind: "threads", id });
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };

  const openPerson = (id: string | undefined) => {
    if (id !== undefined) view.inspect("general.person", { kind: "person", id });
  };
</script>

<Panel title="Comment">
  {#snippet crumbs()}
    {#if thread?.target.kind === "slides"}
      <PanelCrumbs trail={[{ label: "Deck" }, { label: "Comment" }]} onnavigate={navigate} />
    {:else}
      <PanelCrumbs
        trail={[{ label: "Document", key: "document-editor.document" }, { label: "Comment" }]}
        onnavigate={navigate}
      />
    {/if}
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Reply" tone="primary" disabled={thread === undefined || busy} onclick={() => composer?.focus()} />
    {#if resolved === undefined}
      <PanelButton label="Resolve" icon={Check} disabled={thread === undefined || busy || viewer.length === 0} onclick={() => void resolve()} />
    {:else}
      <PanelButton label="Reopen" icon={RotateCcw} disabled={busy} onclick={() => void reopen()} />
    {/if}
    {#if canLocate}
      <PanelButton
        label={thread?.target.kind === "slides" ? "Show in deck" : "Show in document"}
        icon={Locate}
        tone="ghost"
        onclick={locate}
      />
    {/if}
  {/snippet}

  {#if thread === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">This thread is gone, or has not loaded yet.</PanelNote>
    </div>
  {:else}
    <div class="flex flex-col gap-3 pt-2">
      {#if resolved !== undefined}
        <div class="flex items-center gap-2 px-3">
          <PanelChip tone="success">Resolved</PanelChip>
          <span class="text-caption text-ink-muted">
            by {nameOf(users, { kind: "user", userId: resolved.by })} · {ago(resolved.at, now)}
          </span>
        </div>
      {/if}

      {#if thread.quote !== undefined && thread.quote.length > 0}
        <section aria-labelledby="comment-anchor" class="bg-surface-panel-hover border-border-subtle flex flex-col gap-1.5 border-y py-2">
          <h2 id="comment-anchor" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
            Selected text
          </h2>
          <PanelQuote
            sourceLabel="Selected by"
            source={nameOf(users, thread.createdBy)}
            when={ago(thread._creationTime, now)}
            onopen={() => openPerson(userIdOf(thread.createdBy))}
          >
            <span class="text-ink-primary">{thread.quote}</span>
          </PanelQuote>
        </section>
      {/if}

      <section aria-labelledby="comment-conversation" class="flex flex-col gap-2.5">
        <h2 id="comment-conversation" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
          Conversation
        </h2>
        {#if opening !== undefined}
          <div class="border-active-border bg-active-surface mx-3 flex flex-col gap-1 rounded-md border py-2">
            <span class="text-caption text-active-text px-3 font-semibold">Original comment</span>
            <PanelQuote
              source={nameOf(users, opening.author)}
              when={ago(opening._creationTime, now)}
              onopen={() => openPerson(userIdOf(opening.author))}
            >
              {textOf(opening)}
            </PanelQuote>
          </div>
        {/if}
        {#if remarks.length > 1}
          <span class="text-caption text-ink-muted px-3 font-medium">Replies</span>
        {/if}
        {#each remarks.slice(1) as remark (remark._id)}
          <PanelQuote
            source={nameOf(users, remark.author)}
            when={ago(remark._creationTime, now)}
            onopen={() => openPerson(userIdOf(remark.author))}
          >
            {textOf(remark)}
          </PanelQuote>
        {/each}
        {#if remarks.length === 0}
          <PanelNote tone="muted">Nothing has been said on this thread yet.</PanelNote>
        {/if}
      </section>

      <div class="flex flex-col gap-2.5 px-3">
        <Textarea
          bind:ref={composer}
          placeholder="Reply…"
          bind:value={reply}
          class="text-body-sm field-sizing-content min-h-16 resize-none"
        />
        <div class="flex">
          <PanelButton
            label={busy ? "Sending…" : "Send reply"}
            tone="primary"
            disabled={busy || reply.trim().length === 0 || viewer.length === 0}
            onclick={() => void send()}
          />
        </div>
        {#if failed !== undefined}
          <PanelNote tone="gap">{failed}</PanelNote>
        {/if}
      </div>
    </div>
  {/if}
</Panel>
