import type {
  HorizontalAlignment,
  VerticalAlignment
} from "$representation/data/types/content/block-format";

export type BorderStyle = "solid" | "dashed" | "dotted";

export type BorderSide = "top" | "right" | "bottom" | "left";

export type BorderLine = { color: string; width: number; style: BorderStyle };

/**
 * What is drawn on each edge of a cell.
 *
 * A side at a time rather than one box, because a person picks the sides they
 * are styling and a thick rule under a heading row is not the same object as a
 * hairline down its left.
 */
export type CellBorder = Partial<Record<BorderSide, BorderLine>>;

/**
 * How one cell is painted.
 *
 * A cell is not a paragraph: it has no line height, no space before or after,
 * and no indent, and it does have a border and a number format. Sharing the
 * document's block format made every sheet change reach into the deck and the
 * document, so the sheet owns this one.
 */
export type CellFormat = {
  horizontalAlignment?: HorizontalAlignment;
  verticalAlignment?: VerticalAlignment;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  background?: string;
  border?: CellBorder;
  valueFormat?: string;
};
