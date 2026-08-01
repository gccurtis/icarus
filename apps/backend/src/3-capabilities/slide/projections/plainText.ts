import type { RichText } from "#rich-text";
import type {
  DeckSnapshot,
  Slide,
  SlideElement
} from "../domain/model.js";

const visitElements = (
  slide: Slide,
  elementIds: readonly string[],
  visit: (element: SlideElement) => void
): void => {
  for (const elementId of elementIds) {
    const element = slide.elements[elementId];
    if (!element) continue;
    visit(element);
    if (element.elementKind === "group") {
      visitElements(slide, element.childElementIds, visit);
    }
  }
};

/**
 * Projects only text already owned by the Deck revision. Prompt Content is
 * resolved separately from its exact Derived Output revision by deck.load.
 */
export const projectSlidePlainText = (
  snapshot: DeckSnapshot,
  richText: RichText
): string => {
  const parts: string[] = [];
  for (const slideId of snapshot.slideOrder) {
    const slide = snapshot.slides[slideId];
    if (!slide) continue;
    if (slide.title) parts.push(slide.title);
    const notes = richText.plainText(slide.notes.atoms);
    if (notes) parts.push(notes);
    visitElements(slide, slide.rootElementIds, (element) => {
      if (element.elementKind !== "shape") return;
      switch (element.shapeKind) {
        case "text": {
          const text = richText.plainText(element.content.atoms);
          if (text) parts.push(text);
          break;
        }
        case "image":
          if (!element.image.decorative && element.image.alt) {
            parts.push(element.image.alt);
          }
          break;
        case "chart":
          if (element.chart.specification.title) {
            parts.push(element.chart.specification.title);
          }
          break;
        default:
          break;
      }
    });
  }
  return parts.join("\n");
};
