# Spreadsheet

A workbook of sheets. A sheet is a sparse map of cells, and a cell holds content
blocks like everything else.

```ts
interface Spreadsheet {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
}

// the body, stored as a leader snapshot plus change sets
interface SpreadsheetBody {
  sheets: Sheet[];
  namedRanges?: NamedRange[];
}

interface Sheet {
  name: string;
  cells: Record<string, SheetCell>;     // keyed by A1 notation: "B7"
  rowCount: number;
  columnCount: number;
  columnWidths?: Record<string, number>;   // "B" -> px
  rowHeights?: Record<string, number>;     // "7" -> px
  frozenRows?: number;
  frozenColumns?: number;
  hidden?: boolean;
}

interface SheetCell {
  blocks: ContentBlock[];
}

interface NamedRange {
  name: string;
  sheet: string;
  range: string;               // "B2:D10"
}
```

## A cell holds blocks

A cell accepts text blocks and formula blocks. Not because a cell needs the
whole union — it does not — but because a cell is a small box containing
authored content, which is exactly what a block is. Giving cells their own
content type would mean a second editor, a second renderer, a second set of
formatting rules, and a second thing to keep in sync with the first.

Alignment, background, and borders come from the block's `format`. Cell styling
was the strongest argument for a bespoke cell type, and it dissolves once
formatting lives on the block: a right-aligned cell is a block with
`format.align = "end"`, the same as a right-aligned paragraph in a document.
`verticalAlign` matters here in a way it does not in prose, since a cell is a box
taller than its content.

Number and date presentation is `format.valueFormat` on the block, not a field on
the cell. It looked like a cell property — currency, percentage, decimals are the
cell's role in the sheet — but a formula can return a table, whose columns are
typed independently, so the format has to live where the value does.

So `SheetCell` is now nothing but its blocks. That is the right end state: a cell
is a position in a grid, and everything about what it contains belongs to what it
contains.

## Value cells and prose cells are different

A cell holding `=SUM(B2:B10)` is a [formula
block](../content/content-block.md#formula-blocks): it has a typed `value`, and
other formulas can depend on it.

A cell holding `Revenue was {{SUM(B2:B10)}} this quarter` is a text block with a
formula atom: it produces a string, and nothing can depend on it numerically.

Both are legal in a cell and they are not the same thing. The distinction is
carried by the block type rather than by a flag on the cell, so the resolver
never has to guess which one it is looking at.

## Sparse storage

`cells` is a map keyed by A1 notation, not a two-dimensional array. Sheets are
overwhelmingly empty — a `1000 × 26` array is 26,000 entries to store a dozen
values, and inserting a row rewrites all of them.

`rowCount` and `columnCount` are the sheet's declared extent, which is what the
grid renders. They are independent of which cells actually hold content, so an
empty sheet still shows a grid.

The cost of A1 keys is that inserting a row means rekeying every cell below it.
That is a real operation on a real sheet, but it is bounded by the populated
cells rather than the declared extent, and it keeps the far more common
operations — read a cell, write a cell, resolve a reference — as single map
lookups. A formula referring to `B7` finds it directly.

## What is not here

No charts, no pivot tables, no calculation graph. A chart over sheet data is an
[analysis](../research/research.md) rendered where it is wanted, not a hidden
object inside the workbook. The dependency graph for recalculation is derived
from the formulas at load; persisting it means maintaining a second
representation that can disagree with the first.

## The body is not on this row

`sheets` and `namedRanges` live in the [leader
snapshot](../revisions/resource-snapshot.md), with the current body being that
snapshot plus the [change sets](../revisions/change-set.md) after it — the same
arrangement as a [document](document.md#the-body-is-not-on-this-row).

Sparse cell storage and change sets fit each other well: a cell edit is one
`set` at path `sheets/0/cells/B7`, so two people working in different parts of a
sheet have disjoint paths and merge without contention. A dense array would make
every edit touch a shared structure.

## Related

[content block](../content/content-block.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[external file](../special-resources/external-file.md)
