import type { Slide, PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import { presentationEdit, idBefore, noPresentationEdit, type Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";
import { freshSlide } from "$app-views/categories/presentation-editor/procedures/presentation-elements";

const inserted = (body: PresentationBody, slide: Slide, after: string | null): Edit =>
  presentationEdit(body, [{ op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }]);

export const withDuplicatedSlide = (body: PresentationBody, slideId: string): Edit => {
  const original = body.slides.find((slide) => slide.id === slideId);
  return original === undefined ? noPresentationEdit(body) : inserted(body, freshSlide(original), original.id);
};

const withoutAnchor = (body: PresentationBody, going: Slide): readonly PresentationOp[] => {
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

export const withoutSlide = (body: PresentationBody, slideId: string): Edit => {
  const going = body.slides.find((slide) => slide.id === slideId);
  if (going === undefined || body.slides.length < 2) return noPresentationEdit(body);
  return presentationEdit(body, [
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

export const withMovedSlide = (body: PresentationBody, slideId: string, afterId: string | null): Edit => {
  const moving = body.slides.find((slide) => slide.id === slideId);
  const wasAfter = idBefore(body.slides, slideId);
  if (moving === undefined || afterId === slideId || afterId === wasAfter) return noPresentationEdit(body);

  const without = body.slides.filter((slide) => slide.id !== slideId);
  if (afterId !== null && !without.some((slide) => slide.id === afterId)) return noPresentationEdit(body);
  return presentationEdit(body, [{ op: "move", target: "slide", path: "slides", id: slideId, after: afterId, wasAfter }]);
};

export const stepped = (body: PresentationBody, slideId: string, way: "up" | "down"): Edit => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  if (at === -1) return noPresentationEdit(body);
  if (way === "up") {
    if (at === 0) return noPresentationEdit(body);
    return withMovedSlide(body, slideId, at === 1 ? null : body.slides[at - 2].id);
  }
  const next = body.slides[at + 1];
  return next === undefined ? noPresentationEdit(body) : withMovedSlide(body, slideId, next.id);
};
