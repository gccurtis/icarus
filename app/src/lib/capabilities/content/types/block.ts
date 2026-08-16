import { v, type Infer } from "convex/values";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";

/** Where a computation stands. A block still reads while one is stale, which is why `resolved` is stored beside it. */
const resolutionStateValidator = v.union(
  v.literal("fresh"),
  v.literal("stale"),
  v.literal("computing"),
  v.literal("error")
);

/**
 * The smallest authored unit. Literals are typed characters; formula atoms are
 * the `{{ }}` spans inside prose.
 *
 * A formula atom carries its own `resolved` and `state` so `display` can be
 * rebuilt without re-evaluating anything.
 */
export const textAtomValidator = v.union(
  v.object({ id: v.string(), kind: v.literal("literal"), text: v.string() }),
  v.object({
    id: v.string(),
    kind: v.literal("formula"),
    expression: v.string(),
    resolved: v.string(),
    state: resolutionStateValidator,
    error: v.optional(v.string())
  })
);

export type TextAtom = Infer<typeof textAtomValidator>;

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
  link: v.optional(v.string()),
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
 * `resolved`, concatenated — and the marks index it. Nothing here enforces that;
 * applying ops does.
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
  atoms: v.array(textAtomValidator),
  display: v.string(),
  marks: v.array(markValidator),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * A block whose entire content is a computation.
 *
 * Kept apart from a formula atom on purpose: this has a typed `value` other
 * formulas depend on and it either computes or errors, where an atom produces a
 * string span and the sentence around it still renders when it fails.
 */
const formulaBlockValidator = v.object({
  id: v.string(),
  type: v.literal("formula"),
  expression: v.string(),
  display: v.string(),
  value: formulaValueValidator,
  state: resolutionStateValidator,
  error: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/** What we serve after fetch, transcode, and resize — never what was given. */
const renderedAssetValidator = v.object({
  fileId: v.id("externalFiles"),
  width: v.number(),
  height: v.number()
});

/**
 * A picture in the content.
 *
 * Raw and display separate here too: `source` is the upload or the pasted URL,
 * `display` is the normalized asset, and `display` absent is how the UI knows to
 * show a placeholder rather than a broken image.
 *
 * **`alt` is required.** An image without it is a hole in every non-visual
 * consumer — search, the knowledge lattice, screen readers, and any agent
 * reading the document.
 */
const imageBlockValidator = v.object({
  id: v.string(),
  type: v.literal("image"),
  source: v.union(
    v.object({ kind: v.literal("file"), fileId: v.id("externalFiles") }),
    v.object({ kind: v.literal("url"), url: v.string() })
  ),
  display: v.optional(renderedAssetValidator),
  alt: v.string(),
  caption: v.optional(textBlockValidator),
  crop: v.optional(
    v.object({ x: v.number(), y: v.number(), width: v.number(), height: v.number() })
  ),
  format: v.optional(blockFormatValidator)
});

/**
 * **A cell's `blocks` are `v.any()` for the reason `FormulaValue`'s cells are**
 * — see `types.md`. `ContentBlock` is recursive here and a validator is a value,
 * not a type, so there is nothing recursive to write; the same answer is reused
 * rather than a second one invented.
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
 * An external thing rendered in place — a link card, a video, an embedded app.
 * `url` is raw; `title`, `description`, and `thumbnail` are the display, fetched
 * from the target and cached, and `fetchedAt` says how old that is.
 *
 * **A plain hyperlink inside a sentence is a `link` mark, not one of these.**
 * Embeds are block-level.
 */
const embedBlockValidator = v.object({
  id: v.string(),
  type: v.literal("embed"),
  url: v.string(),
  presentation: v.union(v.literal("card"), v.literal("inline"), v.literal("iframe")),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  thumbnail: v.optional(renderedAssetValidator),
  fetchedAt: v.optional(v.number()),
  format: v.optional(blockFormatValidator)
});

/**
 * The one content primitive: anything a person authors or an agent produces is a
 * list of these, embedded in whatever owns them.
 *
 * Discriminated on `type` and looked up by that literal, so `prompt` joins the
 * union without touching a variant already here. No owner accepts every variant
 * — a spreadsheet cell takes text and formula, a comment takes text and image —
 * and the owner enforces its own set, which is what keeps this union single
 * rather than one per surface.
 */
export const blockValidator = v.union(
  textBlockValidator,
  formulaBlockValidator,
  imageBlockValidator,
  tableBlockValidator,
  embedBlockValidator
);

export type TextBlock = Infer<typeof textBlockValidator>;
/** `value` is stated here rather than inferred, because the validator's cells are `v.any()`. */
export type FormulaBlock = Omit<Infer<typeof formulaBlockValidator>, "value"> & {
  value: FormulaValue;
};
export type ImageBlock = Infer<typeof imageBlockValidator>;
export type EmbedBlock = Infer<typeof embedBlockValidator>;
/** The recursion the validator cannot state, for the same reason `FormulaValue` states its own. */
export type TableCell = Omit<Infer<typeof tableCellValidator>, "blocks"> & {
  blocks: ContentBlock[];
};
export type TableRow = { id: string; cells: TableCell[] };
export type TableBlock = Omit<Infer<typeof tableBlockValidator>, "rows"> & { rows: TableRow[] };
export type ContentBlock = TextBlock | FormulaBlock | ImageBlock | TableBlock | EmbedBlock;
