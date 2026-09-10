import type { Mark } from "$representation/data/types/content/content-block";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { PrintScale } from "$representation/data/types/spreadsheets/body";
import type { CellFormat } from "$representation/data/types/spreadsheets/cell-format";
import type { PageSetup } from "$representation/data/types/spreadsheets/page-setup";
import type { StyleSet } from "$representation/data/types/spreadsheets/style-set";

/**
 * What a hole is answered with.
 *
 * `scope` is a group of resources, and it always has an answer: what the caller
 * said, else the default, else the whole project. `text` is words, and it has
 * none until somebody types them, which is why placing a template asks.
 */
export type TemplateHoleKind = "scope" | "text";

export type TemplateHole = {
  name: string;
  label: string;
  description?: string;
  /** Absent means `scope`, which is what every hole was before text ones existed. */
  kind?: TemplateHoleKind;
  /** What a `scope` selects when the caller says nothing. */
  default?: TemplatedResourceSet;
  /** What a `text` says when the caller says nothing. Absent means it must be filled in. */
  text?: string;
};

export type TemplateCell = {
  value?: VariableValue;
  expression?: string;
  marks?: Mark[];
  format?: CellFormat;
  merge?: string;
};

export type TemplateFormatRule = {
  id: string;
  from: string;
  to: string;
  style?: string;
  format?: CellFormat;
};

export type TemplatePrint = {
  page: PageSetup;
  area?: { from: string; to: string };
  repeatRows?: string;
  repeatColumns?: string;
  scale?: PrintScale;
  gridlines?: boolean;
  headings?: boolean;
};

export type SpreadsheetTemplate = {
  cells: Record<string, TemplateCell>;
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
  formatRules: TemplateFormatRule[];
  frozenRows?: number;
  frozenColumns?: number;
  print: TemplatePrint;
  styles: StyleSet;
};

export type TemplateBody =
  | ({ resource: "document" } & DocumentBody)
  | ({ resource: "slides" } & SlideDeckBody)
  | ({ resource: "spreadsheet" } & SpreadsheetTemplate);
