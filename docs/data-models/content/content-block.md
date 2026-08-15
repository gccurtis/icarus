# Content block

The one content primitive. Anything Icarus displays that a person can author or
an agent can produce is a list of content blocks — a document body, a slide
element, a spreadsheet cell, a comment, a research message, an agent task
message, a generated output.

Blocks are embedded values. They have no ids and no owner field; the object
holding them is the owner.

```ts
type ContentBlock =
  | TextBlock
  | ImageBlock
  | TableBlock
  | EmbedBlock
  | FormulaBlock
  | PromptBlock;

interface BlockFormat {
  align?: "start" | "center" | "end" | "justify";     // horizontal
  verticalAlign?: "top" | "middle" | "bottom";
  background?: string;
  border?: { color: string; width: number; style: "solid" | "dashed" | "dotted" };
  padding?: { x?: number; y?: number };
  valueFormat?: string;                                // number and date patterns
}
```

Every variant carries an optional `format`. Alignment, fill, and borders belong
to the block because they describe *that block's* box — putting them on the
container would mean the container has to know how many blocks it holds and
which one is being styled.

Both axes are present for alignment and padding. Horizontal alignment is what
prose needs and is most of the use; vertical alignment only means anything when a
block sits in a box taller than itself, which is exactly the spreadsheet cell and
slide element case — and those are the cases that made blocks worth sharing.

`valueFormat` is a pattern applied to typed values: a number's decimals and
separators, a [date's](#dates) rendering. It is on the format rather than the
value so that the same date renders differently in two places without being
stored twice.

No object is obliged to accept every variant. A spreadsheet cell permits text
and formula blocks; a comment permits text and image. The owner decides its own
set, and enforces it, so the union stays single rather than fragmenting into a
variant per surface.

## Raw and display

Every block stores two things: what was **authored**, and what is **shown**.
They differ whenever the block contains something that resolves.

| Block | Raw | Display |
| --- | --- | --- |
| text | atoms, some of them formulas | the resolved string |
| formula | `=SUM(A1:A10)` | `42` |
| image | an upload or a URL | the standardized rendered asset |
| prompt | a link to a derived output | the generated blocks |

For a block with nothing to resolve the two are trivially related — display is
just the atoms concatenated — and it is still stored, because search, previews,
and lattice embedding all want the flat display string and none of them should
have to re-run a resolver to get it.

## Text blocks

```ts
interface TextBlock {
  type: "text";
  variant: "paragraph" | "heading" | "list" | "quote" | "code";
  level?: number;              // heading depth, or list indent depth
  listStyle?: "bullet" | "ordered" | "todo";
  checked?: boolean;           // todo list items
  language?: string;           // code

  atoms: TextAtom[];           // raw — what was authored
  display: string;             // resolved — what is shown
  marks: Mark[];               // offsets into `display`
  resolvedAt?: number;
  format?: BlockFormat;
}
```

The text variants are one type rather than five, because they share the whole
atoms/display/marks machine and differ only in how they are presented. A
paragraph becoming a heading is a `variant` change, not a rewrite.

Code blocks are the exception that stays inside the type: they carry a
`language`, take no marks, and their atoms are a single literal. They are here
rather than outside because a code block still sits in the same block list, in
the same order, as the paragraphs around it.

### Atoms

```ts
type TextAtom =
  | { kind: "literal"; text: string }
  | { kind: "formula"; expression: string };
```

An atom is the smallest authored unit. Literal atoms are typed characters.
Formula atoms are written inline with `{{ }}` delimiters — `Revenue was
{{SUM(Sales!B:B)}} this quarter` is three atoms: a literal, a formula, a
literal.

Formula atoms are inline references *within* prose. A block that is entirely a
formula is a [formula block](#formula-blocks) instead — see the note there on
why the two are not the same thing.

### Marks index the display string

```ts
interface Mark {
  from: number;               // UTF-16 offset into `display`
  to: number;                 // exclusive
  style?: ("bold" | "italic" | "underline" | "strikethrough" | "code")[];
  link?: string;
  color?: string;
}
```

**This is the load-bearing decision in the whole model.** Marks are offsets into
`display`, not into `atoms`.

When someone selects text and bolds it, they are selecting what they see. If
`{{SUM(Sales!B:B)}}` displays as `$4.2M` and they bold it, they bolded `$4.2M` —
five characters of display — not the nineteen characters of expression behind
it. Marks anchored to the raw atoms would have no way to express "bold the
result", because the result is not in the raw at all.

The consequence is that a mark's offsets are only meaningful against a
particular resolution. When a formula's value changes, display shifts and marks
covering or following it must shift with it. That is real work, and it is the
work the model should make obvious rather than hide: the formula atom knows the
display range it produced, so a re-resolve is a splice, and the marks either
side move by the length delta.

A block with no formula atoms never encounters any of this — display is
byte-for-byte the concatenated literals and marks are stable.

## Formula blocks

```ts
interface FormulaBlock {
  type: "formula";
  expression: string;          // raw, "=SUM(A1:A10)"
  display: string;             // resolved, "42"
  value: FormulaValue;
  state: "fresh" | "stale" | "computing" | "error";
  error?: string;
  resolvedAt?: number;
  format?: BlockFormat;
}

type FormulaValue =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; value: DateValue }
  | { kind: "table"; columns: FormulaColumn[]; rows: FormulaValue[][] };

interface FormulaColumn {
  name?: string;
  valueFormat?: string;
}
```

### Formulas return objects, not scalars

`FormulaValue` is a union rather than a scalar because a formula can return a
table, and a cell of that table can itself be a table. The recursion is real and
the type has to admit it — a filter over a range returns rows, a grouped
aggregate returns a table whose cells are groups.

`empty` is distinct from a zero, an empty string, and an error. A reference to a
blank cell is none of those, and collapsing it into one of them is how a sum
quietly counts a gap as a value.

Errors are not a `FormulaValue` kind. A formula that failed has
`state: "error"` and a message — an error is a property of the computation, not
a value it produced, and making it a value means every consumer of a value has to
re-check whether it is really one.

`columns` carries a per-column `valueFormat` because a returned table's columns
are typed independently — a date column and a currency column render differently
inside one result, and the block's single `format.valueFormat` cannot say that.

### Dates

```ts
interface DateValue {
  calendar: "gregorian";
  year: number;
  month: number;               // 1–12
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  timeZone?: string;
  utc: number;                 // epoch ms, derived from the components
}
```

A date is a record, not a number, because the parts are separately meaningful:
a formula can ask for the month, a display can show only the year, and a value
that is a date with no time is genuinely different from one at midnight.

`calendar` is present and currently only `"gregorian"`. It is there because a
date without a calendar is an assumption, and adding the field later would mean
every stored date silently meaning whatever the code assumed at the time.

**`utc` is carried alongside the components on purpose.** It is derived —
computable from the fields — but keeping it means rendering, sorting, and
comparing go through a plain number and the standard conversions, rather than
reconstructing an instant from parts on every render. The components are the
truth; `utc` is the fast path.

That redundancy has one rule: `utc` is rewritten whenever any component changes,
never edited independently. Storing a derived value is only safe while exactly
one direction is authoritative.

There is no date block. A date is a value that appears inside a formula block or
a formula atom, and its rendering is the containing block's
`format.valueFormat` — which is why that field is on the format and not on the
value.

A formula block is a block *whose entire content* is a computation, written
starting with `=`. A spreadsheet cell holding `=SUM(A1:A10)` is a formula
block. A paragraph mentioning a total inline is a text block with a formula
atom.

These are kept apart on purpose. They look similar and they are not the same
thing: a formula block has a typed `value` that other formulas can depend on,
and it either computes or it errors. A formula atom has no independent value —
it produces a string span inside prose, and if it fails the surrounding sentence
still renders. Collapsing them would mean either giving prose spans a cell's
dependency semantics or giving cells a span's tolerance for failure, and neither
is right.

## Image blocks

```ts
interface ImageBlock {
  type: "image";
  source:
    | { kind: "file"; fileId: Id<"externalFiles"> }
    | { kind: "url"; url: string };
  display?: {
    fileId: Id<"externalFiles">;   // the normalized, servable asset
    width: number;
    height: number;
  };
  alt: string;
  caption?: TextBlock;
  crop?: { x: number; y: number; width: number; height: number };
  format?: BlockFormat;
}
```

Raw and display separate here too: `source` is what was given — an upload, a
pasted URL — and `display` is what we render, after fetch, transcode, and
resize. `display` is absent until that has happened, which is also how the UI
knows to show a placeholder.

`alt` is required. An image with no alt text is a hole in every non-visual
consumer of the content: search, the knowledge lattice, screen readers, and any
agent reading the document.

## Table blocks

```ts
interface TableBlock {
  type: "table";
  rows: TableRow[];
  headerRows: number;
  columnWidths?: number[];
  format?: BlockFormat;
}

interface TableRow {
  cells: TableCell[];
}

interface TableCell {
  blocks: ContentBlock[];
  rowSpan?: number;
  columnSpan?: number;
  format?: BlockFormat;
}
```

A table is a collection of blocks, so a cell holds `ContentBlock[]` rather than
text — a cell with a paragraph and an image under it is a normal thing to want,
and special-casing it would mean inventing a second, weaker content type just
for cells.

That makes the type recursive. In practice a cell holds one text block, and the
recursion is bounded by the owner: a table nested in a table cell is not
permitted by any surface that accepts tables. Real tabular work — many rows,
formulas across them, sorting — belongs in a
[spreadsheet](../general-resources/spreadsheet.md), and a table block is for
presenting a handful of rows inside prose.

Styling is per cell, via each cell's own `format`. A table-wide style is applied
by writing it onto the cells, not by a separate table stylesheet, so there is
one place a renderer has to look.

## Embed blocks

```ts
interface EmbedBlock {
  type: "embed";
  url: string;
  presentation: "card" | "inline" | "iframe";
  title?: string;
  description?: string;
  thumbnail?: { fileId: Id<"externalFiles">; width: number; height: number };
  fetchedAt?: number;
  format?: BlockFormat;
}
```

An external thing rendered in place — a link card, a video, an embedded app.
The `url` is raw; `title`, `description`, and `thumbnail` are the display,
fetched from the target and cached. `fetchedAt` says how old that is.

A plain hyperlink inside a sentence is a `link` mark, not an embed block. Embeds
are block-level.

## Prompt blocks

```ts
interface PromptBlock {
  type: "prompt";
  derivedOutputId: Id<"derivedOutputs">;

  atoms: TextAtom[];           // the user's text — same as a text block
  display: string;
  marks: Mark[];

  scope?: SetExpression;       // what retrieval may draw on
  state: "fresh" | "stale" | "generating" | "error";
  error?: string;
  refreshedAt?: number;
  format?: BlockFormat;
}
```

**A prompt block is a text block with a derived output behind it.** It carries
the same `atoms`, `display`, and `marks` as any [text block](#text-blocks), and
they behave identically: the text is the user's, editable in place, marked up
normally.

What it adds is a [derived output](../knowledge/derived-output.md) that can
refresh that text. Editing changes what is displayed immediately and nothing
else; on the next refresh the edited text goes to the generator as the shape to
preserve, so a refresh updates the facts without discarding phrasing someone
chose.

A derived output produces exactly **one** block, which is why this is a single
text body rather than a list. There is no case where a prompt expands into a
document section — that would be a document, generated as a document.

The prompt itself is not stored here. It lives on the derived output, and
duplicating it would create two prompts that can disagree about what produced the
text.

`scope` is a [resource set](../special-resources/resource-set.md) expression
limiting what retrieval may draw on when refreshing — "summarize the findings,
but only from the connector-synced files". Absent means the whole project. It is
stored on the block rather than only on the derived output because it is part of
what the author specified, and it has to survive being read back into the editor.
