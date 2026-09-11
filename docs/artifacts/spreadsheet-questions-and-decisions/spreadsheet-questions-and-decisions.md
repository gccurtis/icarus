# Spreadsheet Questions and Decisions

Published at https://claude.ai/code/artifact/5fdbb96c-918e-4266-9a64-9ee832fc4ed5

Twenty-six forks, numbered so they can be answered by number. Each carries a
recommendation and the reason for it; none is marked settled, because none has
been answered. Five have to be answered before phase A can start. Below them, what
the code and the worktrees already settle, and the routine calls made along the
way that a "no" would undo cheaply.

| Readout | |
| --- | --- |
| Forks | 26 |
| Key, before phase A | 5 |
| Model changes asked | 7 |
| Settled by the tree | 9 |

## Key decisions: five that gate the build

**1 · What draws the grid inside `sheet-surface`.** A library or our own Svelte.
The candidates, as of September 2026: RevoGrid (MIT, Svelte 5 adapter, virtualised,
range selection, clipboard, basic autofill, pinned rows and columns; cell merging
and series autofill are Pro), Univer (Apache 2, a complete spreadsheet whose view
layer is React 18 with its own model, commands, undo and formula plugin),
Handsontable ($899 per developer per year commercially), Jspreadsheet CE (MIT, DOM
table, merges and frozen columns, lazy loading rather than virtualisation).
*Recommended at the time: build it, as an authored component,* on the reasoning that
the slide editor had just dropped Konva for `slide-surface`.

**Reversed in the build. What runs is Glide Data Grid 6.0.3 (MIT) inside a React
root, wrapped by the authored Svelte component `components/authored/sheet-surface`.**
The estimate was wrong about cost: virtualisation, range and multi-rect selection,
clipboard, fill handle, IME and column resize are weeks of work each and all of them
are in the library. Nothing outside `sheet-surface` knows the library exists.

The boundary, as built:

- **Svelte owns the state.** The component takes a `SurfaceScene` — tracks, a
  `cellAt(row, column)` and the merged blocks — plus a selection and highlights, and
  emits intents (`onselect`, `onedit`, `onfill`, `onpaste`, `onresize`, `onbegin`).
  It holds no sheet and no ops.
- **React is a rendering detail, mounted once.** `createRoot` on a host div, and one
  `$effect` re-renders `DataEditor` whenever the scene, theme or size changes. There
  is no React state, no context, and no component tree beyond the grid itself.
- **Glide draws the cells and owns the scroll.** `sheet-surface-glide.ts` translates
  a `SurfaceCell` into a `GridCell` and paints runs, borders and pins in `drawCell`.
- **Everything the library cannot do is drawn over it.** It spans columns but not
  rows, has no row resize, and its `getBounds` answers for an unscrolled grid — so
  merged blocks and both resize handles are DOM overlays positioned by
  `sheet-surface-geometry.ts` from the same track sizes the library is handed, offset
  by the scrolling element's own `scrollTop` and `scrollLeft`.

The fallback if the library is ever dropped is unchanged: the scene and the intents
are the contract, and only this one directory would be rewritten.

**2 · A `sheet` op target for everything above the cells.** `SpreadsheetOp` can set
a cell, a rule or a mark and can insert, remove and move rows, columns and rules.
It cannot set `frozenRows`, a row's height, a column's width, anything under
`print`, or a style. Every panel control on the rail and half the lens controls
need one of those. *Recommendation: add `set`, `insert` and `remove` on target
`"sheet"`* with plain field paths, exactly as the document gained its `document`
target: `frozenRows`, `rows/r6/height`, `columns/c3/width`,
`print/page/orientation`, `styles/defaultKey`, `styles/styles/currency/fontWeight`;
insert and remove on `styles` by key. This is a representation change and is not
made until it has a yes.

**3 · The runtime's live copy is `sheet: { body, cells }`.** `SpreadsheetRuntime.body`
is typed as the grid body alone. A sheet's content is rows in `sheetCells`, so a
body alone cannot be projected, applied to or read back. Either the runtime grows a
second member for cells, updated in step, or its live copy is one value holding
both. *Recommendation: one value, `sheet: LiveSheet`,* with
`LiveSheet = { body, cells: Record<"rowId/columnId", SheetCellFields> }` declared in
`representation/data/types/spreadsheets/live.ts`, so one applier moves one thing
and a scene projects from one consistent copy. The other two runtimes keep `body`;
the sheet is the resource whose content is not in its body, so its live copy has a
name of its own. A model change in `model/client`, not the representation.

**4 · The rail: order, landing, and what leaves it.** Today: Overview, Variables,
Named ranges, Find, Dependencies, Objects, Insert, Styles, Print, Comments, Context,
landing on Overview. The document since dropped Overview, Insert and Context and
added Templates and Prompts; the presentation's rail is Slides, Insert, Layers, Style, Find,
Comments, Templates, Variables, Prompts. *Recommendation: Grid · Find · Dependencies
· Styles · Print · Objects · Comments · Variables · Templates · Prompts, landing on
Grid.* Grid is new: the sheet's shape, and the home frozen panes never had.
Overview's facts move to the title bar, the spreadsheet lens and Grid; Insert's jobs
move to the lenses and the context menu; Context was called premature by the record
itself; Named ranges become a band of Grid once the body has names. The four keys
stay in the vocabulary, off the rail, as the document's do.

**5 · Row and column lenses, as new keys.** The design record says "no row lens and
no column lens" because a cell's identity was its A1 address and rows and columns
were not identified. In the body they are: `GridRow` and `GridColumn` carry ids,
orders and sizes, and the ops name them. *Recommendation: add
`spreadsheet-editor.row` and `spreadsheet-editor.column`.* A heading click opens a
lens with what a row or a column actually has, height or width, insert, remove and
freeze up to here, and the most dangerous commands on the screen land where the
thing they act on is already selected. A third key, `text-selection`, is question
25.

## Model: seven more that touch the representation

None of these is assumed. Each is written as the change it would be, with the
recommendation beside it, and the pages elsewhere mark every place that depends on
one with *asked*.

**6 · How a coordinate empties.** Only `set` names `cell`; there is no
`remove cell`. Clearing a cell has to be expressible and invertible.
*Recommendation: a whole-cell `set` to `null` clears,* with `was` carrying the
fields, matching how the document applier treats a null field as absence. No new op
shape.

**7 · Format rules carry ids.** `FormatRule` has corners, a style and a format, and
no id. An op on a rule has to name it by position, which two people inserting rules
would break. *Recommendation: `FormatRule.id`,* minted like every other identified
thing, so `set formatRule formatRules/f9/format/valueFormat` names a rule and not a
slot. The template's `TemplateFormatRule` stays addressed and unidentified, as its
document says.

**8 · Marks inside a cell can be inserted and removed.** `set` on `mark` exists;
`insert` and `remove` do not. A bold that did not exist cannot be written.
*Recommendation: extend `insert` and `remove` to target `mark`* with path
`r3/c2/marks`, ids and values, as the document's mark ops are shaped. Cheap in the
applier; the lens that uses it is question 25.

**9 · Expression text after a row is inserted.** Cells hold ids, so inserting a row
moves nothing. The one string that names cells by A1 is the expression a person
authored, `=SUM(C2:C5)`, and after an insert above row 3 it is wrong while the cells
it meant are right. *Recommendation, for the engine: hold references by id and
render A1 on display,* so nothing is rewritten on insert and the text a person sees
is always current. Until the engine exists the grid leaves the text as authored and
the lens says so. This decides the shape of `formulas.representation` and belongs
to the engine's design, not this round's build.

**10 · Named ranges in the body.** The body has no field for names; the archived
tables document says "a field this body gains later". Three panels and one lens on
the old design depend on it. *Recommendation: `names: { id, name, range: CellRange }[]`
on the body,* written through the `sheet` target, listed in the Grid panel's Names
band, edited in the named-range lens. Not this round; the band and the lens are
drawn as what they will be and gated with the reason.

**11 · Objects in the body.** There is no `SheetChart` or any object on
`SpreadsheetBody`. The Objects panel and the chart lens have nothing to read.
*Recommendation: `objects: { id, kind, anchor: CellRef, dx, dy, width, height, source: CellRange, title }[]`,*
with ids from the start so selection, update, reconciliation and comments all work.
Not this round; the panel stays a placeholder and the grid page draws one gated
object so the anchoring is agreed before it is built.

**12 · Comments on a range, a row or a column.** `AnchorWithin` has a cell and text
inside a cell. A column of numbers, the most natural thing to remark on in a sheet,
cannot be commented on. *Recommendation: a `range` variant with two `CellRef`
corners,* which also covers a whole row or column as a range. Not this round; cell
anchors only, and the Comments panel says so.

## Behaviour: ten about what the editor does

**13 · What a formula cell shows before the engine exists.** A seeded formula cell
has a stored value; a formula typed now has none. Something has to be drawn.
*Recommendation: the stored value when there is one; otherwise the expression
itself, in mono, muted,* and the lens chip reads "waits for the engine". Nothing is
shown that is not true.

**14 · A permanent mark on formula cells.** Excel draws nothing; some sheets draw a
corner tick so formulas can be audited at a glance. *Recommendation: nothing at
rest.* The lens tells you, Find has a formulas layer, and selecting a formula
outlines its reads. A mark on every formula in a dense model is noise.

**15 · Filling a formula down.** Fill of a formula means shifting its references,
which needs the engine's parser. Until then: copy the expression verbatim, refuse,
or disable the handle on formula cells. *Recommendation: refuse with a sentence in
the preview; values and series fill.* Copying verbatim produces formulas that are
silently wrong, which is worse than a handle that says no.

**16 · Merging over cells that have content.** The anchor keeps its value; the
others would be cleared. *Recommendation: ask first, saying how many cells will be
cleared and which one stays,* the same staged confirmation the presentation uses for a
change of aspect ratio and the range lens uses for Clear.

**17 · Formatting an empty range.** The record left this open: formatting is stored
on cells, and an empty coordinate has none. The representation has since made
formatting regional. *Recommendation: a range writes a rule; a single populated
cell writes its own format; a single empty coordinate writes a 1 × 1 rule.* Nothing
materialises for the sake of a colour. This closes the open point rather than
adding to it.

**18 · Reads and feeds before the engine.** Dependencies, the formula lens's two
bands and the outlines on selection need references out of expression text.
*Recommendation: a small reference scanner now,* `procedures/references.ts`,
finding A1 cells, A1 ranges and names in an expression, replaced by the engine's
parse when it arrives. It is display only, so a miss costs a missing outline and
nothing else.

**19 · Aggregates in the status bar.** The record already had sum, average and
count in the status bar and questioned whether the range lens's Aggregate band adds
anything. *Recommendation: the status bar carries Sum · Average · Count for a range;
the lens's Aggregate band stays, shut, with Min and Max added.* The status-bar
surface reads the runtime through workspace state, which a surface may do.

**20 · Find and replace.** The document has Replace. The record kept it out of the
sheet because replacing inside a formula and inside text are different operations.
*Recommendation: not this round.* When it comes, Replace applies to the Values
layer only and never rewrites an expression.

**21 · Print, or Layout.** The document's paper panel is called Layout; the sheet's
key and label are Print. The same icon rule says the same job in two editors is one
mark. *Recommendation: keep Print.* The document's Layout changes what is drawn on
screen; a sheet's page setup changes only the paper. Different job, different word.

**22 · Default row height and column width, and their unit.** `GridRow.height` and
`GridColumn.width` are optional numbers with no unit and no default anywhere in the
body. *Recommendation: pixels at 100% zoom, 24 and 112 as surface constants, with
the Grid panel showing them.* Storing defaults in the body is a model change the
sheet does not need yet; if a later sheet wants its own defaults, they join the
`sheet` target.

## Runtime and store: four about the round trip

**23 · Read the whole sheet, or a window.** The `sheetCells` index is built for a
viewport read, one range per visible column. The first editor can read every cell
of a sheet on attach. *Recommendation: the whole sheet this round,* behind a
`readSpreadsheet` door whose shape does not change when the window read arrives.
The seeded sheets are small; the optimisation waits for a sheet that needs it.

**24 · The change set's tier.** The archived record says a sheet's change sets are
`historical` on write because there is nothing to consolidate; the document writes
`recent`. *Recommendation: `recent`, as the document does,* so the three resources'
procedures stay alike. Nothing reads the tier for a sheet either way.

**25 · Rich text inside a cell this round.** Cells can carry marks. Applying them
needs the text-selection lens, the mark ops of question 8, and the surface
reporting a caret range while editing. *Recommendation: the applier learns the mark
ops now, the lens and the key `spreadsheet-editor.text-selection` land in phase D,
and the in-cell editor stays a single input.* Marks in cells are rare; building the
lens costs little once the ops exist.

**26 · A `scrollTo` channel on the runtime.** Find and Comments need to bring a cell
into view without importing the grid. The document runtime carries
`scrollTo: string | undefined` for a block. *Recommendation:
`scrollTo: CellRef | undefined` on `SpreadsheetRuntime`,* read by the view in an
`$effect` and cleared after use, as the document does. A model change in
`model/client`.

## Settled: nine things the tree already decides

Not questions. Each names where it is settled, so a reader can check it rather than
take it from here.

| Decision | Settled by |
| --- | --- |
| No formula bar, no name box, no sheet tabs, no toolbar. A tab is one spreadsheet. | `spreadsheet-editor.md`, the design record, and the user's brief |
| The client runtime's live copy is the source of truth; the editor is a projection and an input device; every change is ops applied to the live copy first. | work/document-editor · `document.svelte` · `document-runtimes/methods/apply.ts` |
| Typing is the one exception, and for a sheet it is smaller: the text lives in the in-cell editor until commit, then one set. | the same, narrowed by what a cell is |
| Cells are addressed by row and column ids; A1 is a label derived from order. | `representation/data/types/content/formula-value.ts` · `store/tables.ts` · `collaboration/anchor.ts` |
| Formatting is regional: rules over corners in the body; a cell carries only its own override; a style is typography. | `spreadsheets/body.ts` · `style-set.ts` · `store/tables.ts` `SheetCellFields` |
| A merge is `mergedTo` on the anchor; a spill is `spillTo` on the origin; both are far corners. | `store/tables.ts` |
| The editor surface is an authored component taking a scene and emitting intents; the view translates. | work/presentation-editor · `components/authored/slide-surface` · `presentation.svelte` (Konva gone) |
| The rail carries Templates and Prompts as placeholders; Overview and Context leave it; the same job is one icon across editors. | work/document-editor `opening.ts` · work/presentation-editor `rail-entries.ts` |
| Undo is the runtime's op stack, inverted; one gesture is one group; coalescing never touches history. | `spreadsheet-runtimes/methods/history` · `flush/coalesce.ts` |

## Defaults: routine calls made along the way

Each is cheap to reverse and none was worth a question. Say so if one is wrong.

- Enter commits and moves down, Tab right, Shift reverses; Escape cancels; F2 and
  double-click open the stored content; typing replaces it.
- Ctrl-drag adds a range, as in the document; Shift-click extends; the corner
  selects everything; Ctrl+A selects the populated block, then everything.
- Clipboard is tab-separated text, values as displayed and expressions as
  authored; paste past the edge materialises rows and columns.
- A comment pin is a corner triangle on the cell: amber open, client colour
  current, grey dashed detached; a count on hover.
- Spill children are tinted with the violet the app already uses for computed
  content; errors are set in danger tone and mono.
- Reads outline blue, feeds outline orange, find hits and one-off fills tint amber;
  the selection is the active blue.
- Frozen edges are a heavier rule; there is no other affordance on the grid, and
  the Grid panel says it in words.
- The context menu on a heading carries the same items as the row or column lens,
  and the menu on a cell carries the range lens's actions; nothing is only in a
  menu.
- The seed sheet is the outage cost model already in `sheet.svelte`, as body rows
  and cell rows.
- Zoom is per tab, ⌘-wheel, 50 to 200 per cent, read in the status bar, as the
  other two editors do it.

## What this asks of the model, in one table

| # | Change | Where | Needed by | Round |
| --- | --- | --- | --- | --- |
| 2 | `sheet` target: set, insert, remove | `representation/data/types/spreadsheets/op.ts` | Grid · Print · row · column · named-style · header drag | this one |
| 3 | `LiveSheet`; `runtime.sheet` | `types/spreadsheets/live.ts` · `model/client/spreadsheet-runtimes` | everything that reads or applies | this one |
| 5 | keys `row`, `column`; also `grid`, `templates`, `prompts` | `types/workspace/views.ts` · `behavior/workspace/views.ts` · `opening.ts` · `rail-entries.ts` | the rail and two lenses | this one |
| 6 | whole-cell `set` to null clears | `behavior/spreadsheets/apply-ops.ts` | clear · delete · cut | this one |
| 7 | `FormatRule.id` | `types/spreadsheets/body.ts` | every rule op | this one |
| 8 | insert and remove on `mark` | `types/spreadsheets/op.ts` | text-selection lens | this one, applier only |
| 25 | key `text-selection` | `types/workspace/views.ts` | marks inside a cell | this one, phase D |
| 26 | `scrollTo` on the runtime | `model/client/spreadsheet-runtimes/types.ts` | Find · Comments | this one |
| 9 | references by id in the engine | `formulas.representation` | insert above a formula's range | the engine's |
| 10 | `names` on the body | `types/spreadsheets/body.ts` | Grid's Names band · named-range lens | later |
| 11 | `objects` on the body, with ids | `types/spreadsheets/body.ts` | Objects panel · chart lens | later |
| 12 | `AnchorWithin` range variant | `types/collaboration/anchor.ts` | comments on a column | later |

Already there and merely unused: `frozenRows` and `frozenColumns`, `print` in full,
`styles`, `mergedTo` and `spillTo`, `marks` and `format` on a cell, the cell anchor
for comments, the runtime's undo stack, coalescer and inverter, and the keys for
eleven context views and nine lenses.

---

Answer by number; a fork with no answer stays a question. The other pages mark
every dependent place with "asked".
