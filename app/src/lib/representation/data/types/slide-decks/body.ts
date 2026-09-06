import type {
  ContentBlock,
  FormulaBlock,
  ImageBlock,
  PromptBlock,
  TableBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { StyleSet } from "$representation/data/types/slide-decks/style-set";

export type AspectRatio = `${number}:${number}`;

export type Frame = { x: number; y: number; width: number; height: number };

export type Point = { x: number; y: number };

export type SlideBackground =
  | { kind: "color"; color: string }
  | { kind: "image"; fileId: Id<"externalFiles">; fit: "cover" | "contain" };

export type ShapeKind = "rectangle" | "ellipse" | "triangle" | "diamond" | "arrow" | "callout";

export type LineEnd = "none" | "arrow" | "dot";

export type Dash = "solid" | "dashed" | "dotted";

export type ElementPaint = {
  fill?: string;
  stroke?: { color: string; width: number; dash?: Dash };
  opacity?: number;
  cornerRadius?: number;
  shadow?: { color: string; x: number; y: number; blur: number };
};

export type ElementContent =
  | { type: "text"; block: TextBlock }
  | { type: "formula"; block: FormulaBlock }
  | { type: "prompt"; block: PromptBlock }
  | { type: "shape"; shape: ShapeKind; block?: TextBlock }
  | { type: "line"; from: Point; to: Point; ends?: { start?: LineEnd; end?: LineEnd } }
  | { type: "image"; block: ImageBlock }
  | { type: "table"; block: TableBlock; rowHeights?: number[] }
  | { type: "chart"; spec: Record<string, unknown> }
  | { type: "group"; children: SlideElement[] };

export type ElementType = ElementContent["type"];

export type SlideElement = {
  id: string;
  frame: Frame;
  rotation?: number;
  overflow?: "clip" | "shrink" | "grow";
  paint?: ElementPaint;
  locked?: boolean;
  fromPlaceholder?: string;
  content: ElementContent;
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
  id: string;
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
