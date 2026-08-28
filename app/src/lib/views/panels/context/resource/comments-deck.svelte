<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import {
    Panel,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { commentsOn, element, slide, type ResourceComment } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Conversation on the deck.
   *
   * `docs/screen-panel-views/context/resource/comments-deck.md` is the
   * specification. Three chips scope the list to the deck, the current slide or
   * the selected element; the chips carry the resolved subject — "Slide 4", the
   * element's own name — because a chip reading "Slide" tells the reader the
   * category they already knew.
   *
   * Every row names its anchor. Under the deck-wide chip the list mixes three
   * granularities, and a remark whose subject has to be guessed is a remark the
   * reader has to go and find.
   */
  let { deckId = "r-board", slideId = "sl-4" }: { deckId?: string; slideId?: string } = $props();

  const view = viewState();

  const threads = $derived(commentsOn(deckId).current);
  const current = $derived(slide(slideId).current);

  const selectedElementId = $derived(
    view.selection?.kind === "element" ? view.selection.id : undefined
  );
  const elementName = $derived(
    selectedElementId === undefined ? undefined : element(selectedElementId).current.name
  );

  let scope = $state<"deck" | "slide" | "element">("deck");

  const SCOPES = $derived([
    { value: "deck", label: "Deck" },
    { value: "slide", label: `Slide ${current.index}` },
    { value: "element", label: elementName ?? "Element" }
  ]);

  const inScope = (comment: ResourceComment) => {
    if (scope === "deck") return true;
    if (scope === "slide") return comment.anchor.slide === current.index;
    return comment.anchor.scope === "element" && comment.anchor.slide === current.index;
  };

  const scoped = $derived(threads.filter(inScope));
  const open = $derived(scoped.filter((comment) => comment.state === "open"));
  const resolved = $derived(scoped.filter((comment) => comment.state === "resolved"));

  const where = (comment: ResourceComment) => comment.anchor.label ?? "Deck";
</script>

<Panel title="Comments">
  <PanelChoice
    label="Scope"
    value={scope}
    options={SCOPES}
    onchange={(next: string) => (scope = next as typeof scope)}
  />

  <PanelSection title="Open" count={open.length} flush>
    {#each open as comment (comment.id)}
      <PanelRow
        title={comment.authorName}
        sub={comment.body}
        meta={comment.age}
        icon={comment.mentionsViewer ? AtSign : MessageSquare}
        tone={comment.mentionsViewer ? "attention" : "default"}
        onselect={() =>
          view.inspect("collaboration.comment", { kind: "comment", id: comment.id })}
      >
        <!-- The title line carries the anchor as well as the author, so a row read
             out of the deck-wide list still says what it is about. -->
        {#snippet children()}
          <span class="flex min-w-0 items-baseline gap-1.5">
            <span class="text-body-sm text-ink-primary truncate">{comment.authorName}</span>
            <span class="text-caption text-ink-muted truncate">{where(comment)}</span>
          </span>
        {/snippet}
      </PanelRow>
    {/each}
  </PanelSection>

  <!-- Shut on arrival: a settled thread qualifies the conversation rather than being it. -->
  <PanelSection title="Resolved" count={resolved.length} open={false} flush>
    {#if resolved.length === 0}
      <PanelNote>Nothing resolved yet.</PanelNote>
    {/if}

    {#each resolved as comment (comment.id)}
      <PanelRow
        title={comment.authorName}
        sub={comment.body}
        meta={comment.age}
        icon={MessageSquare}
        onselect={() =>
          view.inspect("collaboration.comment", { kind: "comment", id: comment.id })}
      >
        {#snippet children()}
          <span class="flex min-w-0 items-baseline gap-1.5">
            <span class="text-body-sm text-ink-secondary truncate">{comment.authorName}</span>
            <span class="text-caption text-ink-muted truncate">{where(comment)}</span>
          </span>
        {/snippet}
      </PanelRow>
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Whether a comment can anchor to an element at all, or only to a slide, is not
    settled. The document editor anchors to a text range; a deck's equivalent has
    no agreed target.
  </PanelNote>
</Panel>
