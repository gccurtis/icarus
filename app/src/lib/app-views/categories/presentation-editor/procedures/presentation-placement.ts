import type { Frame, Slide, SlideElement } from "$representation/data/types/presentations/body";
import { within } from "$app-views/categories/presentation-editor/procedures/presentation-geometry";

export type Placed = {
  readonly element: SlideElement;
  readonly frame: Frame;
  readonly depth: number;
  readonly parents: readonly string[];
};

const walk = (
  elements: readonly SlideElement[],
  outer: Frame | undefined,
  depth: number,
  parents: readonly string[],
  into: Placed[]
): void => {
  for (const element of elements) {
    const frame = outer === undefined ? element.frame : within(outer, element.frame);
    into.push({ element, frame, depth, parents });
    if (element.content.type === "group") {
      walk(element.content.children, frame, depth + 1, [...parents, element.id], into);
    }
  }
};

export const placedOn = (slide: Slide): readonly Placed[] => {
  const into: Placed[] = [];
  walk(slide.elements, undefined, 0, [], into);
  return into;
};
