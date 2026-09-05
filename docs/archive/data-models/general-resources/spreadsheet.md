# Spreadsheet

A workbook of sheets. A sheet is a sparse grid of cells holding content blocks,
plus the things that sit across cells rather than in them.

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
  styles: StyleSet;
}

interface Sheet {
  id: string;
  name: string;
  cells: Record<string, SheetCell>;    // keyed by A1 notation: "B7"
  merges: string[];                    // ["B2:D4"] — sparse
  spills: SpillRange[];
  charts: SheetChart[];
  rowCount: number;
  columnCount: number;
  columnWidths?: Record<string, number>;   // "B" -> points
  rowHeights?: Record<string, number>;     // "7" -> points
  frozenRows?: number;
  frozenColumns?: number;
  print: SheetPrint;
  hidden?: boolean;
}

interface SheetCell {
  blocks: ContentBlock[];
}

interface SpillRange {
  origin: string;                      // "B2" — the formula that produced it
  range: string;                       // "B2:D10" — what it occupies
}

interface SheetChart {
  anchor: { cell: string; dx: number; dy: number };   // top-left, offset in points
  size: { width: number; height: number };            // points
  kind: "line" | "bar" | "column" | "area" | "pie" | "scatter";
  data: string;                        // "Sheet1!A1:D20"
  seriesInColumns?: boolean;
  title?: string;
  hasHeaders?: boolean;
}

interface SheetPrint {
  page: PageSetup;
  area?: string;                       // "A1:H50" — absent prints what is used
  repeatRows?: string;                 // "1:2" on every page
  repeatColumns?: string;
  scale?: number | "fit-width" | "fit-page";
  gridlines?: boolean;
  headings?: boolean;                  // print the A/B/C and 1/2/3 rulers
}

interface NamedRange {
  name: string;
  sheet: string;
  range: string;
}
```

## A cell holds blocks

A cell accepts text blocks and formula blocks. Not because it needs the whole
union, but because a cell is a small box containing authored content, which is
what a block is. A bespoke cell type would mean a second editor, a second
renderer, and a second set of formatting rules to keep in sync with the first.

`SheetCell` is now nothing but its blocks, and that is the right end state.
Alignment, fill, and borders are the block's `format` — `verticalAlign` finally
earning its place, since a cell is a box taller than its content. Number and date
presentation is `format.valueFormat`, which had to move off the cell once
[formulas could return tables](../content/content-block.md#formulas-return-objects-not-scalars)
whose columns are typed independently.

## Value cells and prose cells are different

`=SUM(B2:B10)` is a [formula
block](../content/content-block.md#formula-blocks): it has a typed value other
formulas can depend on. `Revenue was {{SUM(B2:B10)}} this quarter` is a text
block with a formula atom: it produces a string nothing can depend on
numerically.

Both are legal in a cell. The distinction is carried by the block type rather
than a flag, so the resolver never guesses.

## Cells keep their A1 keys; everything else gets an id

Sheets, charts, and the blocks inside cells carry ids like everywhere else. Cells
do **not** — their key stays A1 notation.

A cell's identity *is* its position. `B7` is what a formula references, what a
range spans, and what a person means when they point at it. Giving a cell a
stable id would mean `=SUM(B2:B10)` resolves through a position-to-id lookup that
has to be maintained, and a cell "moved" to a different address would keep an
identity nothing else in the sheet agrees with.

The cost is the one already noted: inserting a row rekeys every populated cell
below it. That is inherent to a grid, not a consequence of this choice — the
alternative just moves the rekeying into an index nobody can see.

## Sparse everything

`cells` is a map keyed by A1 notation, not a two-dimensional array. Sheets are
overwhelmingly empty — a 1000 × 26 array is 26,000 entries to hold a dozen
values, and inserting a row rewrites all of them.

`merges` follows the same principle: a list of ranges, present only where a merge
exists. Merges have to be stored rather than inferred because nothing else
records them — two cells that render as one look identical to one cell with a
wide neighbour, and the sheet has to know which it is to place the next value.

`rowCount` and `columnCount` are the declared extent, which is what the grid
draws. Independent of which cells hold content, so an empty sheet still shows a
grid.

The cost of A1 keys is that inserting a row rekeys the cells below it — bounded
by populated cells rather than declared extent, and it keeps the far more common
operations single map lookups. A formula referring to `B7` finds it directly.

Sparse cells also merge well: a cell edit is one `set` at
`sheets/0/cells/B7`, so two people working in different parts of a sheet have
[disjoint ids](../../processes/change-conflicts.md) and never contend. A
dense array would make every edit touch a shared structure.

## Spills occupy cells; charts do not

The two look similar and behave oppositely.

A **spill** is data. A formula returning a table renders across a range, and
those cells are genuinely taken — writing into them must fail rather than
silently produce a sheet where a value and a spilled result claim the same
square. `SpillRange` records what is occupied and which formula owns it, so
collision detection is a lookup rather than an evaluation of every formula on the
sheet.

It is derived from formula results and materialized anyway, on the same terms as
[`utc` on a date](../content/content-block.md#dates): the formula is the single
authority, and the range is rewritten on recalculation, never edited.

A **chart** is not data. It anchors to a cell with an offset and carries its own
size, floating above the grid.

Charts were tempting to model as occupying a region — it is tidy, and it makes
"where is the chart" a range. But it couples chart size to row and column
dimensions, so resizing a chart means resizing rows; it prevents a chart from
overlapping the data it plots, which is the normal layout; and it means a chart
cannot be dragged a few points to line up with something. Anchoring costs one
thing — the chart moves when rows are inserted above it — and that is the
behaviour people expect anyway.

`data` is a range string rather than extracted values, so the chart follows the
sheet. A chart holding its own copy of the numbers is a chart that is wrong after
the next edit.

## Print setup

`print` is per sheet, not per workbook. Sheets in one workbook are routinely
different shapes — a landscape data dump beside a portrait summary — and forcing
one setup would make the workbook printable only for whichever sheet it was
configured for.

`repeatRows` is what makes a long table readable on paper, and `scale` covers the
two things people actually ask for: fit the width so columns are not orphaned
onto a second sheet, or fit everything on one page.

`area` absent means print the used range. That is right as a default because the
used range is what a person sees, and requiring an explicit area would make every
new sheet print nothing.

## Styles

`styles` is the workbook's [style set](style-set.md), shared with documents and
decks. A sheet with named styles for headers, totals, and input cells is
restyled once rather than cell by cell.

## The body is not on this row

`sheets`, `namedRanges`, and `styles` live in the [leader
snapshot](../revisions/resource-snapshot.md), with the current body being that
snapshot plus the [change sets](../revisions/change-set.md) after it — the same
arrangement as a [document](document.md#the-body-is-not-on-this-row).

## What is not here

No calculation graph. The dependency order for recalculation is derived from the
formulas at load; persisting it means maintaining a second representation that
can disagree with the first.

No pivot tables. A pivot is an aggregation whose output is a table — which is
what a [formula returning a
table](../content/content-block.md#formulas-return-objects-not-scalars) already
produces, spilled across a range. If pivots need more than that, it will be a
formula feature rather than a workbook one.

## Related

[content block](../content/content-block.md) · [page setup](page-setup.md) ·
[style set](style-set.md) ·
[resource snapshot](../revisions/resource-snapshot.md) ·
[change set](../revisions/change-set.md) ·
[external file](../special-resources/external-file.md)
