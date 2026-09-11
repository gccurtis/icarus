# The Spreadsheet Lenses

Published at https://claude.ai/code/artifact/32cfe90f-b85d-4762-9d2b-b737e04df16b

What a selection opens on the right. There is no formula bar, so the cell's address
is the lens's title and its expression is a stacked band that wraps. A lens reads
the live sheet and the selection; every control on it states an op and applies it;
the grid redraws because the sheet changed. Nothing here asks the grid to do
anything.

| Readout | |
| --- | --- |
| Lenses | 13 |
| New keys | 3: row · column · text-selection |
| Built this round | 10, plus general.comment |
| Wait on the body | 2: chart · named range |

## 01 · Which selection opens which lens

The kind that decides is the caller's: the grid reads what is at the selected
coordinate and names the lens; the panels name theirs. The inspector resolves the
key to a file and hands the lens nothing, so each lens reads `view.selection`
itself. Two things of one kind are the same component with different ids,
re-created when the id changes so a draft never carries across.

| Selected | Lens key | Selection carried | Crumb |
| --- | --- | --- | --- |
| Nothing | `spreadsheet-editor.spreadsheet` | — | none; the top of the ancestry |
| A cell holding a value | `spreadsheet-editor.cell` | `{ kind: "cell", id: "r2/c3" }` | Spreadsheet › C2 |
| An empty coordinate | `spreadsheet-editor.cell` | `{ kind: "cell", id: "r4/c8" }` | Spreadsheet › H4 |
| A cell holding an expression | `spreadsheet-editor.cell-with-formula` | `{ kind: "cell", id: "r3/c7" }` | Spreadsheet › G3 |
| A cell whose value is an error | `spreadsheet-editor.error-cell` | `{ kind: "cell", id: "r8/c4" }` | Spreadsheet › D8 |
| A spill child | `spreadsheet-editor.spill` | `{ kind: "cell", id: "r3/c5" }` | Spreadsheet › E3 |
| A range, or several | `spreadsheet-editor.range` | `{ kind: "range", id, at, ranges? }` | Spreadsheet › C2:C5 |
| A row, or rows | `spreadsheet-editor.row` (new) | `{ kind: "row", id: "r6", ids? }` | Spreadsheet › Row 6 |
| A column, or columns | `spreadsheet-editor.column` (new) | `{ kind: "column", id: "c3", ids? }` | Spreadsheet › Column C |
| Text inside a cell | `spreadsheet-editor.text-selection` (new) | `{ kind: "text-selection", id: "r3/c2@0", at: "r3/c2@4" }` | Spreadsheet › B3 › Selection |
| A named style, from Styles | `spreadsheet-editor.named-style` | `{ kind: "named-style", id: "currency" }` | Spreadsheet › Styles › Currency |
| A comment pin, or a Comments row | `general.comment` | `{ kind: "comment", id }` | the document's |
| A chart · a named range | `spreadsheet-editor.chart` · `named-range` | placeholders | wait on objects and names in the body |

Every lens reads the live sheet through `view.spreadsheetRuntime(id)` in an
`$effect`, exactly as the document's read `view.documentRuntime`, and commits with
`runtime.apply(ops)`. Comments and replies are store rows written with `create` and
`update` from the store capability. A lens holds its own table queries and
refreshes those after a write.

## 02 · Spreadsheet

What the inspector shows when nothing is selected. Nothing selected is a state, not
a blank panel: it says what selecting something would offer, in the place the offer
would appear. The calculation band exists to close a question rather than to hold a
control.

Mock: **Spreadsheet** · *This spreadsheet*: Title (editable) "Outage cost model";
Used range `A1:G8`; Cells 46; Saved "Saved · revision 13". *Nothing selected*: "Click a
cell to see what is in it. Drag across several and this panel offers shared
formatting, a name for the range and merge. Click a heading for a row or a
column." *Calculation*: chip "Engine not built"; "Formula cells show their stored
values. Nothing recalculates yet, so nothing here can be stale and there is nothing
to refresh."

| Control | Op |
| --- | --- |
| Title | store `update spreadsheets.<id>.title`, not a sheet op |
| Everything else | read-only |

No crumb trail; a spreadsheet is the outermost thing a selection can be inside. No
template band: the document dropped it and the sheet follows.

## 03 · Cell

A cell holding a literal value: its address as the title, what it shows, what is
stored, and how it is painted. Shows and Content are two readings of one cell and
both appear; Content is the one that is editable, because there is no formula bar
and this is where a cell is written from outside the grid. Formatting is read back
through the rules that cover the cell, with the cell's own override on top.

Mock, C2: crumbs Spreadsheet › C2; head `C2` · shows `1,842,000`; chips number,
Minutes · rule C2:C6. *Content*: `1842000` (editing) — "What is stored. Shows is this
with the value format applied. Enter commits; a leading = makes it a formula."
*Format*: Style Minutes · from rule C2:C6; Alignment Start · Centre · **End**; Number
`#,##0`; FG and BG swatches — "Alignment, number and colours set here write this
cell's own format. The style is the rule's; change it in Styles." *Comments* (0),
shut. *Merge and spill*, shut.

Mock, H4 (an empty coordinate): head `H4` · empty; "Nothing here yet. There is no
cell at H4: nothing is stored, so there is no content, no format and no history.
Type on the grid, or write below." *Content*: placeholder "A value, or =formula".
*Format*: Style "Default · no rule covers H4"; alignment; "Formatting an empty
coordinate writes a 1 × 1 rule. Nothing materialises until a value does."

**Merge and spill** is shut because neither is why anyone opened the cell. On a
merge anchor it reads "Merged to D4" with Unmerge; on a plain cell, "Not merged. Not
part of a spill." A spill child never reaches this lens; it has its own.

**Comments** holds the threads anchored on this cell and a composer, as the
document's text-selection lens does. Adding one creates a `commentThreads` row with
`within: { kind: "cell", rowId, columnId }` and a first `comments` row; a pin
appears in the cell's corner.

## 04 · Cell with formula

This lens replaces the formula bar. A bar takes a row off the grid to show one line;
the expression is stacked across the whole panel and wraps. What a bar could never
carry is the two bands under it, the same cell's dependencies in both directions.
Shows and Type describe the result, not the expression, and a state chip says what
the pair is: stored, fresh, stale, computing or error, with only stored possible
until the engine exists.

Mock, G3: head `G3` · shows `41.70`; chips number, stored, Currency · rule F2:G6.
*Expression*: `=IF(E3=0,"",F3*1000000/E3)` with references tinted — "As authored.
Edited here or in the cell; Enter commits. The value stays what it was until the
engine recomputes it." *Reads* (2, open): `E3 · 194,224` spill child of E2; `F3 · 8.10`
value. *Feeds* (1), shut. *Format*, shut. *Comments* (0), shut. *Merge and spill*,
shut.

| Control | Op or route |
| --- | --- |
| Expression, on Enter | `set cell r3/c7/expression "…" was "…"` |
| Expression cleared | `set cell r3/c7 null was { … }` · the coordinate empties |
| A Reads row | `view.inspect(cell · cell-with-formula · spill · named-range, …)` |
| A broken reference | stated in danger tone, not a target |
| Format | as the cell lens |

The expression is set as plain mono with the references tinted by the scanner. Real
syntax colouring waits on the engine's tokeniser; until then the tint is the
scanner's word.

## 05 · Error cell

An error is a repair job, not a failure to report, so the lens is built around
fixing it. The fault heads the panel as a danger chip, the explanation is in words,
the formula is shown exactly as stored with the broken token marked, and the repair
is last. Clear is behind a rule, because a cleared coordinate holds nothing to
inspect.

Mock, D8: head `D8` · `#REF!`; chip "Broken reference"; "This formula refers to a
range that no longer exists." *Expression*: `=SUM(#REF!)` with the token marked —
"Exactly as stored, broken token included. A repaired guess would be worse than the
fault." *Repair*: Pick a new range (primary) · Edit the expression — "Pick puts the
grid into a picking state: the range you drag replaces #REF! in the formula. With
two broken references the control goes dark and says why." Then, behind a rule:
Clear cell — "Empties D8 and routes to the spreadsheet lens."

Mock, F8: head `F8` · `#NAME?`; chip "Unknown name"; "No name in this spreadsheet or
this project is called eventCount." *Expression*: `=F6/eventCount`. *Repair*: Edit
the expression (primary) · Open Variables — "Define eventCount as a project
variable, or name a cell instead." Clear cell behind a rule.

Until the engine exists an error is whatever the stored value says it is: the seed
carries `#REF!` and `#NAME?` as text values in danger tone, and the explanations are
the scanner's. The engine will replace both the detection and the words; the lens
does not change shape.

## 06 · Spill

A cell filled by a formula somewhere else. The lens exists to explain a difference,
not to report a state: a spill child looks exactly like a cell with a number in it,
and the first time somebody types into one is the moment that has to be explained.
Origin, occupied range and status at the top; the origin's formula next, one click
closer than it needs to be; then the rule in prose.

Mock, E3: head `E3` · `194,224`; chips Spill child, read-only; Origin `E2` (link);
Occupies `E2:E5`; Row of the table 2 of 4. *Origin's formula*:
`=avoidedMinutes(costModel)`. *Behaviour*: "A write anywhere in E2:E5 is refused and
names E2. The spill does not stop spilling to make room. Change the origin to
change this cell."

| Control | Route |
| --- | --- |
| Origin | `view.inspect("spreadsheet-editor.cell-with-formula", { kind: "cell", id: "r2/c5" })` |
| On the origin itself | the address is plain text; the origin opens its own lens, whose Merge and spill band reads "Spills to E5" |

Occupancy is derived from every origin's `spillTo`. The engine has no
write-collision rule yet; refusing visibly is written down before it is
implemented, because a silent failure is the easiest thing to build by accident.

## 07 · Range

Several cells together: what the block contains, where it agrees, what it sums to,
and what can be done to it at once. Mixed is a value, not a blank; setting over it
applies to every cell in the range, and every control writes a rule over the range,
so an empty range has somewhere to be formatted. Actions are the structural ones a
selection implies; Clear is last, behind a rule, and asks first.

Mock, C2:C5: stats 4 coordinates · 4 with content · 1 rule; "Plus 1 more range,
E2:E5. Every control below applies to both." *Shared formatting*: Style Mixed;
Alignment Start · Centre · **End**; Number Mixed; BG swatches, Mixed — "Setting a
control writes one rule over each range. Mixed means the cells disagree; typing
over it sets all of them." *Aggregate*, shut. *Actions*: Name this range (disabled:
names need a field on the body) · Merge · Insert 4 rows above · Insert 1 column
left — "Merge needs one rectangle; with two ranges it goes dark and says so. Merge
over cells with content asks first: '3 cells will be cleared; C2 keeps its value.'"
Behind a rule: Clear 8 cells — "Asks first. Values go; rules stay."

| Control | Op |
| --- | --- |
| Style · alignment · number · colours | `insert formatRule` over each range, or `set formatRule` on a rule that already covers exactly it |
| Merge | `set cell r2/c3/mergedTo { r5, c3 }` · `set cell … null` for covered cells with content, after asking |
| Insert rows above · columns left | `insert gridRow rows ids [4 new] after "r1" values [{ id, order }] …` |
| Clear | `set cell r/c null` for each populated coordinate, one group; spill children skipped with a message |
| Aggregate | Sum · Average · Min · Max · Count over the numbers; the status bar carries the same, which is question 19 |

## 08 · Row and column

The old design refused a row lens because rows were not identified objects. They
are now: a `GridRow` is an id with an order and a height. So a heading click opens
a lens with the things a row or a column actually has, and the structural commands
land where the thing they act on is already selected. Moving is a drag on the
heading and is not repeated here.

Mock, Row 6: Cells 7; Height 24 px; Rules Total · A6:H6. *Actions*: Insert 1 above ·
Insert 1 below · Remove row; Freeze up to here (toggle) — "Remove carries the row's
7 cells with it, so undo brings them back. Freezing sets the body's frozen rows to
6."

Mock, Column C: Cells 6; Width 118 px; Rules Header · Minutes · Total; Fit to
content. *Actions*: Insert 1 left · Insert 1 right · Remove column; Freeze up to
here.

| Control | Op |
| --- | --- |
| Height · width | `set sheet rows/r6/height` · `columns/c3/width` (asked) |
| Fit to content | the same, with the longest display measured by the surface |
| Insert | `insert gridRow` · `insert gridColumn` |
| Remove | `remove gridRow`, values carrying the row and its cells |
| Freeze up to here | `set sheet frozenRows 6` · `frozenColumns 3` |

With several rows selected the lens reads "Rows 2 to 5", height shows Mixed where
they differ, and Insert and Remove act on all of them.

## 09 · Named style

One named cell style, edited once for every cell wearing it. The identity fields
are the edit: a style is not a description of cells that already look this way, and
the usage band carries the count and repeats it in prose beside the sentence that
every field applies to all of them. A sheet style is typography; a value format and
a border belong to the rule that carries the style, which is why they are not here.

Mock, Currency: crumbs Spreadsheet › Styles › Currency; actions Duplicate · Make
default · Delete. *Identity*: Name "Currency"; Key `currency`. *Typography*: Font IBM
Plex Sans; Size 12 px; Weight **400** · 500 · 600; Marks Italic · Underline;
Alignment Start · Centre · **End**; FG and BG swatches. *Usage* (10 cells), shut —
"Through 1 rule, F2:G6. Every field above changes all ten."

| Control | Op |
| --- | --- |
| Any field | `set sheet styles/styles/currency/<field>` (asked) |
| Make default | `set sheet styles/defaultKey "currency"` |
| Duplicate | `insert sheet styles ids ["currency-2"] values [{ …copy }]` |
| Delete | `remove sheet styles ids ["currency"]`; refused for the default and for a style a rule still names |

Key is shown and not edited: a rule names a style by key, so renaming is safe and
re-keying is not. Whether a key is authored or derived from the name is the same
open point the presentation's named style records.

## 10 · Text selection, inside a cell

A cell's text can carry marks: a bold word, a link, a colour. Selecting characters
inside the in-cell editor opens the same lens the document and the presentation have for a
text range, cut down to what a cell's text can hold. Cell-wide formatting is the
cell lens's and is not repeated here.

Mock: crumbs Spreadsheet › B3 › Selection; quote "Ward" · 4 characters · B3. *Marks*:
**Bold** · Italic · Underline · Strike · Code; FG swatches. *Link* (0): URL field,
Add link.

| Control | Op |
| --- | --- |
| A mark toggled on | `insert mark r3/c2/marks ids ["m1"] values [{ id, from: 0, to: 4, style: ["bold"] }]` (asked) |
| A mark toggled off | `remove mark …` · or `set mark r3/c2/marks/m1/style` with the style taken out |
| Link · colour | `set mark r3/c2/marks/m1/link` · `/color` |

Marks are offsets into one cell's display, which is the arithmetic marks already
use in a document block. A cell has no atoms, so there is nothing to shift them
past.

## 11 · Comment thread

`general.comment`, the document's, unchanged: the anchor as a quote with who and
when, Reply and Resolve above the thread, Show in sheet, the thread as quotes, a
composer. The only spreadsheet-specific part is the anchor quote: the cell's
address and what it shows.

Mock: crumbs Spreadsheet › C3 › Thread; actions Reply · Resolve · Show in sheet;
anchor quote "C3 · 318,400" · Priya Natarajan · 2 h ago; *Thread* (2): "Is the 318,400
figure before or after the December restoration?" Priya Natarajan · 2 h ago; "Reads
correct against the outage log." Tom Adeyemi · 1 h ago; a Reply field.

## 12 · Every control on every lens, and where it lands

| Lens | Controls | Ops on the runtime | Store rows |
| --- | --- | --- | --- |
| spreadsheet | Title | — | `spreadsheets.<id>.title` |
| cell | Content · alignment · number · FG · BG · Unmerge · Add comment | `set cell …/value \| expression \| format/* \| mergedTo` | `commentThreads` · `comments` |
| cell-with-formula | Expression · format · comments | `set cell …/expression` · `format/*` | `commentThreads` · `comments` |
| error-cell | Pick a new range · Edit the expression · Clear | `set cell …/expression` · `set cell … null` | — |
| spill | Origin | — | — |
| range | Shared formatting · Merge · Insert · Clear | `insert / set formatRule` · `set cell mergedTo` · `insert gridRow / gridColumn` · `set cell null` | — |
| row · column | Height · width · Fit · Insert · Remove · Freeze | `set sheet rows/*/height · columns/*/width · frozenRows · frozenColumns` · `insert / remove gridRow / gridColumn` | — |
| named-style | Every field · Make default · Duplicate · Delete | `set / insert / remove sheet styles/*` | — |
| text-selection | Marks · link · colour | `insert / set / remove mark …/marks/*` | — |
| general.comment | Reply · Resolve · Reopen | — | `comments` · `commentThreads.resolution` |

Three op shapes in this table do not exist yet and are asked for on the last page:
the `sheet` target, `insert` and `remove` on `mark`, and a whole-cell `set` to
`null` as the way a coordinate empties. Nothing else a lens writes needs the model
to move.

---

Every lens reads `view.selection` and the live sheet; the inspector hands it
nothing. Keys added: `spreadsheet-editor.row` · `column` · `text-selection`.
