import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { Mark } from "$representation/data/types/content/content-block";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { PrintScale } from "$representation/data/types/spreadsheets/body";
import type { PageSetup } from "$representation/data/types/spreadsheets/page-setup";
import type { StyleSet } from "$representation/data/types/spreadsheets/style-set";

/**
 * What a variable is answered with.
 *
 * `scope` is a group of resources, and it always has an answer: what the caller
 * said, else the default, else the whole project. `text` is words, and it has
 * none until somebody types them, which is why placing a template asks.
 */
export type TemplateVariableKind = "scope" | "text";

export type TemplateVariable = {
  name: string;
  label: string;
  description?: string;
  /** Absent means `scope`, which is what every variable was before text ones existed. */
  kind?: TemplateVariableKind;
  default?: TemplatedResourceSet;
};

export type TemplateCell = {
  value?: VariableValue;
  expression?: string;
  marks?: Mark[];
  format?: BlockFormat;
  merge?: string;
};

export type TemplateFormatRule = {
  from: string;
  to: string;
  style?: string;
  format?: BlockFormat;
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
