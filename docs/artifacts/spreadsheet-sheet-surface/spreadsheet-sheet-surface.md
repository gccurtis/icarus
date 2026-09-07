# The Sheet Surface

Published at https://claude.ai/code/artifact/5264fb38-f90e-4c77-bed3-b5f8a0b2aa93

The grid, edge to edge, and everything that can happen on it. No formula bar, no
name box, no sheet tabs, no toolbar: what a cell holds is read in the inspector,
and every gesture here is one op on the live sheet. Every state below is drawn from
one example, the outage cost model the current stub already carries (columns
Substation, Feeder, Customer-minutes lost, Storm events, Avoided minutes, Hardening
spend ($M), Cost per avoided minute; four feeders, a Total row, and a scratch row
with two broken formulas).

Colour roles on the page: selection blue; spill violet; error red; reads blue
outline; feeds orange outline; comment pin amber; find hit and one-off fill amber
tint.

| Readout | |
| --- | --- |
| States drawn | 22 |
| Intents the surface emits | 19 |
| Gestures that are ops | all but typing |
| Rows off the grid | 0: no bar, no tabs |

## 01 · The editor in its frame

The same six zones every category renders into. The grid fills the centre under a
one-line title bar carrying the sheet's name and the sync word; the rail on the
left opens on *Grid*; the inspector on the right shows whatever the selection is.
The status bar reads the selection back as an address and its aggregates.

The frame mock shows: top bar (Icarus · Winter storm programme · helios); tabs
(Overview, Agents, Templates, Winter readiness brief, **Outage cost model**); the
rail with Grid selected; the Grid panel (used range A1:G8, 46 cells, 2 problems;
frozen 1 row, 0 columns; Names: not in the model yet); the grid with row 1 frozen,
E2:E5 a spill, a pin on C3, C2 selected; the cell lens on C2 (Shows 1,842,000, type
number, Content 1842000, Style Minutes · rule C2:C6, align end, number `#,##0`);
the status bar `C2 · Millbrook · Customer-minutes lost · Saved · 100%`.

## 02 · What the grid draws with nothing selected

Headings are labels a person reads and targets a person clicks: a column heading
selects the column, its edge resizes it, and it can be dragged. A formula cell
looks like any other cell; a spill child is tinted; an error is set in danger tone;
a comment is a corner mark. An empty coordinate is drawn and is nothing until
something is typed into it.

- **A · Headings.** Labels derived from order; click selects, edge drags resize,
  body drags move. The corner selects everything.
- **B · Frozen edge.** `frozenRows: 1` draws a heavier rule; row 1 stays while the
  rest scrolls. Set from the Grid panel or a row's lens.
- **C · A formula cell** draws its value and nothing else. The lens tells you it is
  a formula; Find has a formulas layer; selecting it outlines its reads.
- **D · A spill.** E2 holds `=avoidedMinutes(costModel)` and `spillTo: E5`; E3 to E5
  are its children, tinted, read-only.
- **E · Errors** in danger tone, mono. D8 is `#REF!`, F8 is `#NAME?`. Selecting one
  opens the error-cell lens, which is a repair.
- **F · A comment pin** in the cell's corner, amber at rest, count on hover. It is
  the only mark on the grid that is not in the sheet.
- **G · An empty coordinate** has no row in `sheetCells`. Hover says so ("H4 ·
  nothing here yet · type to make a cell"); typing makes a cell with one `set`.
- **H · The title bar** is the document editor's: name, and the runtime's sync
  word. Zoom is per tab, ⌘-wheel, 50 to 200, read in the status bar.

## 03 · Six shapes a selection takes, and what each opens

A selection is ids, never text. One cell opens the lens for what that cell *is*; a
range opens the range lens; a whole row or column opens its own lens now that rows
and columns are identified in the body. Ctrl-drag adds a range, as it does in the
document. Every range carries a fill handle at its corner.

- **One cell.** Click, or arrive by keyboard. Opens `cell`, `cell-with-formula`,
  `error-cell` or `spill` by what is there.
- **A range.** Drag, or Shift-click, or Shift-arrows. Opens `range`: shared
  formatting, aggregate, actions.
- **Several ranges.** Ctrl-drag adds one; the first stays primary, the rest are
  dashed. The range lens applies every control to all of them.
- **A column.** Click its heading. Opens `column`: width, insert, remove, freeze up
  to here. Shift-click extends across columns.
- **A row.** Click its number. Opens `row`. Rows and columns are the only
  selections whose extent is "whatever the grid currently has".
- **Everything.** The corner, or Ctrl+A twice. Opens `range` over the used range;
  clearing asks first.

| Selection | Written as | Lens key | Status bar |
| --- | --- | --- | --- |
| One cell | `{ kind: "cell", id: "r3/c3" }` | by content · cell · cell-with-formula · error-cell · spill | `C3 · 318,400` |
| A range | `{ kind: "range", id: "r2/c3", at: "r5/c3" }` | spreadsheet-editor.range | `C2:C5 · 4 cells · Sum 2,605,270 · Avg 651,318` |
| Several ranges | `{ kind: "range", id, at, ranges: [{ id, at }] }` | spreadsheet-editor.range | `C2:C5 +1 · 8 cells · Sum …` |
| A column · columns | `{ kind: "column", id: "c3", ids?: [...] }` | spreadsheet-editor.column (new key) | `C · 6 cells · width 118` |
| A row · rows | `{ kind: "row", id: "r6", ids?: [...] }` | spreadsheet-editor.row (new key) | `6 · 7 cells · height 24` |
| Everything | `{ kind: "range", id: "r1/c1", at: "r8/c7" }` | spreadsheet-editor.range | `A1:G8 · 46 cells` |
| Nothing | `view.clear()` | spreadsheet-editor.spreadsheet | `Outage cost model · A1:G8` |

## 04 · Editing, in the cell

There is no formula bar, so the in-cell editor is load-bearing. Typing on a selected
cell starts an edit with that character; F2 or a double-click opens the stored
content for editing; Enter commits and moves down; Tab commits and moves right;
Escape cancels and the cell shows what it showed before. A formula edits as its
expression in mono, and the references it names are outlined while the editor is
open. The same text is editable in the lens, which is the place a long expression
has room.

**A value into an empty coordinate.** Nothing exists until Enter: then one
`set cell r3/c8 { value: { kind: "number", value: 42 } }`, and the selection lands
on H4. What was typed is parsed once, in the view: a number, TRUE or FALSE, a
leading `=`, otherwise text.

**A formula, opened with F2.** The editor shows the expression as stored, grows
past the cell to the right, and outlines E3 and F3 because the reference scanner
found them. Committing writes `set cell r3/c7/expression`; the value stays what it
was until the engine recomputes it, and the lens says so.

| Key, while editing | Does | Op |
| --- | --- | --- |
| Enter | Commit, move down one row | set cell … · then select |
| Shift+Enter | Commit, move up | set cell … |
| Tab · Shift+Tab | Commit, move right or left | set cell … |
| Escape | Cancel; the cell shows what it showed | none |
| Alt+Enter | A new line inside the cell's text | part of the committed text |
| Click another cell | Commit, then select the clicked cell | set cell … |
| Commit with no change | Nothing is written | none |
| Commit into a spill child | Refused; the cell flashes and a message names the origin | none |
| Commit an empty string on a cell | Clears the coordinate | set cell r/c null · was: the cell |

**IME and paste inside the editor** are the editor's business: a composition is
never committed mid-way, and paste into an open editor is text into the field.
Paste onto a *selection* is a grid gesture and is §06. The editor is a single input;
marks inside a cell's text are applied from the text-selection lens after commit,
not typed.

## 05 · The fill handle

Drag the corner of a selection and the preview says what it will write before it
writes it. Two numbers make a series; one value repeats; text with a trailing
number counts; a formula is refused until the engine can shift its references. The
whole fill is one `set` per coordinate and one undo group.

- **Series.** D2:D3 hold 2 and 3; dragging to D5 previews "Series · 4 · 5". Release
  writes `set cell r4/c4/value` and `r5/c4/value`. A single value would repeat
  instead.
- **A formula, refused.** The handle still drags, the preview says "Formulas do not
  fill yet" and the message reads "Not filled. Shifting the references in
  `=IF(E2=0,"",F2*1000000/E2)` needs the engine's parser." Release writes nothing.
  The alternative, copying the expression verbatim, would be silently wrong.

## 06 · Copy, cut and paste

Copy writes the selection as tab-separated text, values as displayed and
expressions as authored, so the sheet pastes into anything. Paste onto a selection
anchors the block at the top-left cell and grows the grid if it has to; every
pasted cell is parsed the way a typed one is. Cut is a paste followed by a clear of
the source, in one undo group.

**A 2 × 2 block pasted at A10.** The source (A2:B3) keeps its dashed marker until
the next gesture. Twelve rows are drawn because the paste needed them: the grid
materialises rows as it draws them, so a paste past the last row is an
`insert gridRow` for each new one, then the sets. "Pasted 2 × 2 at A10 · rows 10 to
12 materialised · one undo group."

| Gesture | Clipboard holds | Ops |
| --- | --- | --- |
| Ctrl+C on a range | TSV: display text per cell, expression for a formula cell, empty for an empty coordinate | none |
| Ctrl+V on a cell | parsed back into cells; a single value pastes into every selected cell | set cell … per coordinate · insert gridRow / gridColumn if it runs past the edge |
| Ctrl+X then Ctrl+V | the same TSV | set cell … at the target · set cell … null at the source · one group |
| Delete · Backspace on a selection | — | set cell r/c null for every populated coordinate in the selection; spill children skipped with a message |
| Paste over a merge or a spill | — | refused with the reason; nothing partial is written |

## 07 · Rows and columns

Resize by dragging a heading's edge; the guide reads the size and one op is written
on release. Insert and remove from the heading's context menu or the row and column
lenses. Move by dragging a heading; the ghost follows and a drop line says where.
Freezing is a count in the body, set from the Grid panel or "Freeze up to here" on
a heading.

- **Resizing column C.** The guide tracks the pointer ("140 px · was 118"); the
  width is applied to the scene as a draft while dragging and becomes
  `set sheet columns/c3/width 140 was 118` on release. Double-clicking the edge
  fits the column to its longest display.
- **The heading's context menu** on row 3: Cut, Copy, Paste; Row 3: Insert 1 row
  above, Insert 1 row below, Remove row 3, Height…; Freeze up to row 3; Comment on
  A3. The same items the row lens carries, where the pointer already is. Insert
  takes the midpoint order; remove carries the row's cells so undo restores them.
- **Moving column F before C.** The ghost is the column; the drop line is where it
  lands. One `move gridColumn` with `after` and `wasAfter`; no cell is touched.
- **One frozen row and two frozen columns.** The heavier rules are the only
  affordance the grid itself gives; the Grid panel says "1 row, 2 columns" in words
  and lets you change it, and a row's or column's lens offers "Freeze up to here".

## 08 · Merges

A merge is `mergedTo` on the anchor cell, the far corner. The covered coordinates
hold nothing and are not drawn; the anchor is drawn across the whole span, selects
as one, edits as one, and its lens shows the span under Merge and spill. Merge is
offered on a rectangular range; when more than one cell in it has content the lens
asks first and says how many it will clear.

**A1:B1 merged** into one heading ("Location"). Inserting a row or a column inside a
merge extends it, because the corners have not moved. Unmerge sets `mergedTo` to
null and leaves the anchor's content where it is.

## 09 · Spills

A formula that returns a table occupies cells it did not start in. The origin
carries `spillTo`; the children are the coordinates between, drawn from the
origin's value, tinted, and read-only. A write into one is refused visibly and
names the origin, rather than being accepted and quietly breaking the spill.

**Typing into E3.** The editor does not open. The message reads "E3 is filled by E2.
`=avoidedMinutes(costModel)` spills to E5. Edit E2 to change it." The spill lens,
which opened when E3 was selected, says the same thing with the origin as a link.

## 10 · Formula cells, dependencies and errors

Selecting a formula cell outlines what it reads and what reads it, so the chain
can be followed on the grid while the lens lists the same two sets as rows. An
error cell is set in danger tone and opens a lens built around the repair. Until
the engine exists both sets come from a scanner over the expression text; the
engine's parse replaces the scanner without changing what is drawn.

- **A · Reads**, blue: E3 and F3, the references in `=IF(E3=0,"",F3*1000000/E3)`.
- **B · Feeds**, orange: G6, whose `=AVERAGE(G2:G5)` covers G3. Found by scanning
  every other expression.
- **C · The status bar** carries the expression in one line; the lens carries it
  wrapped, with Reads open and Feeds shut.

**Two errors on the scratch row.** D8's `=SUM(#REF!)` names a range that is gone;
F8's `=F6/eventCount` names a variable nobody defined. Hovering says what the token
means ("#REF! · a range that no longer exists"); selecting opens the repair. Nothing
on the grid pretends to fix either.

## 11 · How a cell is painted

Formatting is regional. A cell's paint is the style set's default, then every
format rule whose corners contain it in order, then the cell's own `format` laid on
top. A named style is a key a rule carries; a value format lives on a rule's or a
cell's format; a one-off fill on one cell is the cell's. So formatting an empty
range has somewhere to go: a rule, and nothing materialises.

- **A · Rule A1:H1** · style `header`: weight 600, centred. Bold headings without a
  cell of them knowing.
- **B · Rule C2:C6** · style `minutes`, format `valueFormat "#,##0"`, aligned end.
- **C · Rule F2:G6** · style `currency`, `"#,##0.00"`.
- **D · Rule A6:H6** · style `total`, format border top. The row reads as a total
  because the rule says so.
- **E · C3's own format** · `background`. The one-off override, on the cell, over
  every rule beneath it.
- **F · Marks in B3's text.** "Ward 3" holds a bold mark; marks style characters
  inside one cell and are the text-selection lens's.

| What a person does | Where it is written | Op |
| --- | --- | --- |
| Applies a style to a range | a new rule over the range's corners | `insert formatRule formatRules ids ["f9"] values [{ from, to, style: "currency" }]` |
| Sets a value format on a range | the same rule's `format.valueFormat` | `set formatRule formatRules/f9/format/valueFormat` |
| Fills one populated cell | the cell's own format | `set cell r3/c3/format/background` |
| Fills one empty coordinate | a 1 × 1 rule; nothing is materialised | `insert formatRule …` |
| Bolds a word inside a cell | a mark on the cell | `insert mark r3/c2/marks …` (asked) |
| Edits the Currency style | the style set | `set sheet styles/styles/currency/fontWeight` (asked) |

## 12 · Comment pins

A comment anchors to a cell. The grid has no gutter, so the pin is a corner mark on
the cell itself: amber at rest, the client colour when its thread is open in the
inspector, grey and dashed when the cell it was on is gone. Clicking a pin opens
`general.comment`; several threads on one cell show a count and cycle. The Comments
panel lists them by address.

**Three states.** C3 has two open threads and the pointer is on it ("2 threads ·
click to open"); D2's thread is the one open in the inspector; A8 lost its cell when
the scratch row was cleared. Resolved threads draw nothing and sit under Resolved in
the panel.

## 13 · Floating objects

A chart floats over the grid anchored to a cell with an offset, moves when rows
are inserted above it, and is selected by clicking it. The body has no field for
objects today, so this is drawn as what it will be and gated with the reason: the
model question is on the last page. Until it is answered the Objects panel is a
placeholder and no chart can be made.

**A column chart anchored at E8.** "Customer-minutes by substation · not in the
model · A1:C5 · anchor E8 +6,+4". Anchor plus offset in pixels, a size, a kind, a
source range by ids, a title, and an id of its own, so it can be selected, updated,
reconciled and commented on. The old design's charts had no id, which is why they
were read-only.

## 14 · Find hits on the grid

The Find panel searches values, formulas or both. Hits are tinted on the grid; the
current hit is selected and its lens opens; moving to the next hit scrolls it into
view through the runtime's `scrollTo`. There is no replace this round.

**"F-1" in values.** Two hits, B2 and B5; B2 is current. The tint is the same amber
the one-off fill uses because both mean "look here", and neither is in the sheet.

## 15 · The keyboard, with a selection and nothing being edited

| Key | Does | Writes |
| --- | --- | --- |
| ← → ↑ ↓ | Move the selection one cell | selection only |
| Shift+arrows | Extend the range | selection only |
| Ctrl+arrows | Jump to the edge of the populated block | selection only |
| Tab · Enter | Move right · move down | selection only |
| Home · Ctrl+Home | First column of the row · A1 | selection only |
| Page ↑ Page ↓ | A viewport of rows | selection only |
| Shift+Space · Ctrl+Space | Select the row · the column | selection only |
| Ctrl+A | The populated block; again, everything | selection only |
| Any character | Start editing with it | on commit: set cell |
| F2 · double-click | Edit the stored content | on commit: set cell |
| Delete · Backspace | Clear the selection's cells | set cell … null |
| Ctrl+C X V | Clipboard, §06 | set cell … |
| Ctrl+Z · Shift+Ctrl+Z | Undo · redo through the runtime | the inverse group |
| Ctrl+B I U | Not bound on the grid. Marks are inside a cell's text and belong to the text-selection lens. | — |
| Escape | Drop to one range, then clear the selection | selection only |

## 16 · What the surface takes, and what it gives back

`sheet-surface` is a component in `components/authored/`: it knows only its props,
imports no model, and would draw the same on a demo page with made-up data. The
view projects a scene from the live sheet and the viewport, hands it down, and
turns every callback into ops.

```
SheetScene
├─ columns: SceneTrack[]     { id, label "C", size, frozen }          the visible window plus one on each side
├─ rows: SceneTrack[]        { id, label "4", size, frozen }
├─ cells: SceneCell[]        { rowId, columnId, text, runs?: SceneRun[], align, valign, weight, italic, color, background, border, mono, tone }
│                              tone: plain · formula · error · spill · spill-origin   paint already resolved: style set → rules → cell format
├─ merges: SceneSpan[]       { from: CellRef, to: CellRef }
├─ spills: SceneSpan[]
├─ highlights                { reads: SceneSpan[], feeds: SceneSpan[], hits: SceneSpan[], current?: CellRef }
├─ pins: ScenePin[]          { rowId, columnId, count, state: open · current · detached }
├─ objects: SceneObject[]    later: { id, anchor, dx, dy, width, height, kind, title }
├─ selection                 { ranges: SceneSpan[], rows: string[], columns: string[], all: boolean }
├─ editing?                  { rowId, columnId, seed: string }         what the editor opens with; the surface owns the text until commit
└─ zoom                      per cent
```

| Callback | Carries | The view turns it into |
| --- | --- | --- |
| `onselect(ranges, additive)` | ids of corners | `view.inspect(lens for what is there, selection)` |
| `onselectrows(ids, additive)` · `onselectcolumns(ids, additive)` · `onselectall()` | ids | `view.inspect("spreadsheet-editor.row" \| ".column" \| ".range", …)` |
| `onclear()` | — | `view.clear()` |
| `onenter(cell, how: typed · open, seed)` | the cell and the first character, or nothing | `scene.editing = { cell, seed: expression ?? display }`; refused on a spill child |
| `oncommit(cell, text, move)` | the typed text and where to go | `cells.ts`: parse → `set cell …`; then select the next cell |
| `oncancel()` | — | `scene.editing = undefined` |
| `oncaret(cell, from, to)` | offsets into the cell's text while editing | `view.inspect("spreadsheet-editor.text-selection", …)` when from ≠ to |
| `onfill(source, target)` | two spans | `fill.ts`: series or copy → `set cell …` per coordinate; refused for formulas |
| `oncopy(ranges)` · `oncut(ranges)` · `onpaste(anchor, text)` | ids, raw clipboard text | `clipboard.ts`: TSV out; parse in → `set cell …` · `insert gridRow / gridColumn` past the edge |
| `ondelete(ranges)` | ids | `set cell … null` per populated coordinate |
| `onresizecolumn(id, size, final)` · `onresizerow(id, size, final)` | the id and the size under the pointer | a draft on the scene while dragging; `set sheet columns/<id>/width` on release |
| `onmovecolumn(id, after)` · `onmoverow(id, after)` | ids | `move gridColumn` · `move gridRow` |
| `onscroll(window)` | the first and last visible row and column indexes | re-project the scene; `insert gridRow` to materialise rows scrolled into |
| `oncontext(hit, point)` | a cell, a row, a column or the corner | the context menu, whose items are the same procedures the lenses call |
| `onpin(threadIds)` · `onobject(id)` | ids | `view.inspect("general.comment", …)` · `view.inspect("spreadsheet-editor.chart", …)` |
| `onzoom(delta)` | a wheel delta with the modifier held | `view.setZoom(clamped)` |

**What re-projects.** A change to the live sheet from anywhere, the grid included,
re-runs `sceneOf` over the visible window and the surface redraws only the cells
whose scene entry changed. The selection is ids, so a row inserted above it moves
nothing that matters. An open editor survives a re-projection unless its
coordinate was removed, in which case it cancels and says so.

---

Every mock is drawn from one example: the outage cost model in the current
`sheet.svelte`. The ids shown are illustrative; real ones are minted.
