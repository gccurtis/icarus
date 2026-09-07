export type HorizontalAlignment = "start" | "center" | "end" | "justify";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type BorderStyle = "solid" | "dashed" | "dotted";
export type BorderSide = "top" | "right" | "bottom" | "left";
export type BorderLine = { color: string; width: number; style: BorderStyle };
export type Border = Partial<Record<BorderSide, BorderLine>>;

export type BlockFormat = {
  horizontalAlignment?: HorizontalAlignment;
  verticalAlignment?: VerticalAlignment;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  background?: string;
  border?: Border;
  padding?: { x?: number; y?: number };
  indent?: number;
  valueFormat?: string;
};
