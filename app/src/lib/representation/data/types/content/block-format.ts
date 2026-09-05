export type HorizontalAlignment = "start" | "center" | "end" | "justify";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type BorderStyle = "solid" | "dashed" | "dotted";

export type BlockFormat = {
  horizontalAlignment?: HorizontalAlignment;
  verticalAlignment?: VerticalAlignment;
  background?: string;
  border?: { color: string; width: number; style: BorderStyle };
  padding?: { x?: number; y?: number };
  spaceBefore?: number;
  spaceAfter?: number;
  lineHeight?: number;
  indent?: number;
  valueFormat?: string;
};
