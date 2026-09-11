<script lang="ts">
  import { startCommentCommand } from "$app-views/categories/presentation-editor/procedures/start-comment-command.svelte";
  import { Panel, PanelButton, PanelChoice, PanelEmpty, PanelNote, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import {
    commentsQuery,
    peopleIn,
    remarksIn,
    remarksOf,
    threadsIn,
    type CommentThread
  } from "$app-views/categories/presentation-editor/procedures/comments";
  import { ago, nameOf, textOf } from "$app-views/categories/presentation-editor/procedures/comment-copy";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn, labelOf } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { selectedIds } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { resourceTemplate } from "$app-views/categories/presentation-editor/procedures/templating";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const slide = $derived(body?.slides[body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined)]);
  const selected = $derived(selectedIds(view.selection)[0]);
  const element = $derived(body === undefined || selected === undefined ? undefined : elementIn(body, selected));

  const commentFeed = commentsQuery();
  const templateQuery = $derived(presentationId === undefined ? undefined : resourceTemplate(presentationId));
  const workingCopy = $derived(templateQuery?.ready === true && templateQuery.current.stage !== null);

  const threads = $derived(
    threadsIn(commentFeed).filter(
      (thread) => thread.target.kind === "presentation" && thread.target.id === presentationId
    )
  );
  const comments = $derived(remarksIn(commentFeed));
  const users = $derived(peopleIn(commentFeed));
  const now = Date.now();

  let wanted = $state("presentation");
  const chips = $derived([
    { value: "presentation", label: "Presentation" },
    ...(slide ? [{ value: "slide", label: `Slide ${slideIndexOf(body!, slide.id) + 1}` }] : []),
    ...(element ? [{ value: "element", label: labelOf(element) }] : [])
  ]);
  const chip = $derived(chips.some((held) => held.value === wanted) ? wanted : "presentation");

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
    return position === undefined ? "Presentation" : `Slide ${position}`;
  };

  const firstComment = (thread: CommentThread) => remarksOf(comments, thread._id)[0];

  const shown = $derived(threads.filter(matches).sort((a, b) => b._creationTime - a._creationTime));
  const open = $derived(shown.filter((thread) => thread.resolution === undefined));
  const resolved = $derived(shown.filter((thread) => thread.resolution !== undefined));

  let composing = $state("");
  const commentCommand = startCommentCommand();
  const posting = $derived(commentCommand.posting);

  const subject = $derived(chip === "element" && element ? labelOf(element) : chip === "slide" && slide && body ? `slide ${slideIndexOf(body, slide.id) + 1}` : "the presentation");

  const post = () => {
    const text = composing.trim();
    if (presentationId === undefined || text === "" || posting) return;
    const within =
      chip === "element" && selected !== undefined
        ? { kind: "element" as const, elementId: selected }
        : chip === "slide" && slide !== undefined
          ? { kind: "slide" as const, slideId: slide.id }
          : undefined;
    commentCommand.start(
      {
        presentationId,
        within,
        text
      },
      () => (composing = "")
    );
  };

  const openThread = (thread: CommentThread) =>
    view.inspect("presentation-editor.comment", { kind: "comment", id: thread._id });
</script>

<Panel title="Comments">
  {#snippet actions()}
    <PanelChoice label="Show" value={chip} options={chips} flush fill onchange={(value) => (wanted = value)} />
  {/snippet}

  {#if body && workingCopy}
    <PanelNote tone="gap">A template's working copy takes no comments; they never travel with a template.</PanelNote>
  {:else if body}
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
    <PanelEmpty title="Open a presentation to see its comments" />
  {/if}
</Panel>
