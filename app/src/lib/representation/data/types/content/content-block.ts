import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, TemplatedResourceSet } from "$representation/data/types/core/resource-set";

export type ResolutionState = "fresh" | "stale" | "computing" | "error";

export type TextAtom = { id: string; kind: "literal"; text: string };

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

/**
 * A hole in a template's prose, filled with words when the template is placed.
 *
 * **It is a template's parameter, not a variable.** A variable in this
 * application is a named value a formula can read; this is unrelated to that and
 * must not borrow the word. What it names is one of the template's own
 * parameters, which is why the kind is `template`: outside a template body and
 * the copy it is edited through, this atom does not belong anywhere.
 *
 * It carries only the name. The label and the description that explain it to
 * whoever fills it in live on the template's parameter of that name, because two
 * atoms may name one parameter and there must be one answer.
 */
export type TemplateAtom = { id: string; kind: "template"; name: string };

export type Atom = TextAtom | FormulaAtom | TemplateAtom;

export type MarkStyle = "bold" | "italic" | "underline" | "strikethrough" | "code";

export type MarkLink =
  | { kind: "url"; url: string; note?: string }
  | { kind: "actor"; actor: Actor }
  | { kind: "persona"; personaId: Id<"personas"> }
  | { kind: "resource"; ref: ResourceRef };

export type MarkEnd = { atom: string; offset: number };

export type Mark = {
  id: string;
  from: MarkEnd;
  to: MarkEnd;
  style?: MarkStyle[];
  link?: MarkLink;
  color?: string;
  background?: string;
};

export type TextVariant = "paragraph" | "heading" | "list" | "quote" | "code";
export type ListStyle = "bullet" | "ordered" | "todo";

export type TextBlock = {
  id: string;
  type: "text";
  variant: TextVariant;
  level?: number;
  listStyle?: ListStyle;
  checked?: boolean;
  language?: string;
  style?: string;
  atoms: Atom[];
  display: string;
  marks: Mark[];
  resolvedAt?: number;
  format?: BlockFormat;
};

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

export type ImageSource =
  | { kind: "file"; fileId: Id<"externalFiles"> }
  | { kind: "storage"; storageId: Id<"_storage"> }
  | { kind: "url"; url: string };

export type Crop = { x: number; y: number; width: number; height: number };

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

export type TableBlock = {
  id: string;
  type: "table";
  rows: TableRow[];
  headerRows: number;
  columnWidths?: number[];
  format?: BlockFormat;
};

export type PromptState = "idle" | "fresh" | "stale" | "generating" | "error";

export type PromptBlock = {
  id: string;
  type: "prompt";
  derivedOutputId?: Id<"derivedOutputs">;
  style?: string;
  atoms: Atom[];
  display: string;
  marks: Mark[];
  scope?: ResourceSet | TemplatedResourceSet;
  state: PromptState;
  error?: string;
  refreshedAt?: number;
  format?: BlockFormat;
};

export type ContentBlock = TextBlock | FormulaBlock | ImageBlock | TableBlock | PromptBlock;
