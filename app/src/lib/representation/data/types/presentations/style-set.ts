import type { HorizontalAlignment, VerticalAlignment } from "$representation/data/types/content/block-format";

export type TextStyle = {
  name: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  background?: string;
  /** Unitless multiplier. Document styles store absolute CSS pixels instead. */
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  horizontalAlignment?: HorizontalAlignment;
  verticalAlignment?: VerticalAlignment;
  indent?: number;
};

export type StyleSet = { styles: Record<string, TextStyle>; defaultKey: string };
