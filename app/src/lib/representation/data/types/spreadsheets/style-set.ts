import type {
  HorizontalAlignment,
  VerticalAlignment
} from "$representation/data/types/content/block-format";
import type { CellBorder } from "$representation/data/types/spreadsheets/cell-format";

/**
 * A named way to paint a cell.
 *
 * The same vocabulary as a cell's own format, plus the name it is chosen by. A
 * cell format set on the cell wins over the style it names.
 */
export type CellStyle = {
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
  horizontalAlignment?: HorizontalAlignment;
  verticalAlignment?: VerticalAlignment;
  border?: CellBorder;
  valueFormat?: string;
};

export type StyleSet = { styles: Record<string, CellStyle>; defaultKey: string };
