import type { HorizontalAlignment } from "$representation/data/types/content/block-format";

export type TextStyle = {
  name: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  horizontalAlignment?: HorizontalAlignment;
  indent?: number;
};

export type StyleSet = { styles: Record<string, TextStyle>; defaultKey: string };
