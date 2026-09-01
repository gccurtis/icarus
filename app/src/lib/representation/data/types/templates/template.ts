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
 * What the author made, which is not the same as which body it holds.
 *
 * `deck` and `slide` both carry a slides body — a single-slide template is a
 * deck body holding one slide, because that is what carries the theme and the
 * layouts it has to be previewed against.
 */
export type TemplateKind = "document" | "deck" | "slide" | "spreadsheet";

/**
 * One question a template asks when it is instantiated.
 *
 * `name` is what a `{ select: "variable" }` term names. Nothing lists which
 * blocks the answer reaches — instantiation walks the body and fills every term
 * naming this variable, so there is no id list that can point at a block the
 * body no longer has.
 *
 * A default may only use templated terms, so it means something in whatever
 * project the template lands in.
 */
export type TemplateVariable = {
  name: string;
  /** What the person filling it in is asked. */
  label: string;
  description?: string;
  default?: TemplatedResourceSet;
};

/**
 * One cell as a template holds it. An expression rather than a formula id: a
 * formula is a row scoped to one project, and the text an author wrote is the
 * portable form.
 */
export type TemplateCell = {
  value?: VariableValue;
  /** The expression as authored, when the cell computes. */
  expression?: string;
  marks?: Mark[];
  format?: BlockFormat;
  /** `"D4"` — the far corner of a merge. */
  merge?: string;
};

/** Addressed rather than identified, like everything else in a spreadsheet template. */
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

/**
 * A spreadsheet as a template holds it: **addressed, never identified.**
 *
 * A live grid names its rows and columns by ids that exist only in that
 * resource. A template has no resource to point at, so everything here is keyed
 * by the address a person reads — `"B7"`, `"A"`, `"3"` — and nothing in it can
 * dangle. It is the one template body that is a projection rather than a copy.
 */
export type SpreadsheetTemplate = {
  cells: Record<string, TemplateCell>;
  /** Keyed by the ruler label — `"A"`, `"3"`. */
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
  formatRules: TemplateFormatRule[];
  frozenRows?: number;
  frozenColumns?: number;
  print: TemplatePrint;
  styles: StyleSet;
};

/**
 * A real resource body with a label on it. Spread rather than nested, because
 * the body *is* the thing it makes — a template is authored in the ordinary
 * editor.
 *
 * `resource` answers which of the three shapes is here; the row's `kind` answers
 * what the author made. `aspectRatio` rides on the slides member because a
 * deck's shape lives on its row rather than in its body.
 */
export type TemplateBody =
  | ({ resource: "document" } & DocumentBody)
  | ({ resource: "slides" } & SlideDeckBody)
  | ({ resource: "spreadsheet" } & SpreadsheetTemplate);
