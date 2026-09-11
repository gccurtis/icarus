<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Locate from "@lucide/svelte/icons/locate";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEmpty,
    PanelLink,
    PanelNote,
    PanelQuote,
    PanelSkeleton
  } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import type {
    ProjectPanelActor,
    ProjectResourceKind
  } from "$capabilities/project/index.remote";
  import {
    isContextView,
    isInspectorView,
    workspaceState
  } from "$model/client/workspace-state";
  import { commentThreadCommand } from "$app-views/categories/project-overview/procedures/comment-thread-command.svelte";
  import { ticksTheClock } from "$app-views/categories/project-overview/procedures/effects/ticks-the-clock.svelte";
  import { projectComment } from "$app-views/categories/project-overview/procedures/read-comment";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  type ElementNode = {
    readonly id: string;
    readonly content: {
      readonly type: string;
      readonly children?: readonly ElementNode[];
    };
  };

  const KIND_LABEL: Record<ProjectResourceKind, string> = {
    document: "Document",
    presentation: "Presentation",
    spreadsheet: "Spreadsheet",
    research: "Research",
    finding: "Finding"
  };

  const KIND_TONE: Record<ProjectResourceKind, "interactive" | "accent-1" | "accent-2" | "intelligence" | "active"> = {
    document: "interactive",
    presentation: "accent-1",
    spreadsheet: "accent-2",
    research: "intelligence",
    finding: "active"
  };

  const view = workspaceState();
  const clock = ticksTheClock();
  const command = commentThreadCommand();
  const threadId = $derived(
    view.selection?.kind === "comment" ? view.selection.id : undefined
  );
  const answer = $derived(projectComment(threadId));
  const thread = $derived(answer?.ready ? answer.current : undefined);
  const now = $derived(clock.current);

  const navigate = (key: string) => {
    if (isContextView(key)) view.selectContext(key);
    else if (isInspectorView(key)) view.inspect(key);
  };

  const inspectActor = (actor: ProjectPanelActor | null) => {
    if (actor?.id === undefined) return;
    if (actor.kind === "person") {
      view.inspect("general.person", { kind: "person", id: actor.id });
    } else if (actor.kind === "agent") {
      view.inspect("agents.task", { kind: "task", id: actor.id });
    } else if (actor.kind === "connector") {
      view.inspect("project-overview.connector", { kind: "connector", id: actor.id });
    }
  };

  const inspectResource = () => {
    if (thread === null || thread === undefined) return;
    view.inspect("project-overview.resource", {
      kind: thread.target.kind,
      id: thread.target.id
    });
  };

  const elementIn = (elements: readonly ElementNode[], id: string): boolean =>
    elements.some(
      (element) =>
        element.id === id ||
        (element.content.type === "group" && elementIn(element.content.children ?? [], id))
    );

  const canLocate = $derived(
    thread !== null &&
      thread !== undefined &&
      thread.anchor !== null &&
      ((thread.target.kind === "document" && thread.anchor.kind === "document-text") ||
        (thread.target.kind === "presentation" &&
          (thread.anchor.kind === "slide" || thread.anchor.kind === "element")))
  );

  const locate = () => {
    const held = thread;
    if (held === null || held === undefined || held.anchor === null) return;

    if (held.target.kind === "document" && held.anchor.kind === "document-text") {
      if (view.active.resourceId !== held.target.id) {
        view.open({ category: "document-editor", resourceId: held.target.id });
      }
      view.documentRuntime(held.target.id).scrollTo = held.anchor.blockId;
      return;
    }
    if (held.target.kind !== "presentation") return;

    if (held.anchor.kind === "slide") {
      view.open({
        category: "presentation-editor",
        resourceId: held.target.id,
        focus: held.anchor.slideId
      });
      return;
    }
    const anchor = held.anchor;
    if (anchor.kind !== "element") return;
    const slide = view
      .presentationRuntime(held.target.id)
      .body?.slides.find((candidate) =>
        elementIn(candidate.elements as unknown as readonly ElementNode[], anchor.elementId)
      );
    view.open({
      category: "presentation-editor",
      resourceId: held.target.id,
      ...(slide === undefined ? {} : { focus: slide.id })
    });
    view.inspect("presentation-editor.threads", { kind: "threads", id: anchor.elementId });
  };

</script>

<Panel title="Comment">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Project overview", key: "project-overview.overview" },
        { label: "Comment" }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  {#snippet actions()}
    {#if canLocate}
      <PanelButton
        label={thread?.target.kind === "presentation" ? "Show in presentation" : "Show in document"}
        icon={Locate}
        tone="ghost"
        onclick={locate}
      />
    {/if}
  {/snippet}

  <div class="flex flex-col gap-3 pt-1">
    {#if threadId === undefined}
      <PanelEmpty title="Select a comment thread to inspect." />
    {:else if answer?.error}
      <PanelBanner title="Comment unavailable" tone="attention">
        {answer.error instanceof Error ? answer.error.message : String(answer.error)}
      </PanelBanner>
    {:else if !answer?.ready}
      <PanelSkeleton count={5} />
    {:else if thread === null}
      <PanelEmpty title="This comment is gone or outside the current project." />
    {:else if thread !== undefined}
      <div class="flex flex-col gap-1.5 px-3">
        <div class="text-body-sm min-w-0 font-semibold">
          <PanelLink
            label={thread.target.name}
            title={`Open ${thread.target.name} details`}
            lines={2}
            onselect={inspectResource}
          />
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <PanelChip tone={KIND_TONE[thread.target.kind]}>{KIND_LABEL[thread.target.kind]}</PanelChip>
          <PanelChip tone={thread.state === "open" ? "attention" : "success"}>
            {thread.state === "open" ? "Open" : "Resolved"}
          </PanelChip>
        </div>
      </div>

      {#if thread.selectedText !== undefined}
        <section aria-labelledby="project-comment-anchor" class="bg-surface-panel-hover border-border-subtle flex flex-col gap-1.5 border-y py-2">
          <h3 id="project-comment-anchor" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
            Selected text
          </h3>
          <PanelQuote
            sourceLabel="Selected by"
            source={thread.selectedBy?.label}
            when={shortSince(thread.selectedAt, now)}
            collapsible={thread.selectedText.length > 240}
            onopen={thread.selectedBy?.id === undefined ? undefined : () => inspectActor(thread.selectedBy)}
          >
            <span class="text-ink-primary">{thread.selectedText}</span>
          </PanelQuote>
        </section>
      {/if}

      <section aria-labelledby="project-comment-conversation" class="flex flex-col gap-2.5">
        <h3 id="project-comment-conversation" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
          Conversation
        </h3>

        {#if thread.opening !== null}
          <div class="border-active-border bg-active-surface mx-3 flex flex-col gap-1 rounded-md border py-2">
            <span class="text-caption text-active-text px-3 font-semibold">Original comment</span>
            <PanelQuote
              source={thread.opening.authorLabel}
              when={shortSince(thread.opening.at, now)}
              collapsible={thread.opening.text.length > 280}
              onopen={thread.opening.author?.id === undefined ? undefined : () => inspectActor(thread.opening!.author)}
            >
              {thread.opening.text}
            </PanelQuote>
          </div>
        {:else}
          <PanelNote tone="muted">Nothing has been said on this thread yet.</PanelNote>
        {/if}

        <div class="border-border-subtle mx-3 border-t" aria-hidden="true"></div>
        <div class="flex flex-col gap-2.5 px-3">
          <Textarea
            placeholder="Write a reply…"
            aria-label="Write a reply"
            bind:value={command.draft}
            class="text-body-sm field-sizing-content max-h-40 min-h-16 resize-none overflow-y-auto"
          />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <PanelButton
              label={thread.state === "open" ? "Resolve" : "Reopen"}
              icon={thread.state === "open" ? Check : RotateCcw}
              disabled={command.busy}
              onclick={() => void command.setResolved(thread.id, thread.state !== "open", answer)}
            />
            <PanelButton
              label={command.busy ? "Sending…" : "Reply"}
              tone="primary"
              disabled={command.busy || command.draft.trim().length === 0}
              onclick={() => void command.send(thread.id, answer)}
            />
          </div>
          {#if command.error !== undefined}
            <PanelNote tone="gap">{command.error}</PanelNote>
          {/if}
        </div>

        {#if thread.replies.length > 0}
          <div class="border-border-subtle mx-3 flex items-center border-t pt-2">
            <h4 class="text-caption text-ink-muted m-0 font-semibold tracking-wide uppercase">
              Replies ({thread.replies.length})
            </h4>
          </div>
          {#each thread.replies as remark (remark.id)}
            <PanelQuote
              source={remark.authorLabel}
              when={shortSince(remark.at, now)}
              collapsible={remark.text.length > 280}
              onopen={remark.author?.id === undefined ? undefined : () => inspectActor(remark.author)}
            >
              {remark.text}
            </PanelQuote>
          {/each}
        {/if}
      </section>
    {/if}
  </div>
</Panel>
