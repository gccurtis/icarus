export type HorizontalAlignment = "start" | "center" | "end" | "justify";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type BorderStyle = "solid" | "dashed" | "dotted";

/**
 * A block's own box. On the block rather than on whatever holds it, so a
 * container never has to know which of its blocks is being styled.
 */
export type BlockFormat = {
  horizontalAlignment?: HorizontalAlignment;
  /** Means something only when a block sits in a box taller than itself. */
  verticalAlignment?: VerticalAlignment;
  background?: string;
  border?: { color: string; width: number; style: BorderStyle };
  padding?: { x?: number; y?: number };
  /** Here rather than on the value, so one date renders two ways in two places. */
  valueFormat?: string;
};
