# Spreadsheet editor — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | The editor: a Univer grid, with Icarus's own calculation behind it | Editor |

## Layout

| 1fr |
| --- |
| editor |

The whole workspace is one region — a grid edge to edge, with no sheet tabs, no
formula bar and no name box taking rows off it.

## Editor

### The framework

**Univer.** The grid surface: headings, scrolling, selection, in-cell editing,
merges, and the rendering of a sparse sheet.

The Univer instance, the nested block editor, calculation buffers and undo history
live in the tab runtime.

### What we do not take from it

**Its calculation engine, entirely.** Icarus's formula engine is the only
calculation authority. Univer's is bypassed, not configured — two engines would
mean two answers, and only one of them can be the one a document's inline formula
reads.

**Workbooks.** A tab is a spreadsheet, not a workbook of sheets. Sheet tabs, the
Sheets panel and the frozen-column rule are all gone.

**The formula bar and the name box.** The inspector already names the cell and
holds its formula, with what it reads and what it feeds underneath.

**The toolbar.** Formatting is a section of whatever cell or range is selected.

### What we add on top

**Project variables.** A formula can refer to a name defined for the whole
project, kept visibly apart from this spreadsheet's own named ranges so the two
scopes cannot be confused.

**Spills.** A formula returning a range occupies cells it did not start in. A
spill child is read-only, names its origin, and a write into the occupied range
fails visibly rather than quietly breaking the spill.

**Dependency inspection.** What a cell reads and what it feeds, derived from the
current formulas. There is no persisted dependency graph.

**Prompt blocks and inline formulas**, as elsewhere — though what a generated
paragraph means inside a cell is not yet decided.

**Zoom**, by the same pinch mechanism as the other two.

### What we configure

| | |
| --- | --- |
| Named styles | Weight, alignment, borders, value format |
| Named ranges | Local to this spreadsheet |
| Print | Paper, orientation, scale, print area, repeat rows and columns |
| Show | Gridlines and headings |

### What is unresolved

**Open** — row and column insert and delete need one structural-rebase contract
covering A1 keys, formulas, comments, named ranges, merges, spills and chart
anchors, applied atomically or rejected with the work preserved. These are the
most dangerous commands on the screen.

**Open** — the grid is sparse, so an empty cell has no persisted block and
formatting an empty range has nowhere to be stored.

**Resolved** — charts, their datums, axes, and added elements have stable ids.
The chart frame owns drag and resize handles while its SVG marks keep selection
and annotation interactions.

**Open** — with no formula bar, in-cell editing has to be excellent, and a long
formula needs somewhere to breathe.

**Open** — freezing rows and columns has no affordance now that the frozen-column
rule is gone. It needs one that explains itself.
