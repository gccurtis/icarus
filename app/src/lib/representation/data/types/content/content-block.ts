import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, TemplatedResourceSet } from "$representation/data/types/core/resource-set";

export type TextAtom = { id: string; kind: "literal"; text: string };

type FormulaBinding =
  | { formulaId?: never }
  | { formulaId: Id<"formulas"> };

/**
 * One currently resolved inline formula.
 *
 * Content has no formula evaluator today, so it has no persisted pending,
 * stale, or failed lifecycle. A project body may bind the snapshot to its
 * formula row; a portable template deliberately omits that binding.
 */
export type FormulaAtom = FormulaBinding & {
  id: string;
  kind: "formula";
  expression: string;
  lastResolvedValue: FormulaValue;
  lastResolvedDisplay: string;
  state: "fresh";
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
/**
 * A hole in the prose, made by turning a run of text into one.
 *
 * `text` is what the selection said, kept as what the hole says when nobody
 * says otherwise — so a template placed with every default reads exactly like
 * the document it was made from.
 */
export type TemplateAtom = {
  id: string;
  kind: "template";
  name: string;
  description?: string;
  text?: string;
};

export type Atom = TextAtom | FormulaAtom | TemplateAtom;

export type MarkStyle = "bold" | "italic" | "underline" | "strikethrough" | "code";

export type MarkLink =
  | { kind: "url"; url: string; note?: string }
  | { kind: "actor"; actor: Actor }
  | { kind: "persona"; personaId: Id<"personas"> }
  | { kind: "resource"; ref: ResourceRef };

export type MarkEnd = { atom: string; offset: number };

/**
 * A run marked as a hole: a template made from this body puts one here.
 *
 * Marking changes nothing. The words stay where they are, every other mark over
 * them stays, and the resource reads exactly as it did — a hole is a note about
 * where a template's argument goes, not an edit. The run only becomes a
 * template atom on the copy, when the template is made.
 */
export type MarkHole = { name: string; description?: string };

export type Mark = {
  id: string;
  from: MarkEnd;
  to: MarkEnd;
  style?: MarkStyle[];
  link?: MarkLink;
  color?: string;
  background?: string;
  hole?: MarkHole;
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

/** A whole-block resolved formula snapshot; binding is optional only for portability. */
export type FormulaBlock = FormulaBinding & {
  id: string;
  type: "formula";
  expression: string;
  display: string;
  value: FormulaValue;
  state: "fresh";
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

export type PromptState = "idle" | "fresh" | "stale" | "error";

/**
 * What this prompt becomes when its resource is made a template.
 *
 * Every prompt becomes one hole, so this is what the hole is called and what it
 * says rather than whether there is one. Absent means the name is still the
 * offered default, which is why nothing has to be filled in to make a template.
 */
export type PromptHole = {
  name: string;
  description?: string;
};

type PromptBlockPresentation = {
  id: string;
  type: "prompt";
  style?: string;
  atoms: Atom[];
  display: string;
  marks: Mark[];
  hole?: PromptHole;
  format?: BlockFormat;
};

type UnlinkedPromptLifecycle = {
  state: "idle";
  error?: never;
  refreshedAt?: never;
};

type LinkedPromptLifecycle =
  | { state: "idle"; error?: never; refreshedAt?: never }
  | { state: "stale"; error?: never; refreshedAt?: number }
  | { state: "fresh"; error?: never; refreshedAt: number }
  | { state: "error"; error: string; refreshedAt?: number };

type PromptBlockBase<Lifecycle> = PromptBlockPresentation & Lifecycle;

/** An editable prompt whose definition is owned by the block itself. */
export type UnlinkedPromptBlock = PromptBlockBase<UnlinkedPromptLifecycle> & {
  derivedOutputId?: never;
  scope?: ResourceSet | TemplatedResourceSet;
  prompt?: string;
};

/** A generated prompt whose definition is owned only by its Derived Output. */
export type LinkedPromptBlock = PromptBlockBase<LinkedPromptLifecycle> & {
  derivedOutputId: Id<"derivedOutputs">;
  scope?: never;
  prompt?: never;
};

export type PromptBlock = UnlinkedPromptBlock | LinkedPromptBlock;

export type ContentBlock = TextBlock | FormulaBlock | ImageBlock | TableBlock | PromptBlock;
