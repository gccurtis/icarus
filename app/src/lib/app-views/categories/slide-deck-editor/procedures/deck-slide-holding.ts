import type { Slide, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import { placedOn } from "$app-views/categories/slide-deck-editor/procedures/deck-placement";

export const slideHolding = (body: SlideDeckBody, elementId: string): Slide | undefined =>
  body.slides.find((slide) => placedOn(slide).some((placed) => placed.element.id === elementId));
