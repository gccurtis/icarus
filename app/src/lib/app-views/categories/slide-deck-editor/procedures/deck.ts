import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type {
  Frame,
  Slide,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

export type {
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
