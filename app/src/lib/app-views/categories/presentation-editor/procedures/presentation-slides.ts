import type { PresentationSection, Slide, PresentationBody } from "$representation/data/types/presentations/body";
import type { TextBlock } from "$representation/data/types/content/content-block";
import { presentationEdit, type Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";

export const slideAt = (body: PresentationBody, index: number): Slide | undefined => body.slides[index];

export const slideIndexOf = (body: PresentationBody, slideId: string | undefined): number => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  return at === -1 ? 0 : at;
};

export const notesBlock = (slide: Slide): TextBlock | undefined =>
  slide.notes.find((block): block is TextBlock => block.type === "text");

export const withNotes = (body: PresentationBody, slideId: string, block: TextBlock): Edit =>
  presentationEdit(body, [{
    op: "insert",
    target: "block",
    path: `${slideId}/notes`,
    ids: [block.id],
    after: null,
    values: [block]
  }]);

export const sectionOf = (body: PresentationBody, slideId: string): PresentationSection | undefined => {
  let found: PresentationSection | undefined;
  for (const slide of body.slides) {
    const starts = body.sections.find((section) => section.firstSlideId === slide.id);
    if (starts) found = starts;
    if (slide.id === slideId) return found;
  }
  return undefined;
};
