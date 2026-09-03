import type { Frame, Slide, SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

const refuse = (op: SlideDeckOp): never => {
  throw new Error(
    `slide-deck/submit-slide-deck-changes cannot apply ${op.op} on ${op.target} at ${op.path}`
  );
};

/**
 * One id space per deck, so an element is found by its own id alone. That is
 * what lets an element move between slides without a path being rewritten.
 */
const mapElement = (
  body: SlideDeckBody,
  elementId: string,
  change: (frame: Frame) => Frame
): SlideDeckBody => {
  const holding = body.slides.find((slide) =>
    slide.elements.some((element) => element.id === elementId)
  );
  if (holding === undefined) throw new Error(`No element ${elementId} on any slide.`);

  const next = (slide: Slide): Slide => ({
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId ? { ...element, frame: change(element.frame) } : element
    )
  });

  return {
    ...body,
    slides: body.slides.map((slide) => (slide.id === holding.id ? next(slide) : slide))
  };
};

const applySet = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "set" }>): SlideDeckBody => {
  const [id, field, ...rest] = op.path.split("/");
  if (rest.length > 0) return refuse(op);

  if (op.target === "element" && field === "frame") {
    return mapElement(body, id, () => op.value as Frame);
  }

  return refuse(op);
};

const applyOp = (body: SlideDeckBody, op: SlideDeckOp): SlideDeckBody =>
  op.op === "set" ? applySet(body, op) : refuse(op);

export const applyOps = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): SlideDeckBody =>
  ops.reduce(applyOp, body);
