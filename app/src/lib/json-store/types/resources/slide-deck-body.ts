import type { BlockFormat } from "$json-store/types/content/block-format";
import type { ContentBlock } from "$json-store/types/content/content-block";
import type { Id } from "$json-store/types/core/id";
import type { PageSetup } from "$json-store/types/resources/page-setup";
import type { StyleSet } from "$json-store/types/resources/style-set";

/** A deck's shape. Frames are fractions of the slide, so it never changes. */
export type AspectRatio = "16:9" | "4:3";

/** A rectangle as fractions of the slide. */
export type Frame = { x: number; y: number; width: number; height: number };

/** A flat colour or an uploaded file — never inline bytes, so a deck body stays small. */
export type SlideBackground =
  | { kind: "color"; color: string }
  | { kind: "image"; fileId: Id<"externalFiles">; fit: "cover" | "contain" };

export type SlideElement = {
  id: string;
  frame: Frame;
  rotation?: number;
  blocks: ContentBlock[];
  overflow: "clip" | "shrink" | "grow";
  fromPlaceholder?: string;
  format?: BlockFormat;
};

export type Slide = {
  id: string;
  layoutKey?: string;
  elements: SlideElement[];
  notes: ContentBlock[];
  background?: SlideBackground;
  hidden?: boolean;
};

/** An editable position a layout offers. Applying the layout turns it into a real element. */
export type SlidePlaceholder = {
  role: string;
  frame: Frame;
  styleKey?: string;
  prompt?: string;
};

/**
 * The master concept in two fields: `locked` elements are drawn on every slide
 * using the layout and cannot be edited there; `placeholders` are the positions
 * applying the layout fills.
 *
 * Named by `key` rather than an id, like a style.
 */
export type SlideLayout = {
  key: string;
  name: string;
  locked: SlideElement[];
  placeholders: SlidePlaceholder[];
  background?: SlideBackground;
};

/**
 * A named run of slides, anchored by its first slide only — each section runs
 * until the next begins.
 *
 * A start-and-end section breaks the moment a slide is inserted or moved; one
 * anchor absorbs inserts, and reordering slides reorders sections with them.
 */
export type DeckSection = { id: string; name: string; firstSlideId: string };

export type DeckTheme = {
  background?: SlideBackground;
  colors: { text: string; accent: string; muted?: string };
  fontFamily?: string;
};

/** `handout` is the deck's printed form, separate from its own geometry: a slide is not a page. */
export type SlideDeckBody = {
  theme: DeckTheme;
  styles: StyleSet;
  layouts: SlideLayout[];
  slides: Slide[];
  sections: DeckSection[];
  handout?: PageSetup;
};
