# Spreadsheets

Two tables and a body.

`spreadsheets` · `sheetCells`

**A spreadsheet is the one general resource whose content is not in its body.**
Cells are rows, because a grid has no ceiling and a body does — and because the
read a person waits for is a viewport of a few hundred cells rather than the
whole sheet, which an index can serve and a document cannot.

What stays in the body is the shape of the grid: which rows and columns exist, in
what order, how wide, and what is formatted where.

---

## `spreadsheets`

`app/src/lib/capabilities/spreadsheets/schema/spreadsheets.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A spreadsheet's metadata, and deliberately nothing else.
 *
 * What is here is what a list, a tab, and a search result render from — readable
 * without touching a cell.
 *
 * `templateId` is provenance only: a resource is a full copy at creation, so
 * changing the template later changes nothing here.
 */
export const spreadsheets = defineTable({
  projectId: v.id("projects"),
  title: v.string(),
  templateId: v.optional(v.id("templates")),
  createdBy: actorValidator,
  updatedBy: actorValidator,
  updatedAt: v.number()
}).index("by_project", ["projectId"]);
```

---

## `sheetCells`

`app/src/lib/capabilities/spreadsheets/schema/sheet-cells.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { cellKindValidator } from "$spreadsheets/types/cell";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator } from "$content/types/value";
import { markValidator } from "$content/types/block";

/**
 * One populated cell. An empty cell is the absence of a row.
 *
 * **`rowId` and `columnId` name entries in the body, not rows in a table**, so
 * they are strings rather than `v.id(...)`. Both are local to one spreadsheet
 * and short on purpose: a hundred million cells carry them, and a Convex id
 * would be four times the size for identity that never leaves this resource.
 *
 * **`rowOrder` is the row's sort key, copied here.** It is the only reason a
 * viewport is a range read: an index can order cells by something stored on the
 * cell, and a row's *position in the body's array* is not that. The key is
 * sparse, so inserting a row invents a value between its neighbours and touches
 * no cell at all. Only moving a row rewrites this, on that row's cells alone.
 *
 * **The index is column-major.** `[columnId, rowOrder]` makes a viewport one
 * range per visible column. The mirror — `[rowId, columnOrder]` — would make
 * moving a column rewrite every cell in it, which is the height of the sheet
 * rather than its width.
 *
 * **`text` is absent when the value says it.** A number cell's typed form is
 * recoverable from `value` and the format that renders it, so `text` earns its
 * place only for a text cell, which has no `value`, and a formula cell, where it
 * is the expression.
 *
 * **No `ContentBlock`.** A cell is one value, not prose with formula spans in
 * it, so there are no atoms and no display string. The three parts of a block
 * that a cell actually needs are here: `marks` for styling inside one cell's
 * text, `format` for a one-off override, and a style key that regions supply
 * from the body.
 *
 * **`mergedTo` and `spillTo` are far corners, never `"B2:D4"`.** What lies
 * between two corners is whatever currently lies between them, so inserting a
 * row inside a merge extends it without anything being rewritten. The same rule
 * a formula range follows.
 */
export const sheetCells = defineTable({
  projectId: v.id("projects"),
  resourceId: v.id("spreadsheets"),
  rowId: v.string(),
  columnId: v.string(),
  rowOrder: v.number(),

  kind: cellKindValidator,
  text: v.optional(v.string()),
  value: v.optional(formulaValueValidator),
  formulaId: v.optional(v.id("formulas")),

  /** Styling inside this cell's own text. Rare. */
  marks: v.optional(v.array(markValidator)),
  /** An override on this cell alone. Regions live in the body. */
  format: v.optional(blockFormatValidator),

  mergedTo: v.optional(v.object({ rowId: v.string(), columnId: v.string() })),
  spillTo: v.optional(v.object({ rowId: v.string(), columnId: v.string() })),
  data: v.optional(v.string())
}).index("by_column_and_row", ["projectId", "resourceId", "columnId", "rowOrder"]);
```

**One index.** Deleting a row runs one query per column rather than carrying a
second index over every cell in the deployment — at a hundred million cells a
second index costs more than the documents it points at.

`projectId` leads it like every other index in the schema, and this is the table
where that matters most: `resourceId` alone would make one forgotten predicate a
cross-project read of the largest table there is.

---

## The body

`app/src/lib/capabilities/spreadsheets/types/body.ts`

```ts
import { v, type Infer } from "convex/values";
import { formatRuleValidator } from "$spreadsheets/types/format-rule";
import { pageSetupValidator } from "$shared/types/page-setup";
import { styleSetValidator } from "$shared/types/style-set";

const spreadsheetAnalyticValidator = v.object({
  id: v.string(),
  analyticId: v.id("analyses"),
  anchor: v.object({ rowId: v.string(), columnId: v.string() }),
  offset: v.object({ x: v.number(), y: v.number() }),
  size: v.object({ width: v.number(), height: v.number() }),
  zIndex: v.optional(v.number())
});

export const sheetPrintValidator = v.object({
  page: pageSetupValidator,
  /** Absent prints the used range. */
  area: v.optional(v.object({
    from: v.object({ rowId: v.string(), columnId: v.string() }),
    to: v.object({ rowId: v.string(), columnId: v.string() })
  })),
  /** Repeated on every page — what makes a long table readable on paper. */
  repeatRows: v.optional(v.array(v.string())),
  repeatColumns: v.optional(v.array(v.string())),
  scale: v.optional(
    v.union(v.number(), v.literal("fit-width"), v.literal("fit-page"))
  ),
  gridlines: v.optional(v.boolean()),
  headings: v.optional(v.boolean())
});

/**
 * The shape of the grid: what exists, in what order, and what is formatted.
 *
 * **A row entry carries two positions and they do different jobs.** Its place in
 * the array is the *ordinal* — the number drawn beside it, and the number `A1`
 * is built from. Its `order` is a *sort key*, copied onto every cell in it,
 * which is what an index can range over. The array cannot be indexed by the cell
 * table and the sort key cannot be counted, so both are stored.
 *
 * **`rowPartCounts` is the directory.** Arrays concatenate in part order, so
 * finding the part holding the five-hundred-thousandth row means knowing how
 * many rows each earlier part holds. Part 0 is read regardless, so it carries
 * the counts.
 *
 * **Rows are dense.** The Nth entry *is* the Nth row, which is what makes the
 * ordinal free. A new sheet materializes as many rows as it draws, and grows as
 * someone scrolls.
 */
export const spreadsheetBodyValidator = v.object({
  rows: v.array(
    v.object({ id: v.string(), order: v.number(), height: v.optional(v.number()) })
  ),
  columns: v.array(
    v.object({ id: v.string(), order: v.number(), width: v.optional(v.number()) })
  ),
  /** Entries per part, in part order. Read from part 0. */
  rowPartCounts: v.array(v.number()),
  formatRules: v.array(formatRuleValidator),
  /** Live analytic references floating over the grid; the surface owns placement. */
  analytics: v.array(spreadsheetAnalyticValidator),
  frozenRows: v.optional(v.number()),
  frozenColumns: v.optional(v.number()),
  print: sheetPrintValidator,
  styles: styleSetValidator
});

export type SpreadsheetBody = Infer<typeof spreadsheetBodyValidator>;
```

### Analytic references stay in the body

Analytic overlays are bounded floating objects, so their live references live
with grid shape rather than in the unbounded `sheetCells` table. Each stores the
shared analytic ID plus row/column anchor, offset, size, and optional z-order.
It does not embed a second chart copy.

The referenced [analytic model](../data-models/data/analysis.md) carries its last
complete chart/table component. The hand-built chart dispatcher supports all
twelve declared chart types. Type-specific element restrictions live in the
chart union and validator, not in a settings panel.

### Formatting is regional

`app/src/lib/capabilities/spreadsheets/types/format-rule.ts`

```ts
import { v, type Infer } from "convex/values";
import { blockFormatValidator } from "$content/types/format";

/**
 * Formatting applied to a region, resolved by overlaying rules in order.
 *
 * **Rules rather than a value on every cell**, because formatting is almost
 * never per-cell: a column is currency, a header row is bold, a block carries a
 * table style. A heavily formatted professional sheet is hundreds of rules
 * against a hundred million cells, and resolving one cell means scanning those
 * hundreds in memory.
 *
 * Two corner cells, like a merge and like a formula range — so inserting a row
 * inside a formatted region extends the formatting, because the corners have not
 * moved.
 *
 * A one-off on a single cell stays on the cell.
 */
export const formatRuleValidator = v.object({
  from: v.object({ rowId: v.string(), columnId: v.string() }),
  to: v.object({ rowId: v.string(), columnId: v.string() }),
  /** A key into the body's style set. */
  style: v.optional(v.string()),
  format: v.optional(blockFormatValidator)
});

export type FormatRule = Infer<typeof formatRuleValidator>;
```

### What a cell is

`app/src/lib/capabilities/spreadsheets/types/cell.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * How a cell's text was interpreted. A cell functions differently by kind — a
 * date is a date and not a string that looks like one.
 */
export const cellKindValidator = v.union(
  v.literal("empty"),
  v.literal("text"),
  v.literal("number"),
  v.literal("date"),
  v.literal("logic"),
  v.literal("formula"),
  v.literal("list"),
  v.literal("record"),
  v.literal("table"),
  v.literal("reference")
);

export type CellKind = Infer<typeof cellKindValidator>;
```

---

## What every operation costs

| | reads | writes |
| --- | --- | --- |
| render a viewport | body part + one range per visible column | — |
| edit a cell | — | 1 cell |
| insert a row | 2 neighbours | 1 body part |
| insert a column | 2 neighbours | 1 body part |
| move a row | its cells | 1 body part + O(columns) cells |
| delete a row | its cells, one query per column | 1 body part + its cells |
| merge, or format a region | — | 1 cell, or 1 body part |

**A viewport is flat.** Twenty visible columns, each a range over `rowOrder`
between the first and last visible row: about six hundred documents, whatever the
sheet's size. The index goes straight to the window.

**A row insert touches no cell.** It splices the body's array and takes the
midpoint of two neighbours' `order`. Sparse keys are what buy that.

The exception is inserting or deleting cells over a *partial* column range, which
shifts every cell below it in those columns. No stored shape avoids it, because
the cells move relative to their rows rather than the rows moving.

---

## Not here yet

**No derived cells.** A document holds a prompt block that generates its own
content, and a cell has no equivalent because it holds a value rather than a
block. When that arrives it is a cell kind and a reference, not a change to how
the grid is stored.

**No sheet-level names.** A name is a project-level [variable](data.md), so a
region of this grid cannot yet be given one and pointed at from elsewhere. That
is a field this body gains later, not something missing from it now.

---

## Where a row can grow

`SpreadsheetBody.rows` is the only unbounded field here — a million rows at ~36
bytes is ~36 MB, so ~36 parts. `rowPartCounts` is what makes a part findable by
ordinal without reading the ones before it.

`sheetCells` has no unbounded field. A cell is a fixed handful of scalars.

---

## Files

```text
app/src/lib/capabilities/spreadsheets/
├── overview.md
├── schema/
│   ├── schema.md
│   ├── spreadsheets.ts
│   ├── sheet-cells.ts
│   └── tables.ts                   spreadsheetsTables
└── types/
    ├── types.md
    ├── body.ts                     SpreadsheetBody, SheetPrint
    ├── cell.ts                     CellKind
    └── format-rule.ts              FormatRule
```

### Registering it

```js
// app/svelte.config.js
      $spreadsheets: "src/lib/capabilities/spreadsheets",
```

```json
// app/src/convex/tsconfig.json
      "$spreadsheets/*": ["../lib/capabilities/spreadsheets/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { spreadsheetsTables } from "$spreadsheets/schema/tables";
```

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor),
[`$shared/types/page-setup`](shared.md#pagesetup),
[`$shared/types/style-set`](shared.md#styleset),
[`$content/types/format`](content.md#blockformat),
[`$content/types/value`](content.md#formulavalue),
[`$content/types/block`](content.md#inside-a-text-block) for `Mark`.

## Related

[all tables](README.md) · [spreadsheet revisions](spreadsheet-revisions.md) ·
[resources](resources.md) · [data](data.md)
