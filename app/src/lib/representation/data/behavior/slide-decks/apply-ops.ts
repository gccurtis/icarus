import type {
  DeckSection,
  Frame,
  Slide,
  SlideDeckBody
} from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

const refuse = (op: SlideDeckOp): never => {
  throw new Error(`cannot apply ${op.op} on ${op.target} at ${op.path}`);
};

const insertAfter = <T extends { id: string }>(
  items: readonly T[],
  after: string | null,
  values: readonly T[]
): T[] => {
  if (after === null) return [...values, ...items];

  const at = items.findIndex((item) => item.id === after);
  if (at === -1) throw new Error(`Nothing with id ${after} to insert after.`);

  return [...items.slice(0, at + 1), ...values, ...items.slice(at + 1)];
};

const withoutIds = <T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] => {
  const going = new Set(ids);
  const kept = items.filter((item) => !going.has(item.id));
  if (kept.length + going.size !== items.length) {
    throw new Error(`Not every id of ${[...going].join(", ")} is there to remove.`);
  }

  return kept;
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

const mapSection = (
  body: SlideDeckBody,
  sectionId: string,
  change: (section: DeckSection) => DeckSection
): SlideDeckBody => {
  if (!body.sections.some((section) => section.id === sectionId)) {
    throw new Error(`No section ${sectionId} in the deck.`);
  }

  return {
    ...body,
    sections: body.sections.map((section) =>
      section.id === sectionId ? change(section) : section
    )
  };
};

const applySet = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "set" }>): SlideDeckBody => {
  const [id, field, ...rest] = op.path.split("/");
  if (rest.length > 0) return refuse(op);

  if (op.target === "element" && field === "frame") {
    return mapElement(body, id, () => op.value as Frame);
  }

  if (op.target === "section" && field === "firstSlideId") {
    return mapSection(body, id, (section) => ({
      ...section,
      firstSlideId: op.value as string
    }));
  }

  return refuse(op);
};

const applyInsert = (
  body: SlideDeckBody,
  op: Extract<SlideDeckOp, { op: "insert" }>
): SlideDeckBody => {
  if (op.target === "slide" && op.path === "slides") {
    return { ...body, slides: insertAfter(body.slides, op.after, op.values as Slide[]) };
  }

  if (op.target === "section" && op.path === "sections") {
    return { ...body, sections: insertAfter(body.sections, op.after, op.values as DeckSection[]) };
  }

  return refuse(op);
};

const applyRemove = (
  body: SlideDeckBody,
  op: Extract<SlideDeckOp, { op: "remove" }>
): SlideDeckBody => {
  if (op.target === "slide" && op.path === "slides") {
    return { ...body, slides: withoutIds(body.slides, op.ids) };
  }

  if (op.target === "section" && op.path === "sections") {
    return { ...body, sections: withoutIds(body.sections, op.ids) };
  }

  return refuse(op);
};

const applyMove = (body: SlideDeckBody, op: Extract<SlideDeckOp, { op: "move" }>): SlideDeckBody => {
  if (op.target !== "slide" || op.path !== "slides") return refuse(op);

  const moving = body.slides.find((slide) => slide.id === op.id);
  if (moving === undefined) throw new Error(`No slide ${op.id} to move.`);

  return { ...body, slides: insertAfter(withoutIds(body.slides, [op.id]), op.after, [moving]) };
};

const applyOp = (body: SlideDeckBody, op: SlideDeckOp): SlideDeckBody => {
  switch (op.op) {
    case "set":
      return applySet(body, op);
    case "insert":
      return applyInsert(body, op);
    case "remove":
      return applyRemove(body, op);
    case "move":
      return applyMove(body, op);
    default:
      return refuse(op);
  }
};

export const applyOps = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): SlideDeckBody =>
  ops.reduce(applyOp, body);
