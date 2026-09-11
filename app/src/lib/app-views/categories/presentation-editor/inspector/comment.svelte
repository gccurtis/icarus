<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Locate from "@lucide/svelte/icons/locate";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import { Panel, PanelButton, PanelChip, PanelCrumbs, PanelNote, PanelQuote } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { commentThreadCommand } from "$app-views/categories/presentation-editor/procedures/comment-thread-command.svelte";
  import {
    commentsQuery,
    peopleIn,
    remarksIn,
    remarksOf,
    threadOf,
    threadsIn,
    viewerId,
    type CommentThread
  } from "$app-views/categories/presentation-editor/procedures/comments";
  import { ago, nameOf, textOf, userIdOf } from "$app-views/categories/presentation-editor/procedures/comment-copy";
  import { workspaceState } from "$model/client/workspace-state";

  type ElementNode = {
    readonly id: string;
    readonly content: { readonly type: string; readonly children?: readonly ElementNode[] };
  };

  const view = workspaceState();
  const threadId = $derived(view.selection?.id ?? "");
  const comments = commentsQuery();
  const thread = $derived(threadOf(threadsIn(comments), threadId));
  const remarks = $derived(
    thread === undefined ? [] : remarksOf(remarksIn(comments), thread._id)
  );
  const opening = $derived(remarks[0]);
  const users = $derived(peopleIn(comments));
  const viewer = $derived(viewerId(comments));
  const resolved = $derived(thread?.resolution);
  const now = Date.now();

  let reply = $state("");
  const command = commentThreadCommand();
  const busy = $derived(command.busy);
  const failed = $derived(command.failed);

  const send = () => {
    const held = thread;
    const text = reply.trim();
    if (held === undefined || text.length === 0) return;
    command.reply(held._id, text, () => (reply = ""));
  };

  const resolve = () => {
    if (thread !== undefined) command.setResolved(thread._id, true);
  };

  const reopen = () => {
    if (thread !== undefined) command.setResolved(thread._id, false);
  };

  const elementIn = (elements: readonly ElementNode[], id: string): boolean =>
    elements.some(
      (element) =>
        element.id === id ||
        (element.content.type === "group" && elementIn(element.content.children ?? [], id))
    );

  const presentationAnchorOf = (held: CommentThread): { slideId?: string; elementId?: string } => {
    if (held.target.kind !== "presentation") return {};
    const within = held.within;
    if (within?.kind === "slide") return { slideId: within.slideId };
    if (within?.kind !== "element") return {};
    const slide = view
      .presentationRuntime(held.target.id)
      .body?.slides.find((candidate) =>
        elementIn(candidate.elements as unknown as readonly ElementNode[], within.elementId)
      );
    return { ...(slide === undefined ? {} : { slideId: slide.id }), elementId: within.elementId };
  };

  const canLocate = $derived(
    thread?.target.kind === "presentation" &&
      (thread.within?.kind === "slide" || thread.within?.kind === "element")
  );

  const locate = () => {
    const held = thread;
    if (held?.target.kind !== "presentation") return;
    const anchor = presentationAnchorOf(held);
    view.open({
      category: "presentation-editor",
      resourceId: held.target.id,
      ...(anchor.slideId === undefined ? {} : { focus: anchor.slideId })
    });
    const id = anchor.elementId ?? anchor.slideId;
    if (id !== undefined) view.inspect("presentation-editor.threads", { kind: "threads", id });
  };

  const openPerson = (id: string | undefined) => {
    if (id !== undefined) view.inspect("general.person", { kind: "person", id });
  };
</script>

<Panel title="Comment">
  {#snippet crumbs()}<PanelCrumbs trail={[{ label: "Presentation" }, { label: "Comment" }]} onnavigate={() => {}} />{/snippet}
  {#snippet actions()}
    {#if canLocate}<PanelButton label="Show in presentation" icon={Locate} tone="ghost" onclick={locate} />{/if}
  {/snippet}

  {#if thread === undefined}
    <div class="pt-2"><PanelNote tone="muted">This thread is gone, or has not loaded yet.</PanelNote></div>
  {:else}
    <div class="flex flex-col gap-3 pt-2">
      {#if resolved !== undefined}
        <div class="flex items-center gap-2 px-3">
          <PanelChip tone="success">Resolved</PanelChip>
          <span class="text-caption text-ink-muted">by {nameOf(users, { kind: "user", userId: resolved.by })} · {ago(resolved.at, now)}</span>
        </div>
      {/if}

      {#if thread.quote !== undefined && thread.quote.length > 0}
        <section aria-labelledby="comment-anchor" class="bg-surface-panel-hover border-border-subtle flex flex-col gap-1.5 border-y py-2">
          <h2 id="comment-anchor" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">Selected text</h2>
          <PanelQuote sourceLabel="Selected by" source={nameOf(users, thread.createdBy)} when={ago(thread._creationTime, now)} onopen={() => openPerson(userIdOf(thread.createdBy))}>
            <span class="text-ink-primary">{thread.quote}</span>
          </PanelQuote>
        </section>
      {/if}

      <section aria-labelledby="comment-conversation" class="flex flex-col gap-2.5">
        <h2 id="comment-conversation" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">Conversation</h2>
        {#if opening !== undefined}
          <div class="border-active-border bg-active-surface mx-3 flex flex-col gap-1 rounded-md border py-2">
            <span class="text-caption text-active-text px-3 font-semibold">Original comment</span>
            <PanelQuote source={nameOf(users, opening.author)} when={ago(opening._creationTime, now)} onopen={() => openPerson(userIdOf(opening.author))}>{textOf(opening)}</PanelQuote>
          </div>
        {/if}

        <div class="border-border-subtle mx-3 border-t" aria-hidden="true"></div>
        <div class="flex flex-col gap-2.5 px-3">
          <Textarea placeholder="Write a reply…" bind:value={reply} class="text-body-sm field-sizing-content min-h-16 resize-none" />
          <div class="flex items-center justify-between gap-2">
            {#if resolved === undefined}
              <PanelButton label="Resolve" icon={Check} disabled={busy || viewer.length === 0} onclick={() => void resolve()} />
            {:else}
              <PanelButton label="Reopen" icon={RotateCcw} disabled={busy} onclick={() => void reopen()} />
            {/if}
            <PanelButton label={busy ? "Sending…" : "Reply"} tone="primary" disabled={busy || reply.trim().length === 0 || viewer.length === 0} onclick={() => void send()} />
          </div>
          {#if failed !== undefined}<PanelNote tone="gap">{failed}</PanelNote>{/if}
        </div>
        <div class="border-border-subtle mx-3 border-t" aria-hidden="true"></div>

        {#if remarks.length > 1}<span class="text-caption text-ink-muted px-3 font-medium">Replies</span>{/if}
        {#each remarks.slice(1) as remark (remark._id)}
          <PanelQuote source={nameOf(users, remark.author)} when={ago(remark._creationTime, now)} onopen={() => openPerson(userIdOf(remark.author))}>{textOf(remark)}</PanelQuote>
        {/each}
        {#if remarks.length === 0}<PanelNote tone="muted">Nothing has been said on this thread yet.</PanelNote>{/if}
      </section>
    </div>
  {/if}
</Panel>
