import type { Slide, PresentationBody } from "$representation/data/types/presentations/body";
import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";

export const slideHolding = (body: PresentationBody, elementId: string): Slide | undefined =>
  body.slides.find((slide) => placedOn(slide).some((placed) => placed.element.id === elementId));
