<script lang="ts">
  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { deckRecord } from "$mock-capabilities/resource";

  /**
   * The deck itself — the lens the slide editor opens with, and the one it falls
   * back to whenever nothing on the canvas is selected.
   *
   * `docs/screen-panel-views/inspector/resource/deck.md` is the specification.
   *
   * **Nothing selected is a section, not an empty panel.** A slide canvas carries
   * no toolbar, so with nothing picked there is nowhere else for the editor to
   * say how to pick something — the same compensation the document editor makes.
   *
   * **No breadcrumb.** A deck is the outermost thing a selection can be inside,
   * so a trail here would have one entry and nowhere to go.
   */
  let { deckId = "r-board" }: { deckId?: string } = $props();

  const deck = $derived(deckRecord(deckId).current);
</script>

<Panel title={deck.title}>
  <PanelSection title="This deck">
    <PanelFields>
      <PanelField label="Title">{deck.title}</PanelField>
      <PanelField label="Slides" mono>{deck.slides}</PanelField>
      <PanelField label="Aspect ratio" mono>{deck.aspectRatio}</PanelField>
      <PanelField label="Saved">{deck.saved}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Nothing selected">
    <PanelNote>
      Click an element to change it, or shift-click for several. New, duplicate and
      delete are at the top of the Slides panel.
    </PanelNote>
  </PanelSection>

  <!-- How the deck prints, which is a different output from the deck. Shut. -->
  <PanelSection title="Handout" open={false}>
    <PanelFields>
      <PanelField label="Paper">{deck.handout.paper}</PanelField>
      <PanelField label="Slides per page" mono>{deck.handout.perPage}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
