import type { Slide, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { deckEdit, idBefore, noDeckEdit, type Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { freshSlide } from "$app-views/categories/slide-deck-editor/procedures/deck-elements";

const inserted = (body: SlideDeckBody, slide: Slide, after: string | null): Edit =>
  deckEdit(body, [{ op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }]);

export const withDuplicatedSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const original = body.slides.find((slide) => slide.id === slideId);
  return original === undefined ? noDeckEdit(body) : inserted(body, freshSlide(original), original.id);
};

const withoutAnchor = (body: SlideDeckBody, going: Slide): readonly SlideDeckOp[] => {
  const at = body.slides.findIndex((slide) => slide.id === going.id);
  const section = body.sections.find((held) => held.firstSlideId === going.id);
  if (section === undefined) return [];

  const next = body.slides[at + 1];
  if (next === undefined) {
    return [{
      op: "remove",
      target: "section",
      path: "sections",
      ids: [section.id],
      after: idBefore(body.sections, section.id),
      values: [section]
    }];
  }
  return [{ op: "set", target: "section", path: `${section.id}/firstSlideId`, value: next.id, was: going.id }];
};

export const withoutSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const going = body.slides.find((slide) => slide.id === slideId);
  if (going === undefined || body.slides.length < 2) return noDeckEdit(body);
  return deckEdit(body, [
    ...withoutAnchor(body, going),
    {
      op: "remove",
      target: "slide",
      path: "slides",
      ids: [slideId],
      after: idBefore(body.slides, slideId),
      values: [going]
    }
  ]);
};

export const withMovedSlide = (body: SlideDeckBody, slideId: string, afterId: string | null): Edit => {
  const moving = body.slides.find((slide) => slide.id === slideId);
  const wasAfter = idBefore(body.slides, slideId);
  if (moving === undefined || afterId === slideId || afterId === wasAfter) return noDeckEdit(body);

  const without = body.slides.filter((slide) => slide.id !== slideId);
  if (afterId !== null && !without.some((slide) => slide.id === afterId)) return noDeckEdit(body);
  return deckEdit(body, [{ op: "move", target: "slide", path: "slides", id: slideId, after: afterId, wasAfter }]);
};

export const stepped = (body: SlideDeckBody, slideId: string, way: "up" | "down"): Edit => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  if (at === -1) return noDeckEdit(body);
  if (way === "up") {
    if (at === 0) return noDeckEdit(body);
    return withMovedSlide(body, slideId, at === 1 ? null : body.slides[at - 2].id);
  }
  const next = body.slides[at + 1];
  return next === undefined ? noDeckEdit(body) : withMovedSlide(body, slideId, next.id);
};
