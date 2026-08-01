import type { DeckSnapshot, Slide, SlideElement } from "../domain/model.js";

export interface SlideDependenciesProjection {
  promptOutputs: Array<{
    slideId: string;
    shapeId: string;
    outputId: string;
    appliedRevision: number;
  }>;
  images: Array<{
    slideId: string;
    shapeId?: string;
    role: "background" | "shape";
    fileId: string;
    version: string;
    digest: string;
    mimeType: string;
  }>;
}

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

/** Exact external references retained by a Deck revision; no I/O is performed. */
export const projectSlideDependencies = (
  snapshot: DeckSnapshot
): SlideDependenciesProjection => {
  const promptOutputs: SlideDependenciesProjection["promptOutputs"] = [];
  const images: SlideDependenciesProjection["images"] = [];

  for (const slideId of snapshot.slideOrder) {
    const slide = snapshot.slides[slideId];
    if (!slide) continue;
    if (slide.background.kind === "image") {
      images.push({
        slideId,
        role: "background",
        ...slide.background.source
      });
    }
    visitElements(slide, slide.rootElementIds, (element) => {
      if (element.elementKind !== "shape") return;
      if (element.shapeKind === "prompt-content") {
        promptOutputs.push({
          slideId,
          shapeId: element.id,
          outputId: element.output.outputId,
          appliedRevision: element.output.appliedRevision
        });
      } else if (element.shapeKind === "image") {
        images.push({
          slideId,
          shapeId: element.id,
          role: "shape",
          ...element.image.source
        });
      }
    });
  }

  return { promptOutputs, images };
};
