import type { BlockFormat } from "$json-store/types/content/block-format";
import type { FormulaValue } from "$json-store/types/content/formula-value";
import type { Actor } from "$json-store/types/core/actor";
import type { Id } from "$json-store/types/core/id";
import type { ResourceRef } from "$json-store/types/core/resource";
import type { ResourceSet, TemplatedResourceSet } from "$json-store/types/core/resource-set";

export type ResolutionState = "fresh" | "stale" | "computing" | "error";

/** Typed characters. */
export type TextAtom = { id: string; kind: "literal"; text: string };

/**
 * A `{{ }}` span inside prose.
 *
 * `expression` is what the author wrote and travels between projects;
 * `formulaId` is the row that evaluates it, absent where no row exists.
 * `lastResolvedDisplay` is the span `display` concatenates and the marks index.
 */
export type FormulaAtom = {
  id: string;
  kind: "formula";
  expression: string;
  formulaId?: Id<"formulas">;
  lastResolvedValue: FormulaValue;
  lastResolvedDisplay: string;
  state: ResolutionState;
  error?: string;
};

export type Atom = TextAtom | FormulaAtom;

export type MarkStyle = "bold" | "italic" | "underline" | "strikethrough" | "code";

/** Where a marked span points. One field, so a span points at one thing. */
export type MarkLink =
  | { kind: "url"; url: string }
  | { kind: "actor"; actor: Actor }
  | { kind: "persona"; personaId: Id<"personas"> }
  | { kind: "resource"; ref: ResourceRef };

/**
 * A styled range. `from`/`to` are UTF-16 offsets into `display`, never into
 * `atoms` — someone bolding `$4.2M` bolded five characters of what they saw.
 *
 * The id is what makes two people bolding different words in one paragraph merge.
 */
export type Mark = {
  id: string;
  from: number;
  to: number;
  style?: MarkStyle[];
  link?: MarkLink;
  color?: string;
};

export type TextVariant = "paragraph" | "heading" | "list" | "quote" | "code";
export type ListStyle = "bullet" | "ordered" | "todo";

/**
 * Prose, and the five presentations of it.
 *
 * `display` is the atoms' text in order — each literal's `text`, each formula's
 * `lastResolvedDisplay`. A block holds no newlines: one display string, one
 * coordinate space for the marks.
 */
export type TextBlock = {
  id: string;
  type: "text";
  variant: TextVariant;
  level?: number;
  listStyle?: ListStyle;
  checked?: boolean;
  language?: string;
  /** A key into the containing resource's style set, not a copy of its formatting. */
  style?: string;
  atoms: Atom[];
  display: string;
  marks: Mark[];
  resolvedAt?: number;
  format?: BlockFormat;
};

/** A block that is entirely one computation. Unlike an atom, it either computes or errors. */
export type FormulaBlock = {
  id: string;
  type: "formula";
  expression: string;
  formulaId?: Id<"formulas">;
  display: string;
  value: FormulaValue;
  state: ResolutionState;
  error?: string;
  resolvedAt?: number;
  format?: BlockFormat;
};

/** A file row when the picture is project material, a storage id when it is not, a URL when it stays put. */
export type ImageSource =
  | { kind: "file"; fileId: Id<"externalFiles"> }
  | { kind: "storage"; storageId: Id<"_storage"> }
  | { kind: "url"; url: string };

export type Crop = { x: number; y: number; width: number; height: number };

/**
 * `alt` is required: without it an image is a hole in every non-visual consumer.
 * `source` is optional — a picture's place with no picture in it yet.
 */
export type ImageBlock = {
  id: string;
  type: "image";
  source?: ImageSource;
  alt: string;
  caption?: TextBlock;
  crop?: Crop;
  format?: BlockFormat;
};

export type TableCell = {
  id: string;
  blocks: ContentBlock[];
  rowSpan?: number;
  columnSpan?: number;
  format?: BlockFormat;
};

export type TableRow = { id: string; cells: TableCell[] };

/**
 * A handful of rows inside prose. Many rows, formulas across them, and sorting
 * are a spreadsheet's job. `headerRows` counts rather than flags.
 */
export type TableBlock = {
  id: string;
  type: "table";
  rows: TableRow[];
  headerRows: number;
  columnWidths?: number[];
  format?: BlockFormat;
};

/** A live reusable analytic. The owning surface supplies flow or fixed placement. */
export type AnalyticBlock = {
  id: string;
  type: "analytic";
  analyticId: Id<"analyses">;
  /** The surrounding document/slide may already provide the presentation title. */
  showTitle?: boolean;
  format?: BlockFormat;
};

/** A prompt block's five states are the derived output's exactly. */
export type PromptState = "idle" | "fresh" | "stale" | "generating" | "error";

/**
 * A text block with a derived output behind it. The text is the user's and
 * editable in place; the output can refresh it.
 *
 * The prompt lives on the derived output, not here. `derivedOutputId` is absent
 * in a template, which is why `idle` is a state; `scope` is templated there, so
 * its variable terms are filled at instantiation.
 */
export type PromptBlock = {
  id: string;
  type: "prompt";
  derivedOutputId?: Id<"derivedOutputs">;
  atoms: Atom[];
  display: string;
  marks: Mark[];
  scope?: ResourceSet | TemplatedResourceSet;
  state: PromptState;
  error?: string;
  refreshedAt?: number;
  format?: BlockFormat;
};

/** The one content primitive. Each owner enforces its own subset. */
export type ContentBlock =
  | TextBlock
  | FormulaBlock
  | ImageBlock
  | TableBlock
  | AnalyticBlock
  | PromptBlock;
