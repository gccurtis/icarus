import type { DeckSection, Slide, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { TextBlock } from "$representation/data/types/content/content-block";
import { deckEdit, type Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";

export const slideAt = (body: SlideDeckBody, index: number): Slide | undefined => body.slides[index];

export const slideIndexOf = (body: SlideDeckBody, slideId: string | undefined): number => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  return at === -1 ? 0 : at;
};

export const notesBlock = (slide: Slide): TextBlock | undefined =>
  slide.notes.find((block): block is TextBlock => block.type === "text");

export const withNotes = (body: SlideDeckBody, slideId: string, block: TextBlock): Edit =>
  deckEdit(body, [{
    op: "insert",
    target: "block",
    path: `${slideId}/notes`,
    ids: [block.id],
    after: null,
    values: [block]
  }]);

export const sectionOf = (body: SlideDeckBody, slideId: string): DeckSection | undefined => {
  let found: DeckSection | undefined;
  for (const slide of body.slides) {
    const starts = body.sections.find((section) => section.firstSlideId === slide.id);
    if (starts) found = starts;
    if (slide.id === slideId) return found;
  }
  return undefined;
};
