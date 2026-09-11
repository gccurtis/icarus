import type { Slide } from "$representation/data/types/presentations/body";
import { placedOn, type Placed } from "$app-views/categories/presentation-editor/procedures/presentation-placement";

export const placedById = (slide: Slide, id: string): Placed | undefined =>
  placedOn(slide).find((placed) => placed.element.id === id);
