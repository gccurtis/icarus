import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { CellRange } from "$representation/data/types/content/formula-value";
import type { PageSetup } from "$representation/data/types/spreadsheets/page-setup";
import type { StyleSet } from "$representation/data/types/spreadsheets/style-set";

export type PrintScale = number | "fit-width" | "fit-page";

export type FormatRule = CellRange & {
  style?: string;
  format?: BlockFormat;
};

export type SheetPrint = {
  page: PageSetup;
  area?: CellRange;
  repeatRows?: string[];
  repeatColumns?: string[];
  scale?: PrintScale;
  gridlines?: boolean;
  headings?: boolean;
};

export type GridRow = { id: string; order: number; height?: number };
export type GridColumn = { id: string; order: number; width?: number };

export type SpreadsheetBody = {
  rows: GridRow[];
  columns: GridColumn[];
  rowPartCounts: number[];
  formatRules: FormatRule[];
  frozenRows?: number;
  frozenColumns?: number;
  print: SheetPrint;
  styles: StyleSet;
};
