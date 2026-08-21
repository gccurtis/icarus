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

**Shows now** — Column/Bar · Line · Area · Scatter · Bubble · Pie/Doughnut ·
Waterfall · Mekko · Funnel · Radar · Heatmap · Treemap

**Needs** — chart creation from the current selection as a source range.

Every listed type has a native identified model and SVG renderer. Creation
remains blocked until the selected-range adapter can construct the required
channels and persist the chart in one mutation.

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
