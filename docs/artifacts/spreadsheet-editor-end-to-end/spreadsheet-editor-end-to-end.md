# The Spreadsheet Editor, End to End

Published at https://claude.ai/code/artifact/cd369b72-679d-4f57-8e0f-395132413c69

One sheet, three copies, two tables. The store holds the canonical grid and its
cells. The client holds a live copy and every change is an operation on it. The
grid on screen is a picture of the live copy and a way to ask for changes, nothing
more. This is how the whole thing works when it is finished, and what has to exist
for it to work.

Four colours run through every diagram: **store** (canonical, teal), **runtime**
(live, magenta), **surface and panels** (projection, blue), **proposed** (needs a
yes, amber).

| Readout | |
| --- | --- |
| Copies | 3, one canonical |
| Tables it lives in | 2, plus change sets |
| Op targets | 6: 5 today, 1 asked for |
| Rail panels | 10, 6 built this round |
| Lenses | 13, 3 new keys |
| Open forks | 26, 5 key |

The companion pages: [The Sheet Surface](../spreadsheet-sheet-surface/spreadsheet-sheet-surface.md),
[The Spreadsheet Rail](../spreadsheet-rail/spreadsheet-rail.md),
[The Spreadsheet Lenses](../spreadsheet-lenses/spreadsheet-lenses.md),
[Questions and Decisions](../spreadsheet-questions-and-decisions/spreadsheet-questions-and-decisions.md).

## 01 · Three copies of one sheet, in two tables

The document and the deck each keep their whole body in one leader snapshot. The
spreadsheet is the one resource whose content is not in its body: the body holds
the *shape* of the grid (which rows and columns exist, in what order, how wide,
what is formatted where, how it prints) and every populated cell is a row of its
own in `sheetCells`. An empty coordinate is the absence of a row.

The client runtime holds a live copy of both halves together, and every change,
from the grid, from a lens, from undo, from another person's accepted change, is a
list of ops applied to that copy first and sent to the store afterwards. The grid
draws whatever the live copy currently is.

```
STORE · canonical                    RUNTIME · live                  SURFACE + PANELS · projection
spreadsheetSnapshots · leader  ──body──▶  live sheet        ──scene──▶  sheet-surface
  rows · columns · rules · print · styles  { body, cells } · $state  ◀╌intents → ops╌  scene in · intents out · owns nothing
sheetCells                     ──cells─▶  apply · undo · buffer · flush
  one row per populated cell   ◀──change set: ops · baseRevision · touched
                                            ◀──apply(ops)──  lenses · panels  ◀╌selection, as ids╌ (from the surface)
```

The dashed arrows are the only places the grid speaks first: a gesture becomes an
intent, the view turns it into ops, the runtime moves, the grid is redrawn. The
store never sends ops; it sends a body and cells at a revision.

> **The grid is a channel, not a place the sheet lives.** A lens that formats a
> range writes a format rule to the live body; the runtime moves; the grid is
> redrawn and the cells are bold because the rule says so. Undo is the same path
> with the ops inverted. Sync is the same path with the store's copy in place of
> the live one. Typing into a cell is the one exception, and a smaller one than the
> document's: the characters live in the in-cell editor until commit, and then they
> are one `set`.

## 02 · The surface is a component, and the library lives inside it

The slide editor no longer imports Konva. The canvas became
`components/authored/slide-surface/`: a component that takes a `SurfaceScene`
projected from the live deck and emits moves, edits and selections back. The deck
view translates those into ops. That is the shape the spreadsheet takes too:
`sheet-surface` takes a `SheetScene` and emits intents, and it is what makes the
grid library a decision that can be revisited without touching a lens, a panel, a
procedure or the model.

| | |
| --- | --- |
| sheet-surface takes | a scene: the viewport's rows and columns with sizes and labels, each visible cell's text, alignment and paint, merges, spills, frozen counts, pins, objects, highlights, the selection, the cell being edited, zoom |
| sheet-surface emits | select, edit (enter · commit · cancel), fill, copy · cut · paste, delete, resize, move, scroll, context, pin, object, each with ids, never with A1 text |
| the view owns | projection (`sceneOf`), translation (intent → ops), signalling (selection → lens key), zoom, the title bar, the editor's own keyboard map |
| the surface never | reads the runtime, names an op, resolves a formula, decides what a lens shows, or holds a value after commit |

### What draws the grid inside the component

Four candidates were checked against the current state of each, in September 2026.
The whole comparison and the recommendation sit as the first question on
*Questions and decisions*.

| Option | For | Against |
| --- | --- | --- |
| **Build it in Svelte** (recommended at the time; *not* what was built) | The same move the slide editor made when it dropped Konva; the sheet's model is the model, so there is no second one to translate from. Merges, spills, format rules, comment pins, id-addressed cells and the in-cell editor are ours to draw exactly as the model says. Every behaviour is a named, tested procedure. | Virtualisation, selection, clipboard, fill, resize and IME are ours to get right. About the size of `slide-surface`. |
| RevoGrid (MIT) | Svelte 5 adapter, virtual scroll to a million rows, range selection, clipboard, basic autofill, pinned rows and columns, cancelable before-hooks. | Cell merging and series autofill are RevoGrid Pro; merges are in our model. Cells render through Stencil templates, not Svelte. A data-grid column model wearing a spreadsheet. |
| Univer (Apache 2) | A complete spreadsheet: canvas render, merges, frozen panes, rich text, styles, clipboard. | Its view layer is React 18. Its own model, command system, undo, selection, styles, and a formula plugin to keep out. Everything we want to be ours would be a bypass of something it already does. |
| Handsontable · Jspreadsheet CE | | Handsontable: $899 per developer per year for commercial use; free only for non-commercial work. Jspreadsheet CE: MIT, merges and frozen columns, but a DOM table with lazy loading rather than a virtualised grid. |

**The question was answered the other way.** What runs is Glide Data Grid 6.0.3
(MIT) inside a React root, wrapped by `components/authored/sheet-surface`; the
boundary is written out under the first question on *Questions and decisions*.
Everything else on these pages held exactly as promised: the scene, the intents,
the ops, the lenses and the panels are the same, and only what sits inside
`sheet-surface` changed.

### Import boundaries

`sheet.svelte` may reach `$authored-components/sheet-surface`, its own category's
`procedures/` (which may import representation), `$model/client/workspace-state`
(`view.spreadsheetRuntime(id)`) and `$capabilities/*`. It may not reach the
`spreadsheet-runtimes` register or `$representation/*` directly. Every
representation type the view needs is re-exported through `procedures/`; the
runtime is reached only as `view.spreadsheetRuntime(id)`, an accessor workspace
state does not have yet. `runtime-through-workspace-state` refuses the word
`attach(` anywhere in a view file.

## 03 · The shape of a sheet

Everything below is what the representation already declares. Nothing in it is
addressed by position: a row is an id with a sort key, a column is an id with a
sort key, and a cell names both. `C4` is a label the grid draws from two ordinals,
and it is what a person types; it is never what is stored.

```
SpreadsheetBody                                   spreadsheetSnapshots · leader · part 0
├─ rows[]          GridRow    { id "r7", order 7, height? }      dense: the Nth entry is the Nth row
├─ columns[]       GridColumn { id "c3", order 3, width? }
├─ rowPartCounts[]                                              a million rows is ~36 parts; part 0 carries the directory
├─ formatRules[]   FormatRule { from: CellRef, to: CellRef, style?: key, format?: BlockFormat }
│                                                              formatting is regional; two corners, like a merge and like a range
├─ frozenRows? · frozenColumns?
├─ print           SheetPrint { page: PageSetup, area?, repeatRows?, repeatColumns?, scale?, gridlines?, headings? }
└─ styles          StyleSet   { styles: Record<key, TextStyle>, defaultKey }

SheetCell · one row of sheetCells per populated coordinate
├─ rowId · columnId                                            CellRef, never "C4"
├─ rowOrder                                                    the row's sort key, copied here so a viewport is one range read per column
├─ value           VariableValue   empty · number · text · logic · date · list · record · table · range · function · reference
├─ expression?     "=IF(E2=0,\"\",F2*1000000/E2)"              as authored; formulaId? names the row that evaluates it
├─ marks?          Mark[]                                       styling inside one cell's text · rare
├─ format?         BlockFormat                                  this cell's own override: alignment · background · border · padding · valueFormat
├─ mergedTo?       CellRef                                      the far corner; the anchor holds it, the covered cells hold nothing
└─ spillTo?        CellRef                                      the far corner a table-valued result occupies

also read here
formulas          { representation, usedBy: FormulaUse[] }        the engine's rows; not this round
commentThreads    within: { kind: "cell", rowId, columnId }       a comment anchors to a cell, to the sheet, or to text in a cell
variables         project names a formula can read                 the Variables panel; not this sheet's
```

| What a person points at | What is stored | How it is written in a selection or an op path |
| --- | --- | --- |
| One cell, `C4` | `{ rowId: "r4", columnId: "c3" }` | `r4/c3` |
| A range, `C2:C5` | `{ from: { r2, c3 }, to: { r5, c3 } }` | `id r2/c3 · at r5/c3` |
| Several ranges | the first as the primary, the rest as `ranges` | `ranges: [{ id, at }, …]` |
| A whole row or column | the id; the extent is whatever the grid currently has | `kind row · id r6` · `kind column · id c3` |
| Text inside a cell | the cell, and offsets into its display | `r3/c1@0 · at r3/c1@6` |
| A cell's field | the cell and the field | `r4/c3/value` · `r4/c3/format/background` |
| The grid's own scalars | the body | `frozenRows` · `columns/c3/width` · `print/page/orientation` · `styles/styles/total/fontWeight` |

> **Why ids and not A1.** Inserting a row above `C4` makes it `C5`. Every formula,
> comment, merge, spill, rule, print area and selection that names the cell by id
> is untouched; the label is recomputed from the order. The old design spent three
> panels naming the "structural rebase contract" that A1 keys would need. With ids
> there is no such contract to write, except for one string, the expression text a
> person authored, which is §07.

## 04 · Every change is an op

`SpreadsheetOp` already has five targets. One more is asked for, the way the
document gained its `document` target: everything above the cells has to be
addressable, or a lens cannot freeze a pane, widen a column or change the paper.
Rows marked *asked* are proposed on *Questions and decisions*, not settled.

| Target · op | Path | Means | Written by |
| --- | --- | --- | --- |
| cell · set | `r4/c3` · `r4/c3/value` · `r4/c3/expression` · `r4/c3/format/background` · `r4/c3/mergedTo` | One field of one cell, or the whole cell when the path stops at the coordinate. A whole-cell `set` with `value: null` clears the coordinate and `was` carries what it held, so the inverse restores it. *asked: null clears* | commit · clear · paste · fill · lens fields · merge · unmerge |
| mark · set | `r3/c1/marks/m1/style` | One field of a mark inside a cell's text. | text-selection lens |
| mark · insert · remove *asked* | `r3/c1/marks` | A whole mark by id. Today only `set` names `mark`; a bold that did not exist cannot be written. | text-selection lens |
| formatRule · set · insert · remove | `formatRules` · `formatRules/f2/style` | Regional formatting: a rule over two corners carrying a style key and a format. *asked: rules carry ids* so a path names a rule rather than a position. | range lens · Styles panel · cell lens on an empty coordinate |
| gridRow · insert · remove | `rows` | Whole rows by id, after another row. A new row takes the midpoint of its neighbours' `order` and touches no cell. A remove carries the row's cells in `values`, so undo brings them back. | row lens · range lens · context menu |
| gridColumn · insert · remove | `columns` | The same for columns. | column lens · range lens · context menu |
| gridRow · gridColumn · move | `rows` · `columns` | One row or column to after another; carries `wasAfter`. The applier recomputes `order` and, for a row, rewrites `rowOrder` on that row's cells. | header drag |
| sheet · set *asked* | `frozenRows` · `frozenColumns` · `rows/r6/height` · `columns/c3/width` · `print/page/orientation` · `print/area` · `print/repeatRows` · `styles/defaultKey` · `styles/styles/total/fontWeight` | Anything above the cells. Mirrors the document's `document` target. | Grid panel · Print panel · row and column lenses · named-style lens · header edge drag |
| sheet · insert · remove *asked* | `styles` | A named style by key; `after` ignored, as in the document. | Styles panel · named-style lens |

> **Every op carries enough to be inverted without a lookup**, so `invert` in the
> runtime stays a payload swap: `was` for a set, `values` and `after` for a remove,
> `wasAfter` for a move. Coalescing folds repeated `set`s on one path into the
> earliest, keeping the last `value` and the first `was`; a sheet has no `text` op
> to argue about because a cell is set whole. Field paths are slash-separated so the
> coalescer's relatedness test needs to resolve nothing.

## 05 · The live sheet

`model/client/spreadsheet-runtimes/` exists already, copied from the deck: a
register keyed by sheet, a runtime with a buffer, an undo stack, a coalescer and a
flush that takes the accepted branch locally because nothing serves a sheet yet.
Two things change. The runtime's live copy becomes `sheet: { body, cells }` rather
than a body alone, and `apply` moves that copy *before* buffering, exactly the
change the document runtime made in its phase B.

| Member | Type | Meaning |
| --- | --- | --- |
| sheet *asked* | `LiveSheet \| undefined` | `{ body: SpreadsheetBody, cells: Record<"rowId/columnId", SheetCellFields> }`. One `$state` value replaced whole on every apply, so a scene re-projects from one consistent copy. `undefined` until the first read lands. |
| revision | `number` | What the buffered ops are stated against. |
| sync | `SyncState` | loading · saved · saving · rebasing · needs-review · offline · error. The title bar's word. |
| pending | `number` | Ops in the buffer, unsent. |
| apply(ops) | `void` | Run the applier over the live sheet, then push to undo, then buffer, then schedule. Refusal applies nothing and buffers nothing. |
| flush() | `Promise` | Coalesce the buffer into one change set and submit it. Accepted: revision advances, catch-up ops are applied to the live sheet. Stale: rebase once. Unresolved: re-read, `needs-review`. |
| undo() · redo() | `void` | The last group, inverted, applied through the same path. One gesture is one group: a commit, a paste, a fill, a row insert with its cells. |
| scrollTo *asked* | `CellRef \| undefined` | A channel a panel uses to bring a cell into view without importing the grid, as the document's `scrollTo` does for a block. |

**The applier is one function** in
`representation/data/behavior/spreadsheets/apply-ops.ts`, run by the client on the
live sheet and by `submit-spreadsheet-changes` on the server. It takes
`{ body, cells }` and ops and returns a new `{ body, cells }`. There is no second
interpretation of what an op means.

**Whole sheet first, viewport later.** The store's index is built for reading a
window of cells per visible column. This round reads every cell of a sheet on
attach and materialises rows as they are scrolled to; the window read is a later
optimisation behind the same `readSpreadsheet` door.

## 06 · What the server does with a change set

There is no `capabilities/spreadsheet/` yet. It follows the document's two
procedures exactly, with one twist at the end: after the applier has produced the
next `{ body, cells }`, the body goes to the leader snapshot and the cells go to
`sheetCells` rows, created, updated or removed for exactly the coordinates the
ops named.

1. **`readSpreadsheet`** answers the leader body at its revision and every
   `sheetCells` row of the sheet, scope-checked. Nothing, for a sheet never written
   to; the runtime then opens on an empty grid of default size.
2. **`submitSpreadsheetChanges`** validates the change set, finds the leader, and
   decides catch-up the way the document does: the ops that landed since
   `baseRevision` come back when their `touched` paths are unrelated to this set's.
   Two people in two cells are unrelated; two people in one cell are `stale`.
3. **The applier runs** over `{ leader.body, cells of the sheet }`. An op naming a
   row that is gone, a rule that is not there, or a coordinate under a spill is
   refused with `unresolved`, and nothing is written.
4. **Three writes land together:** a `spreadsheetChangeSets` row for the journal,
   the leader advanced by one revision, and each touched cell written back to
   `sheetCells`: a new row for a coordinate that came into being, an update for one
   that changed, a remove for one cleared.
5. **The resource row** takes `updatedAt` and `updatedBy`, as documents do.

> **Change sets are a journal here, never the read path.** A document rebuilds its
> body from the leader plus recent sets; a sheet's cells are the current state the
> moment they are written, so there is nothing to replay and nothing to consolidate.
> The rows still carry `touched` because catch-up reads it, and `ops` because undo
> and history read them.

## 07 · The formula boundary

Icarus's engine will be the only calculation authority, and it is not in this
round. The editor is built so that nothing in it has to change when the engine
arrives: a cell stores its `expression` as authored and its last `value`; the grid
draws the value; the lens shows both and says which state the pair is in. No grid
library's engine is involved, which is the reason the library needs none.

| Until the engine exists | The grid draws | The lens says |
| --- | --- | --- |
| A seeded formula cell with a stored value | the stored value, formatted | Expression as stored; *stored*, "not recalculated since it was written" |
| A formula typed now, with no value | the expression, in mono, muted | Expression; *waits for the engine* |
| A cell whose stored error is `#REF!` or `#NAME?` | the error, in danger tone | The error-cell lens, with the expression exactly as stored and the repair |
| A spill origin with `spillTo` and a table value | the table laid across the range; children tinted and read-only | The spill lens on a child; the origin's lens on the origin |
| Reads and feeds | outlined when a formula cell is selected | Two bands on the lens, and the Dependencies panel, from a reference scanner over expression text until the engine's parse replaces it |

**Expression text is A1 text.** A person writes `=SUM(C2:C5)`. Inserting a row
above row 3 leaves that string as authored while the cells it meant are now
`C2:C6`. Only a parser can rewrite it. The recommendation, as a question: the
engine holds references by id and renders A1 on display, so nothing is rewritten
on insert. Until then the grid leaves the text alone and the lens says so.

**Filling a formula down** means shifting its references, which is the same
parser. Until it exists, the fill handle fills values and series and refuses
formula cells with a sentence, rather than copying an expression that would then
be silently wrong.

## 08 · Four changes, traced

**Type 42 into D3, press Enter.** The in-cell editor holds "42" until Enter →
`oncommit({ r3/c4, "42", move: down })` → `cells.ts` builds one op
`{ op: "set", target: "cell", path: "r3/c4/value", value: { kind: "number", value: 42 }, was: null }`
→ `apply`: the live sheet moves, the op is buffered → the grid redraws D3 from the
live sheet, the selection lands on D4, the lens reads `r3/c4` → 2 s later, or at 50
ops, the buffer flushes: `{ resourceId, baseRevision: 12, ops, touched: ["r3/c4"] }`
crosses to the server → validate → `applyOps`, the same function → three writes,
together: `sheetCells r3/c4` created, a change set, the leader at revision 13 →
accepted, revision 13, catch-up ops applied if any → `sync: saved`; the title bar's
word changes and nothing redraws, because the sheet already showed 42.

Stale: the leader moved and someone touched `r3/c4` → rebase once, then
needs-review. Unresolved: the op names something the sheet no longer has → re-read
the leader, buffer kept. The outbound path never sends a cell; the server rebuilds
it from the op it can verify.

| Change | Surface | Ops on the runtime | What redraws |
| --- | --- | --- | --- |
| **Fill C2:C3 down to C5** | drag the handle; the dashed preview says *Series* and the values it will write | `set cell r4/c3/value` · `set cell r5/c3/value` · one undo group | the scene; C4 and C5 now hold numbers; the range lens opens on C2:C5 |
| **Insert a row above row 3** | context menu on the row header, or the row lens | `insert gridRow rows ids ["r41"] after "r2" values [{ id: "r41", order: 2.5 }]` | every label from 3 down shifts by one; no cell moves; expression text stays as authored (§07) |
| **Widen column C to 140** | drag the header edge; a guide reads the width | `set sheet columns/c3/width 140 was 118`, on release, one op | the scene's column tracks; nothing else |
| **Merge A1:B1** | range lens → Merge | `set cell r1/c1/mergedTo { r1, c2 }` · `set cell r1/c2 null` (if it held anything, after asking) | one cell drawn across two tracks; the cell lens opens on the anchor |

## 09 · The tree to build

Where each piece lives, by the tree's own laws. Marked *new* is new; everything
else exists and changes. The path is the key: a lens named
`spreadsheet-editor.range` is the file `inspector/range.svelte`.

```
app-views/categories/spreadsheet-editor/
├── spreadsheet-editor.md                 rewritten: the rail, the lenses, what each writes
├── content/sheet.svelte                  rewritten: projects the scene, translates intents, signals the lens
├── context/
│   ├── grid.svelte  (new)                the grid's shape: used range · frozen panes · sizes · names
│   ├── find.svelte  dependencies.svelte  styles.svelte  print.svelte  comments.svelte  (new)
│   └── objects · variables · templates · prompts stay placeholders, drawn by the shell
├── inspector/  (all new)
│   ├── spreadsheet.svelte  cell.svelte  cell-with-formula.svelte  error-cell.svelte  spill.svelte
│   ├── range.svelte  row.svelte  column.svelte  text-selection.svelte  named-style.svelte
│   └── chart · named-range stay placeholders until the body holds objects and names
└── procedures/  (all new)
    ├── addresses.ts      ids ↔ A1 labels · parse what a person typed
    ├── scene.ts          live sheet + viewport + selection → SheetScene
    ├── formatting.ts     resolve a cell's paint: style set → rules in order → the cell's format
    ├── cells.ts          set · clear · paste · fill as ops
    ├── structure.ts      insert · remove · move rows and columns, cells carried
    ├── merging.ts  spills.ts  fill.ts  clipboard.ts
    ├── selecting.ts      a selection → which lens, as the deck's does
    ├── references.ts     A1 refs and names scanned out of expression text; reads and feeds
    ├── find.ts  printing.ts  styles.ts  ids.ts
    └── test/unit/*.test.ts

components/authored/sheet-surface/  (new)
├── index.ts
├── sheet-surface.svelte                  viewport · headers · cells · selection · handle · editor host · pins · objects
├── sheet-surface-cell.svelte             one cell's text, runs and paint
├── sheet-surface-editor.svelte           the in-cell editor: one input, commit and cancel keys
└── sheet-surface-types.ts                SheetScene · SceneCell · SceneRange · the intent types

model/client/spreadsheet-runtimes/
├── types.ts · definition.svelte.ts       sheet: LiveSheet · scrollTo
├── methods/apply.ts                      the live sheet moves first
├── methods/attach.ts                     readSpreadsheet on open
└── methods/flush/flush.ts                submitSpreadsheetChanges · catch-up applied
model/client/workspace-state/             spreadsheetRuntime(id) accessor; start.ts hands the register in

capabilities/spreadsheet/  (new)
├── spreadsheet.md · index.remote.ts
├── api/read-spreadsheet/
├── api/submit-spreadsheet-changes/       validate · applier · three writes
├── api/shared/leader.ts
└── types/

representation/data/
├── types/spreadsheets/op.ts              sheet target · mark insert/remove · null clears · rule ids  (asked)
├── types/spreadsheets/live.ts  (new)     LiveSheet
├── behavior/spreadsheets/apply-ops.ts  (new)   the one applier · invert
├── types/workspace/views.ts              grid · templates · prompts · row · column · text-selection keys
└── behavior/workspace/opening.ts         the rail, landing on Grid

surfaces/context/procedures/rail-entries.ts      labels and icons for the new keys
app/seed/spreadsheetSnapshots.json · sheetCells.json  (new)   the outage cost model, as rows
```

## 10 · Build order

Each phase leaves the editor working. A waits on the answers to the model
questions; B depends on A; C depends on B and on the first question; D and E
depend on C and on nothing else.

| Phase | Tree | What |
| --- | --- | --- |
| A | representation | Model and applier. The op additions that are agreed. `LiveSheet`. `apply-ops.ts` with every target, and its inverse. Unit tests: every op applies and its inverse restores. Seed rows for one sheet. |
| B | runtime · capability | The round trip. `capabilities/spreadsheet`: read and submit, catch-up, three writes. The runtime reads on attach, applies before buffering, flushes for real. `view.spreadsheetRuntime(id)`. |
| C | surface | The grid. `sheet-surface` and the rewritten `sheet.svelte`: scene, selection, keyboard, in-cell editor, clipboard, fill, resize, freeze, merges, spills, pins, zoom, title bar, context menu. Every gesture an op. |
| D | lenses | What a selection opens. spreadsheet · cell · cell-with-formula · error-cell · spill · range · row · column · named-style · text-selection. Comments through `general.comment`. |
| E | panels | The rail. Grid · Find · Dependencies · Styles · Print · Comments. The rail order and landing in `opening.ts`; labels and icons in `rail-entries.ts`. Objects, Variables, Templates, Prompts stay placeholders. |
| F | later rounds | The engine and everything it unlocks: recalculation, reference shifting, fill of formulas, real reads and feeds. Names and objects in the body. Range comments. The viewport read. Template instantiation from A1 to ids. |

## 11 · Deliberately not in this round

- **No engine.** Formula cells show stored values or their expression; nothing
  recalculates. The Calculation band on the spreadsheet lens says exactly that.
- **No names and no objects** until the body holds them. The Grid panel's Names
  band and the Objects panel are drawn as what they will be, gated with the reason
  on the row.
- **No formula bar, no name box, no sheet tabs, no toolbar.** Settled by the
  design record and kept: the address is the lens's title, the expression is a
  stacked band that wraps, and a tab is one spreadsheet.
- **No comments on a range, a row or a column.** The anchor vocabulary has a cell
  and text inside one; adding a range is a model question, listed.
- **No conditional formatting, filters, sorts, data validation, hidden rows or
  columns.** None is in the model; none is implied on screen.
- **No presence on cells**, no rich text editing inside a cell beyond what the
  text-selection lens applies, no import of files, no print preview on the grid.

---

Read against main at 98d9cd0, work/document-editor at 55a7b22, and the
uncommitted work/slide-deck-editor worktree. Svelte 5, SvelteKit.
