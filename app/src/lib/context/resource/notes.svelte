<script lang="ts">
  import {
    Panel,
    PanelEditableText,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { notesFor, notesIn } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Speaker notes, for this slide and across the deck.
   *
   * `docs/screen-panel-views/context/resource/notes.md` is the specification.
   * Notes are not on the canvas: a tray under a 16:9 slide costs the height that
   * zooming needs, and notes are read while presenting rather than while
   * designing.
   *
   * The deck list selects rather than previews. A per-slide preview is expensive
   * and a paragraph count answers the question this section exists for — where
   * the gaps are, before a rehearsal rather than during one.
   */
  let { deckId = "r-board", slideId = "sl-4" }: { deckId?: string; slideId?: string } = $props();

  const currentId = $derived(
    mockWorkbench.selection?.kind === "slide" ? mockWorkbench.selection.id : slideId
  );

  const notes = $derived(notesFor(currentId).current);
  const deck = $derived(notesIn(deckId).current);

  /** Edits are held per slide: no door writes notes, and switching slides must not carry a draft. */
  let drafts = $state<Record<string, string>>({});
  const shown = $derived(drafts[currentId] ?? notes.content);
</script>

<Panel title="Notes">
  <PanelSection title="Slide {notes.index}" count={notes.summary}>
    <PanelEditableText
      label="Speaker notes for slide {notes.index}"
      value={shown}
      placeholder="No notes"
      multiline
      onchange={(next: string) => (drafts = { ...drafts, [currentId]: next })}
    />
  </PanelSection>

  <PanelSection title="Deck" count={deck.length} flush>
    {#each deck as entry (entry.slideId)}
      <PanelRow
        title="{entry.index} · {entry.title}"
        meta={entry.summary}
        tone={entry.summary === "No notes" ? "attention" : "default"}
        selected={entry.slideId === currentId}
        onselect={() =>
          mockWorkbench.inspect("resource.slide", { kind: "slide", id: entry.slideId })}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    Selecting a slide here moves the section above onto it. The same notes also
    appear in the slide inspector and in a notes lens of their own; which of the
    three is authoritative is not settled.
  </PanelNote>
</Panel>
