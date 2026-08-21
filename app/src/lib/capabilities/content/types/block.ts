import { v, type Infer } from "convex/values";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";
import { actorValidator } from "$shared/types/actor";
import { resourceRefValidator } from "$shared/types/resource";
import { resourceSelectionValidator } from "$shared/types/resource-selection";

/** Where a computation stands. A block still reads while one is stale, which is why its last result is stored beside it. */
const resolutionStateValidator = v.union(
  v.literal("fresh"),
  v.literal("stale"),
  v.literal("computing"),
  v.literal("error")
);

/** Typed characters. The smallest authored unit. */
const textAtomValidator = v.object({
  id: v.string(),
  kind: v.literal("literal"),
  text: v.string()
});

/**
 * A `{{ }}` span inside prose.
 *
 * **It holds the expression and the row.** `expression` is what the author wrote
 * and is the portable form — a template body carries it into a project where no
 * formula row exists. `formulaId` is the row that evaluates it, and is optional
 * for exactly that case.
 *
 * **Both halves of the last result are stored.** `lastResolvedValue` is what
 * other computations read; `lastResolvedDisplay` is the span the block's
 * `display` concatenates and the marks index. Keeping the string is what lets
 * `display` be rebuilt without re-evaluating anything.
 */
const formulaAtomValidator = v.object({
  id: v.string(),
  kind: v.literal("formula"),
  expression: v.string(),
  formulaId: v.optional(v.id("formulas")),
  lastResolvedValue: formulaValueValidator,
  lastResolvedDisplay: v.string(),
  state: resolutionStateValidator,
  error: v.optional(v.string())
});

export const atomValidator = v.union(textAtomValidator, formulaAtomValidator);

export type TextAtom = Infer<typeof textAtomValidator>;
/** `lastResolvedValue` is stated rather than inferred, because a table's cells are `v.any()`. */
export type FormulaAtom = Omit<Infer<typeof formulaAtomValidator>, "lastResolvedValue"> & {
  lastResolvedValue: FormulaValue;
};
export type Atom = TextAtom | FormulaAtom;

/**
 * Where a marked span points. The span is the text, so nothing here carries a
 * copy of it — `from`/`to` already say what was written.
 *
 * Two arms address someone and two address something, because all four are the
 * same act: this run of text points elsewhere. One field rather than several, so
 * a span can only point at one thing and a renderer branches once.
 *
 * **A persona is its own arm rather than an `Actor` variant.** An actor's
 * `agent` points at a *task* — the run that acted. A persona is the durable
 * identity, and mentioning one is a different thing from naming a run of work.
 */
const markLinkValidator = v.union(
  v.object({ kind: v.literal("url"), url: v.string() }),
  v.object({ kind: v.literal("actor"), actor: actorValidator }),
  v.object({ kind: v.literal("persona"), personaId: v.id("personas") }),
  v.object({ kind: v.literal("resource"), ref: resourceRefValidator })
);

export type MarkLink = Infer<typeof markLinkValidator>;

/**
 * A styled range. `from`/`to` are UTF-16 offsets into `display`, never into
 * `atoms`: someone bolding `$4.2M` bolded five characters of what they saw, not
 * the nineteen characters of the expression behind them.
 *
 * The id is what makes two people bolding different words in one paragraph
 * merge — a change addresses one mark rather than replacing the array.
 */
export const markValidator = v.object({
  id: v.string(),
  from: v.number(),
  to: v.number(),
  style: v.optional(
    v.array(
      v.union(
        v.literal("bold"),
        v.literal("italic"),
        v.literal("underline"),
        v.literal("strikethrough"),
        v.literal("code")
      )
    )
  ),
  link: v.optional(markLinkValidator),
  color: v.optional(v.string())
});

export type Mark = Infer<typeof markValidator>;

/**
 * Prose, and the five presentations of it. One type rather than five because
 * they share the whole atoms/display/marks machine — a paragraph becoming a
 * heading is a `variant` change, not a rewrite.
 *
 * `style` names an entry in the containing resource's style set rather than
 * copying its formatting, so restyling "Heading 1" restyles every heading.
 * `format` overrides it locally.
 *
 * `display` is the atoms' text in order — each literal's `text`, each formula's
 * `lastResolvedDisplay`, concatenated — and the marks index it. Nothing here
 * enforces that; applying ops does.
 *
 * **A block holds no newlines.** Enter ends a block and starts another, which is
 * what keeps one block one styleable, measurable, placeable thing and makes mark
 * offsets tractable: one display string, one coordinate space.
 */
const textBlockValidator = v.object({
  id: v.string(),
  type: v.literal("text"),
  variant: v.union(
    v.literal("paragraph"),
    v.literal("heading"),
    v.literal("list"),
    v.literal("quote"),
    v.literal("code")
  ),
  level: v.optional(v.number()),
  listStyle: v.optional(v.union(v.literal("bullet"), v.literal("ordered"), v.literal("todo"))),
  checked: v.optional(v.boolean()),
  language: v.optional(v.string()),
  style: v.optional(v.string()),
  atoms: v.array(atomValidator),
  display: v.string(),
  marks: v.array(markValidator),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * A block whose entire content is a computation.
 *
 * Kept apart from a formula atom on purpose: this either computes or errors,
 * where an atom produces a string span and the sentence around it still renders
 * when it fails.
 *
 * `expression` and `formulaId` are the pair a formula atom carries, for the same
 * reasons. `display` here is the whole block's rendering rather than one span
 * among several, which is why it needs no other name.
 */
const formulaBlockValidator = v.object({
  id: v.string(),
  type: v.literal("formula"),
  expression: v.string(),
  formulaId: v.optional(v.id("formulas")),
  display: v.string(),
  value: formulaValueValidator,
  state: resolutionStateValidator,
  error: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * A picture in the content.
 *
 * **Three ways to name one, and exactly one applies.** A file row, when the
 * picture is project material. A storage id, when it is not and has no row to
 * live in. A URL, when the bytes are somewhere else and stay there.
 *
 * The first two resolve to one stored blob, and that blob is the only version of
 * the picture there is — an external file holds one object, reduced on the way
 * in, so there is no display-sized copy beside it to reference from here.
 *
 * **`alt` is required.** An image without it is a hole in every non-visual
 * consumer — search, the knowledge lattice, screen readers, and any agent
 * reading the document.
 *
 * **`source` is optional.** Absent is a picture's place without a picture in it:
 * the alt text, the caption, the crop, and the frame all stand on their own.
 */
const imageBlockValidator = v.object({
  id: v.string(),
  type: v.literal("image"),
  source: v.optional(
    v.union(
      v.object({ kind: v.literal("file"), fileId: v.id("externalFiles") }),
      v.object({ kind: v.literal("storage"), storageId: v.id("_storage") }),
      v.object({ kind: v.literal("url"), url: v.string() })
    )
  ),
  alt: v.string(),
  caption: v.optional(textBlockValidator),
  crop: v.optional(
    v.object({ x: v.number(), y: v.number(), width: v.number(), height: v.number() })
  ),
  format: v.optional(blockFormatValidator)
});

/**
 * **A cell's `blocks` are `v.any()` for the reason `FormulaValue`'s cells are.**
 * `ContentBlock` is recursive here and a validator is a value, not a type, so
 * there is nothing recursive to write; the same answer is reused rather than a
 * second one invented.
 *
 * The recursion is bounded by the owner instead: no surface that accepts a table
 * accepts one nested in a cell.
 *
 * Styling is per cell, so a renderer has one place to look — a table-wide style
 * is applied by writing it onto the cells.
 */
const tableCellValidator = v.object({
  id: v.string(),
  blocks: v.array(v.any()),
  rowSpan: v.optional(v.number()),
  columnSpan: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

const tableRowValidator = v.object({ id: v.string(), cells: v.array(tableCellValidator) });

/**
 * A handful of rows presented inside prose. Many rows, formulas across them, and
 * sorting are a spreadsheet's job, which is why nothing here grows toward one.
 *
 * `headerRows` counts rather than flags, because the first two rows are both
 * headers often enough that a boolean per row would be the same fact spread out.
 */
const tableBlockValidator = v.object({
  id: v.string(),
  type: v.literal("table"),
  rows: v.array(tableRowValidator),
  headerRows: v.number(),
  columnWidths: v.optional(v.array(v.number())),
  format: v.optional(blockFormatValidator)
});

/**
 * A text block with a derived output behind it.
 *
 * It carries the same `atoms`, `display`, and `marks` as a text block and they
 * behave identically: the text is the user's, editable in place, marked up
 * normally. What it adds is an output that can refresh that text — and editing
 * changes what is displayed and nothing else, because on the next refresh the
 * edited text goes to the generator as the shape to preserve.
 *
 * **The prompt is not here.** It lives on the derived output; a copy would be a
 * second prompt that can disagree about what produced the text. `scope` *is*
 * here, because it is part of what the author specified and has to survive being
 * read back into the editor.
 *
 * **One text body rather than a list**, because a derived output produces
 * exactly one block. A prompt expanding into a document section would be a
 * document, generated as one.
 *
 * **`derivedOutputId` is optional and `idle` is a state**, because a block can
 * exist before anything has run: one written into a template has been stripped
 * of everything project-bound, and one just instantiated has generated nothing
 * yet. That makes these states the derived output's five exactly.
 *
 * **`scope` is optional** for the same reason — in a template it is absent, and
 * a variable fills it at instantiation.
 */
const promptBlockValidator = v.object({
  id: v.string(),
  type: v.literal("prompt"),
  derivedOutputId: v.optional(v.id("derivedOutputs")),
  atoms: v.array(atomValidator),
  display: v.string(),
  marks: v.array(markValidator),
  scope: v.optional(resourceSelectionValidator),
  state: v.union(
    v.literal("idle"),
    v.literal("fresh"),
    v.literal("stale"),
    v.literal("generating"),
    v.literal("error")
  ),
  error: v.optional(v.string()),
  refreshedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * The one content primitive: anything a person authors or an agent produces is a
 * list of these, embedded in whatever owns them.
 *
 * Discriminated on `type` and looked up by that literal, which is how `prompt`
 * joined without touching a variant already here. No owner accepts every
 * variant, and the owner enforces its own set — which is what keeps this union
 * single rather than one per surface.
 *
 * **There is no embed variant.** A URL is a `link` mark on a span of text — a
 * block-level version of the same thing would be a second way to say it, and the
 * card, the title, and the cached preview image behind it are all decoration
 * fetched from somewhere we do not control.
 *
 * **A divider and a page break are not blocks.** They hold no content, take no
 * marks, and cannot be searched — they are row kinds instead. Content and
 * structure split there.
 */
export const blockValidator = v.union(
  textBlockValidator,
  formulaBlockValidator,
  imageBlockValidator,
  tableBlockValidator,
  promptBlockValidator
);

export type TextBlock = Infer<typeof textBlockValidator>;
/** `value` is stated here rather than inferred, because the validator's cells are `v.any()`. */
export type FormulaBlock = Omit<Infer<typeof formulaBlockValidator>, "value"> & {
  value: FormulaValue;
};
export type ImageBlock = Infer<typeof imageBlockValidator>;
export type PromptBlock = Infer<typeof promptBlockValidator>;
/** The recursion the validator cannot state, for the same reason `FormulaValue` states its own. */
export type TableCell = Omit<Infer<typeof tableCellValidator>, "blocks"> & {
  blocks: ContentBlock[];
};
export type TableRow = { id: string; cells: TableCell[] };
export type TableBlock = Omit<Infer<typeof tableBlockValidator>, "rows"> & { rows: TableRow[] };

export type ContentBlock = TextBlock | FormulaBlock | ImageBlock | TableBlock | PromptBlock;
