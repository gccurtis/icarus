# Insert

| View | What it is for | Sections |
| --- | --- | --- |
| Insert | Putting something new into the spreadsheet | Charts · Content · Structure |

## Layout

| 300px |
| --- |
| charts |
| content |
| structure |

## Charts

**Shows** — Column · Bar · Line · Pie

**Needs** — chart creation from the current selection as a source range.

**Open** — blocked with the rest of chart editing until `SheetChart` has a stable
ID.

## Content

**Shows** — Formula · Variable · Prompt block

*Variable* inserts a reference to a project variable; *Formula* inserts an
expression that may use one.

**Needs** — inline formula entities in cells, and the project variable list.

**Open** — what a prompt block is inside a grid. A generated paragraph does not
fit a cell, and whether it becomes an overlay object or a multi-cell region is
undecided.

## Structure

**Shows** — Rows above · Columns left · Merge selection

**Needs** — structural mutation of the grid.

**Open** — row and column insert and delete need one structural-rebase contract
covering A1 keys, formulas, comments, named ranges, merges, spills and chart
anchors — applied atomically, or rejected with the work preserved. Until that
exists these are the most dangerous commands on the screen.
