import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type {
  DeckSection,
  Frame,
  Slide,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type {
  DeckSection,
  Frame,
  Slide,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";

const isText = (block: ContentBlock): block is TextBlock => block.type === "text";

export const textOf = (element: SlideElement): TextBlock | undefined =>
  element.blocks.find(isText);

export const styleOf = (body: SlideDeckBody, block: TextBlock) =>
  body.styles.styles[block.style ?? body.styles.defaultKey];

export const slideAt = (body: SlideDeckBody, index: number): Slide | undefined =>
  body.slides[index];

/** An element is addressed by its own id: a deck has one id space, flat. */
export const framePath = (elementId: string): string => `${elementId}/frame`;

export type Edit = { readonly body: SlideDeckBody; readonly ops: readonly SlideDeckOp[] };

/**
 * The next body and the op that describes it, together, so the two cannot
 * disagree about what just happened.
 */
export const withElementFrame = (
  body: SlideDeckBody,
  slideId: string,
  elementId: string,
  frame: Frame
): Edit => {
  const was = body.slides
    .find((slide) => slide.id === slideId)
    ?.elements.find((element) => element.id === elementId)?.frame;

  if (was === undefined) return { body, ops: [] };

  return {
    body: {
      ...body,
      slides: body.slides.map((slide) =>
        slide.id !== slideId
          ? slide
          : {
              ...slide,
              elements: slide.elements.map((element) =>
                element.id === elementId ? { ...element, frame } : element
              )
            }
      )
    },
    ops: [{ op: "set", target: "element", path: framePath(elementId), value: frame, was }]
  };
};

const before = <T extends { id: string }>(items: readonly T[], id: string): string | null => {
  const at = items.findIndex((item) => item.id === id);
  return at <= 0 ? null : items[at - 1].id;
};

/**
 * A copy that shares no identity with its original.
 *
 * Written out per block kind rather than by walking for any `id` key: a
 * `ResourceRef` is `{ kind, id }` too, so a generic walk would rewrite what a
 * mark points *at* as though it were the mark.
 */
const freshBlock = (block: ContentBlock): ContentBlock => {
  const id = mint("block");

  switch (block.type) {
    case "text":
    case "prompt":
      return {
        ...block,
        id,
        atoms: block.atoms.map((atom) => ({ ...atom, id: mint("atom") })),
        marks: block.marks.map((mark) => ({ ...mark, id: mint("atom") }))
      };
    case "image":
      return {
        ...block,
        id,
        caption: block.caption === undefined ? undefined : (freshBlock(block.caption) as TextBlock)
      };
    case "table":
      return {
        ...block,
        id,
        rows: block.rows.map((row) => ({
          ...row,
          id: mint("block"),
          cells: row.cells.map((cell) => ({
            ...cell,
            id: mint("block"),
            blocks: cell.blocks.map(freshBlock)
          }))
        }))
      };
    default:
      return { ...block, id };
  }
};

const freshSlide = (slide: Slide): Slide => ({
  ...slide,
  id: mint("slide"),
  elements: slide.elements.map((element) => ({
    ...element,
    id: mint("element"),
    blocks: element.blocks.map(freshBlock)
  })),
  notes: slide.notes.map(freshBlock)
});

const blankSlide = (after: Slide | undefined): Slide => ({
  id: mint("slide"),
  layoutKey: after?.layoutKey,
  elements: [],
  notes: []
});

const inserted = (body: SlideDeckBody, slide: Slide, after: string | null): Edit => ({
  body: {
    ...body,
    slides:
      after === null
        ? [slide, ...body.slides]
        : body.slides.flatMap((held) => (held.id === after ? [held, slide] : [held]))
  },
  ops: [
    { op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }
  ]
});

/** A new slide, empty, taking the layout of the one it follows. */
export const withNewSlide = (body: SlideDeckBody, afterId: string | undefined): Edit => {
  const after = body.slides.find((slide) => slide.id === afterId);
  return inserted(body, blankSlide(after), after?.id ?? null);
};

export const withDuplicatedSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const original = body.slides.find((slide) => slide.id === slideId);
  if (original === undefined) return { body, ops: [] };

  return inserted(body, freshSlide(original), original.id);
};

/**
 * A section is anchored to its first slide, so removing that slide re-anchors
 * the section to whatever now begins it — and drops the section outright when
 * nothing follows. Both are said as ops: the applier is told what happened
 * rather than left to work it out and disagree.
 */
const withoutAnchor = (body: SlideDeckBody, going: Slide): Edit => {
  const at = body.slides.findIndex((slide) => slide.id === going.id);
  const section = body.sections.find((held) => held.firstSlideId === going.id);
  if (section === undefined) return { body, ops: [] };

  const next = body.slides[at + 1];
  if (next === undefined) {
    return {
      body: { ...body, sections: body.sections.filter((held) => held.id !== section.id) },
      ops: [
        {
          op: "remove",
          target: "section",
          path: "sections",
          ids: [section.id],
          after: before(body.sections, section.id),
          values: [section]
        }
      ]
    };
  }

  const moved: DeckSection = { ...section, firstSlideId: next.id };
  return {
    body: {
      ...body,
      sections: body.sections.map((held) => (held.id === section.id ? moved : held))
    },
    ops: [
      {
        op: "set",
        target: "section",
        path: `${section.id}/firstSlideId`,
        value: next.id,
        was: going.id
      }
    ]
  };
};

export const withoutSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const going = body.slides.find((slide) => slide.id === slideId);
  if (going === undefined) return { body, ops: [] };

  const anchor = withoutAnchor(body, going);

  return {
    body: {
      ...anchor.body,
      slides: anchor.body.slides.filter((slide) => slide.id !== slideId)
    },
    ops: [
      ...anchor.ops,
      {
        op: "remove",
        target: "slide",
        path: "slides",
        ids: [slideId],
        after: before(body.slides, slideId),
        values: [going]
      }
    ]
  };
};

export const withMovedSlide = (
  body: SlideDeckBody,
  slideId: string,
  afterId: string | null
): Edit => {
  const moving = body.slides.find((slide) => slide.id === slideId);
  const wasAfter = before(body.slides, slideId);
  if (moving === undefined || afterId === slideId || afterId === wasAfter) {
    return { body, ops: [] };
  }

  const without = body.slides.filter((slide) => slide.id !== slideId);
  if (afterId !== null && !without.some((slide) => slide.id === afterId)) {
    return { body, ops: [] };
  }

  return {
    body: {
      ...body,
      slides:
        afterId === null
          ? [moving, ...without]
          : without.flatMap((held) => (held.id === afterId ? [held, moving] : [held]))
    },
    ops: [{ op: "move", target: "slide", path: "slides", id: slideId, after: afterId, wasAfter }]
  };
};

/**
 * One step up the reel means landing after the slide two places back, and one
 * step down means landing after the next one. `null` is the front of the deck;
 * `undefined` is a step there is no room for.
 */
export const stepped = (body: SlideDeckBody, slideId: string, way: "up" | "down"): Edit => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  if (at === -1) return { body, ops: [] };

  if (way === "up") {
    if (at === 0) return { body, ops: [] };
    return withMovedSlide(body, slideId, at === 1 ? null : body.slides[at - 2].id);
  }

  const next = body.slides[at + 1];
  return next === undefined ? { body, ops: [] } : withMovedSlide(body, slideId, next.id);
};

export const elementBox = (element: SlideElement): string =>
  `left: ${element.frame.x * 100}%; top: ${element.frame.y * 100}%; ` +
  `width: ${element.frame.width * 100}%; height: ${element.frame.height * 100}%` +
  (element.rotation === undefined ? "" : `; rotate: ${element.rotation}deg`);

export const slideLengths = (value: number, units: { width: number }): string =>
  `${(value / units.width) * 100}cqw`;
