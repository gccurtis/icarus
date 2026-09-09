import type { TextBlock } from "$representation/data/types/content/content-block";
import type {
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";

type Fields = Record<string, unknown>;

const fields = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const reserveIdentifiers = (value: unknown, identifiers: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const nested of value) reserveIdentifiers(nested, identifiers);
    return;
  }
  if (!fields(value)) return;
  if (typeof value.id === "string") identifiers.add(value.id);
  for (const nested of Object.values(value)) reserveIdentifiers(nested, identifiers);
};

const identifierMint = (body: SlideDeckBody) => {
  const identifiers = new Set<string>();
  reserveIdentifiers(body, identifiers);

  return (suggested: string): string => {
    const stem = suggested.slice(0, 460) || "slide-node";
    let candidate = stem;
    let suffix = 2;
    while (identifiers.has(candidate)) {
      candidate = `${stem}-${suffix}`;
      suffix += 1;
    }
    identifiers.add(candidate);
    return candidate;
  };
};

const emptyShapeBlock = (id: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [],
  display: "",
  marks: []
});

const readyElement = (
  element: SlideElement,
  mint: (suggested: string) => string
): SlideElement => {
  if (element.content.type === "shape" && element.content.block === undefined) {
    return {
      ...element,
      content: {
        ...element.content,
        block: emptyShapeBlock(mint(`${element.id}-text`))
      }
    };
  }
  if (element.content.type !== "group") return element;
  return {
    ...element,
    content: {
      ...element.content,
      children: element.content.children.map((child) => readyElement(child, mint))
    }
  };
};

/** Fulfil editor invariants within the one current slide-deck schema. */
export const ensureSlideDeckReady = (body: SlideDeckBody): SlideDeckBody => {
  const mint = identifierMint(body);
  const layouts = body.layouts.map((layout) => ({
    ...layout,
    locked: layout.locked.map((element) => readyElement(element, mint))
  }));
  const slides =
    body.slides.length === 0
      ? [{ id: mint("slide-1"), elements: [], notes: [] }]
      : body.slides.map((slide) => ({
          ...slide,
          elements: slide.elements.map((element) => readyElement(element, mint))
        }));
  return { ...body, layouts, slides };
};
