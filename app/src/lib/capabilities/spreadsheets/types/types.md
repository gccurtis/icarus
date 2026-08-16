# Spreadsheet Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`spreadsheet.ts`](spreadsheet.ts) | `Spreadsheet`, and `spreadsheetTitle` |
| [`body.ts`](body.ts) | `spreadsheetBodyValidator`, `sheetValidator`, `emptySpreadsheetBody` |

## The body type is the workbook's, not the revision machinery's

`revisions` stores a workbook body and has never looked inside one. It imports
this to build the union its snapshot column is declared with, which is the only
place the three resources are named together.

## Cells keep their A1 keys; everything else gets an id

The one asymmetry in the whole content model, and it is deliberate. `B7` is what
a formula references, what a range spans, and what a person means when they point
at it — an id would make `=SUM(B2:B10)` resolve through a position-to-id map
somebody has to maintain, and a cell "moved" to another address would keep an
identity nothing else in the sheet agrees with.

The cost is that inserting a row rekeys the populated cells below it. That is
inherent to a grid: the alternative moves the rekeying into an index nobody can
see.

## Sparse everything

`cells` is a map rather than a two-dimensional array, and `merges` is a list of
ranges present only where a merge exists. A 1000 × 26 array is 26,000 entries to
hold a dozen values, and inserting a row rewrites all of them. `rowCount` and
`columnCount` are the *declared extent* — what the grid draws — and are
independent of which cells hold anything.

Sparseness is also what makes a sheet merge well: a cell edit is one `set` on one
path, so two people working in different parts of a sheet never contend.

## Spills and charts look alike and behave oppositely

A **spill** is data: a formula returning a table genuinely occupies those cells,
and writing into them must fail rather than silently produce two claims on one
square. It is derived from formula results and materialized anyway, on the same
terms as `utc` on a date — the formula is the authority, the range is rewritten
on recalculation, and it is never edited.

A **chart** is not data. It anchors to a cell with an offset in points and
carries its own size, floating above the grid — which is what lets it overlap the
data it plots and be nudged a few points without resizing a row.
