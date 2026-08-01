import type { DeckSnapshot } from "../domain/model.js";

export interface SlideOutlineItem {
  slideId: string;
  title?: string;
}

/** A discardable outline in the Deck's one authoritative Slide order. */
export const projectSlideOutline = (
  snapshot: DeckSnapshot
): SlideOutlineItem[] => snapshot.slideOrder.map((slideId) => {
  const title = snapshot.slides[slideId]?.title;
  return title === undefined ? { slideId } : { slideId, title };
});
