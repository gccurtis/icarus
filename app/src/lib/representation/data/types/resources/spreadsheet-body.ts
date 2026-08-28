import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { CellRange } from "$representation/data/types/content/formula-value";
import type { PageSetup } from "$representation/data/types/resources/page-setup";
import type { StyleSet } from "$representation/data/types/resources/style-set";

export type PrintScale = number | "fit-width" | "fit-page";

/**
 * Formatting applied to a region, resolved by overlaying rules in order.
 *
 * Rules rather than a value on every cell: a heavily formatted sheet is hundreds
 * of rules against a hundred million cells. Two corner cells, so inserting a row
 * inside a region extends the formatting — the corners have not moved.
 *
 * A one-off on a single cell stays on the cell.
 */
export type FormatRule = CellRange & {
  /** A key into the body's style set. */
  style?: string;
  format?: BlockFormat;
};

export type SheetPrint = {
  page: PageSetup;
  /** Absent prints the used range. */
  area?: CellRange;
  /** Repeated on every page — what makes a long table readable on paper. */
  repeatRows?: string[];
  repeatColumns?: string[];
  scale?: PrintScale;
  gridlines?: boolean;
  headings?: boolean;
};

/**
 * A row entry carries two positions doing different jobs. Its place in the array
 * is the *ordinal* — the number drawn beside it. Its `order` is a *sort key*,
 * copied onto every cell in it, and the only thing a read can range over.
 */
export type GridRow = { id: string; order: number; height?: number };
export type GridColumn = { id: string; order: number; width?: number };

/**
 * The shape of the grid: what exists, in what order, and what is formatted.
 * The cells themselves are rows in `sheetCells`.
 *
 * Rows are dense — the Nth entry is the Nth row, which is what makes the ordinal
 * free.
 */
export type SpreadsheetBody = {
  rows: GridRow[];
  columns: GridColumn[];
  /** Entries per part, in part order. Read from part 0. */
  rowPartCounts: number[];
  formatRules: FormatRule[];
  frozenRows?: number;
  frozenColumns?: number;
  print: SheetPrint;
  styles: StyleSet;
};
