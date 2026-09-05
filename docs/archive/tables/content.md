# Content

No tables. This is `$content/types/` — the one content primitive every body,
message, and comment is made of.

`ContentBlock` is embedded in a document row, a slide element, a message, and a
comment. The owner enforces its own set, which is what keeps this union single
rather than one per surface.

---

## `BlockFormat`

`app/src/lib/capabilities/content/types/format.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * A block's own box: how it sits, what it sits on, and how a typed value inside
 * it renders.
 *
 * It is on the block rather than on whatever holds it because it describes
 * *that* block — a container would otherwise have to know how many blocks it
 * holds and which one is being styled.
 *
 * Both axes are here. Horizontal alignment is what prose needs; vertical means
 * something only when a block sits in a box taller than itself, which is the
 * spreadsheet cell and the slide element — the cases that made blocks worth
 * sharing in the first place.
 *
 * `valueFormat` is on the format so the same date renders two ways in two places
 * without being stored twice.
 */
export const blockFormatValidator = v.object({
  align: v.optional(
    v.union(v.literal("start"), v.literal("center"), v.literal("end"), v.literal("justify"))
  ),
  verticalAlign: v.optional(
    v.union(v.literal("top"), v.literal("middle"), v.literal("bottom"))
  ),
  background: v.optional(v.string()),
  border: v.optional(
    v.object({
      color: v.string(),
      width: v.number(),
      style: v.union(v.literal("solid"), v.literal("dashed"), v.literal("dotted"))
    })
  ),
  padding: v.optional(v.object({ x: v.optional(v.number()), y: v.optional(v.number()) })),
  valueFormat: v.optional(v.string())
});

export type BlockFormat = Infer<typeof blockFormatValidator>;
```

---

## `FormulaValue`

`app/src/lib/capabilities/content/types/value.ts`

What a computation produced — the type a spreadsheet cell's `value` holds and a
formula block resolves to.

```ts
import { v, type Infer } from "convex/values";

/**
 * A date is a record because the parts are separately meaningful — a formula can
 * ask for the month, and a date with no time is not the same value as one at
 * midnight. `calendar` is present and single-valued so that a stored date never
 * means whatever the code assumed when it was written.
 *
 * `utc` is derived from the components and kept anyway: sorting and comparing
 * then go through a plain number. The components are the truth, and `utc` is
 * rewritten whenever one changes — never edited on its own.
 */
export const dateValueValidator = v.object({
  calendar: v.literal("gregorian"),
  year: v.number(),
  month: v.number(),
  day: v.number(),
  hour: v.optional(v.number()),
  minute: v.optional(v.number()),
  second: v.optional(v.number()),
  millisecond: v.optional(v.number()),
  timeZone: v.optional(v.string()),
  utc: v.number()
});

export type DateValue = Infer<typeof dateValueValidator>;

/**
 * A returned table's columns are typed independently; the block's single
 * `format.valueFormat` cannot say that.
 */
export const formulaColumnValidator = v.object({
  name: v.optional(v.string()),
  valueFormat: v.optional(v.string())
});

export type FormulaColumn = Infer<typeof formulaColumnValidator>;

/**
 * **`empty` is not a zero, an empty string, or a `false`.** A reference to a
 * blank cell is none of those, and collapsing it into one is how a sum counts a
 * gap as a value.
 *
 * There is no `error` kind either: a failure is a property of the computation,
 * so it lives in the block's `state`.
 */
const scalarValueValidator = v.union(
  v.object({ kind: v.literal("empty") }),
  v.object({ kind: v.literal("number"), value: v.number() }),
  v.object({ kind: v.literal("text"), value: v.string() }),
  v.object({ kind: v.literal("boolean"), value: v.boolean() }),
  v.object({ kind: v.literal("date"), value: dateValueValidator })
);

/**
 * **A cell is `v.any()` because the recursion is real and a validator is a
 * value, not a type.** A grouped aggregate returns a table whose cells are
 * tables, and there is no recursive validator to write for that.
 *
 * `v.any()` only at the cell, rather than encoding the whole value as JSON the
 * way settings are, because the stored bytes then stay the honest shape:
 * everything outside a cell is still checked at the door, a resolver reading a
 * body can still branch on `kind`, and the day a recursive validator exists this
 * tightens with nothing to migrate. The cost is that a malformed nested cell is
 * stored, so a renderer of one is defensive.
 */
export const formulaValueValidator = v.union(
  ...scalarValueValidator.members,
  v.object({
    kind: v.literal("table"),
    columns: v.array(formulaColumnValidator),
    rows: v.array(v.array(v.any()))
  })
);

/** The recursion the validator cannot state. Only the `table` member is written twice. */
export type FormulaValue =
  | Infer<typeof scalarValueValidator>
  | { kind: "table"; columns: FormulaColumn[]; rows: FormulaValue[][] };
```

---

## `ContentBlock`

`app/src/lib/capabilities/content/types/block.ts`

### Inside a text block

```ts
import { v, type Infer } from "convex/values";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";
import { resourceSelectionValidator } from "$shared/types/resource-selection";

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
 *
 * **A mention is a `link` mark**, which is why there is no mention type beside
 * this one.
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
```

### The six variants

```ts
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
  listStyle: v.optional(
    v.union(v.literal("bullet"), v.literal("ordered"), v.literal("todo"))
  ),
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

/**
 * A picture in the content.
 *
 * **Three ways to name one, and exactly one applies.** A file row, when the
 * picture is project material. A storage id, when it is not and has no row to
 * live in. A URL, when the bytes are somewhere else and stay there.
 *
 * The first two resolve to one stored blob, and that blob is the only version
 * of the picture there is — an [external file](external-files.md) holds one
 * object, reduced on the way in, so there is no display-sized copy beside it to
 * reference from here.
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

const tableRowValidator = v.object({
  id: v.string(),
  cells: v.array(tableCellValidator)
});

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
 * A text block with a [derived output](knowledge.md#derivedoutputs) behind it.
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
 * exist before anything has run: one written into a
 * [template](templates.md) has been stripped of everything project-bound, and
 * one just instantiated has generated nothing yet. That makes these states the
 * derived output's five exactly.
 *
 * **`scope` is optional** for the same reason — in a template it is absent, and
 * a variable fills it at instantiation.
 */
const promptBlockValidator = v.object({
  id: v.string(),
  type: v.literal("prompt"),
  derivedOutputId: v.optional(v.id("derivedOutputs")),
  atoms: v.array(textAtomValidator),
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
```

### The union

```ts
/**
 * The one content primitive: anything a person authors or an agent produces is a
 * list of these, embedded in whatever owns them.
 *
 * Discriminated on `type` and looked up by that literal, which is how `prompt`
 * joined without touching a variant already here.
 *
 * **There is no embed variant.** A URL is a `link` mark on a span of text — a
 * block-level version of the same thing would be a second way to say it, and the
 * card, the title, and the cached preview image behind it are all decoration
 * fetched from somewhere we do not control.
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
export type TableBlock = Omit<Infer<typeof tableBlockValidator>, "rows"> & {
  rows: TableRow[];
};

export type ContentBlock =
  | TextBlock
  | FormulaBlock
  | ImageBlock
  | TableBlock
  | PromptBlock;
```

---

## Where a block is embedded

| | holds | accepts |
| --- | --- | --- |
| [document row](resources.md#documentbody) | `blocks: ContentBlock[]` | every variant |
| [slide element](resources.md#slidedeckbody) | `blocks: ContentBlock[]` | every variant |
| [message](threads.md#message) | `blocks: ContentBlock[]` | every variant |
| [comment](collaboration.md#comments) | `blocks: ContentBlock[]` | text and image |
| [derived output](knowledge.md#derivedoutputs) | `response: ContentBlock` | one |

The owner enforces its own set. Nothing in this file does.

**A [spreadsheet cell](spreadsheets.md#sheetcells) is not on that list.** A cell
is one value rather than prose with formula spans in it, so it holds no block —
it takes `Mark` and `BlockFormat` directly and has neither atoms nor a display
string.

---

## Files

```text
app/src/lib/capabilities/content/
├── overview.md
└── types/
    ├── types.md
    ├── format.ts                   BlockFormat
    ├── value.ts                    DateValue, FormulaColumn, FormulaValue
    └── block.ts                    TextAtom, Mark, ContentBlock
```

`content` declares no tables, so it has no `schema.ts` and appears in no schema
fragment.

**Imports it does not define:** `$shared/types/resource-selection`, and
`externalFiles` and `derivedOutputs` as tables.

## Related

[all tables](README.md) · [shared types](shared.md) · [resources](resources.md)
