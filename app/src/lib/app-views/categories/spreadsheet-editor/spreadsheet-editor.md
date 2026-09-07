# Spreadsheet Editor

Lives at `src/lib/app-views/categories/spreadsheet-editor/spreadsheet-editor.md`.

One sheet, keyed by `resourceId`. There is no formula bar: what a cell holds is
read and written at the top of its lens, and every gesture on the grid is an op
on the live sheet held by `view.spreadsheetRuntime(id)`.

| Content | Shows |
| --- | --- |
| [`sheet.svelte`](content/sheet.svelte) | The grid, edge to edge, under a title bar and over a strip with undo, redo, zoom and the saved state |

The grid is drawn by [`sheet-surface`](../../../components/authored/sheet-surface/index.ts),
a canvas grid over Glide Data Grid. The view projects the live sheet into a scene
and hands it down; every intent that comes back is turned into ops here. The
library is a projection and an input device, and nothing about the sheet is
defined by it. The corner selects the used range, the row after the last one
appends twenty rows, the column after the last one appends fifty, and Ctrl with
an arrow jumps to the edge of the contiguous values the way a spreadsheet does.

## Context

| View | Shows |
| --- | --- |
| `grid` | The grid's shape: used range, counts, problems, where a row or column is added, and the frozen row and column |
| `find` | Find first, then replace; a hit leads with its cell and the text around it |
| `formulas` | A way into the function builder, then every formula cell and every broken one, filtered by address or expression |
| `styles` | The named cell styles, how many cells wear each, and Apply over the selection |
| `comments` | Open threads as the document draws them; choosing one selects the cell it sits on |

`charts`, `variables`, `templates` and `prompts` are on the rail and render the
shell's placeholder. Charts wait on a field in the body; the other three are
placeholders on every editor's rail.

## Inspector

| Lens | Opened by |
| --- | --- |
| `spreadsheet` | Nothing selected |
| `cell` · `cell-with-formula` · `error-cell` · `spill` | One coordinate, by what is there |
| `range` | A drag, or several with Ctrl |
| `row` · `column` | A heading |
| `named-style` | A row in Styles |
| `text-selection` | Characters selected in the cell lens's text |

A cell lens leads with the value or the expression, editable in place, then the
type, the format, the number format for numbers, its precedents and dependents,
and its comments. A precedent on another sheet opens that sheet on the cell it
names. A range selection keeps the corner the drag started from.

## Components

Three pieces the lenses share, each reading the selection itself: the format
band, which writes a cell's own format or a rule over a range, sets its type
and colors the way the document's text lens does, and sizes the row and column
a cell sits in; the number format builder, which composes a value format from a
prefix, a suffix, the decimals and the two separators; and the comments section
every cell lens ends with.

## Formulas

`procedures/evaluate.ts` reads an expression, answers with a value, an error, or
"unsupported", and `recalculated` writes every formula cell in dependency order.
An edit and its consequences travel as one change, so undo takes both back. What
it will not answer for it leaves alone: a reference to another sheet, and a
function that returns a range. A cycle is `#CYCLE!`; an expression it cannot read
is `#ERROR!`.

While an expression is being written in a lens, clicking the grid writes the
address it names rather than moving the selection, dragging writes the range,
and F4 cycles what a reference is anchored to.

## Procedures

Pure, and the whole of the editor's reasoning: addresses between ids and A1,
values between typed text and stored kinds, paint from the style set through the
rules to the cell, spans for merges and spills, number formats between a pattern
and its parts, marks addressed by offset in a cell's one atom, sizes between
stored pixels and shown points, anchoring for what F4 cycles, and one module per
gesture that returns ops —
cells, structure, fill, clipboard, styles. `scene` is the projection the surface
draws and `selecting` is the signal a selection sends to the inspector. Every
procedure takes the live sheet and a grid and returns ops or a refusal; none
writes.

## What is not here

The evaluator is the editor's own, not the project's engine: it covers the
functions the builder offers and the arithmetic around them, and hands back
"unsupported" for everything else. A sheet cannot freeze a leading row, because
the grid library freezes columns and trailing rows only; a merge is drawn across
columns for the same reason.
