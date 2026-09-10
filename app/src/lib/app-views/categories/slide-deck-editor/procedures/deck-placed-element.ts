import type { Slide } from "$representation/data/types/slide-decks/body";
import { placedOn, type Placed } from "$app-views/categories/slide-deck-editor/procedures/deck-placement";

export const placedById = (slide: Slide, id: string): Placed | undefined =>
  placedOn(slide).find((placed) => placed.element.id === id);
