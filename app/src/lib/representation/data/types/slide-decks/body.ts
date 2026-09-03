import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { StyleSet } from "$representation/data/types/slide-decks/style-set";

export type AspectRatio = "16:9" | "4:3";

export type Frame = { x: number; y: number; width: number; height: number };

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

export type SlidePlaceholder = {
  role: string;
  frame: Frame;
  styleKey?: string;
  prompt?: string;
};

export type SlideLayout = {
  key: string;
  name: string;
  locked: SlideElement[];
  placeholders: SlidePlaceholder[];
  background?: SlideBackground;
};

export type DeckSection = { id: string; name: string; firstSlideId: string };

export type DeckTheme = {
  background?: SlideBackground;
  colors: { text: string; accent: string; muted?: string };
  fontFamily?: string;
};

export type SlideDeckBody = {
  aspectRatio: AspectRatio;
  theme: DeckTheme;
  styles: StyleSet;
  layouts: SlideLayout[];
  slides: Slide[];
  sections: DeckSection[];
};
