# The Spreadsheet Rail

Published at https://claude.ai/code/artifact/e23e685f-0fce-4e52-9816-6600d8fb8ae9

The map: where am I in this sheet, and what else is here. Ten entries, in the order
a person reaches for them, landing on the grid's own shape. Six are built this
round and every control on them is an op on the live sheet; four stay placeholders
with their reasons on the row, as the document and the presentation already do.

| Readout | |
| --- | --- |
| Rail entries | 10 |
| Built this round | 6 |
| Leave the rail | 4: overview · insert · context · named ranges |
| New keys | 3: grid · templates · prompts |

## 01 · Ten entries, landing on Grid

The document lands on Sections and the presentation on Slides because each has a structure
the centre cannot show at once. A sheet shows itself, so its first entry is the
grid's own shape: what is used, what is frozen, what is named, what is broken. The
rest follows the conventions the other two editors settled: Find, then the sheet's
own vocabularies, then Comments, then the three shared placeholders at the end.

| # | Entry | Why |
| --- | --- | --- |
| 1 · lands | Grid (new key) | The grid's shape: used range, cells, problems, frozen panes, default sizes, and the names band once the body holds names. |
| 2 | Find | Values, formulas or both; every hit leads with its address and says which layer it came from. |
| 3 | Dependencies | What the selected cell reads and feeds, and what is broken anywhere. Every row moves the panel. |
| 4 | Styles | The named cell styles; Apply writes a rule over the selection; New style opens the lens. |
| 5 | Print | Paper, orientation, margins, area, repeats, scale, gridlines and headings. A grid has no natural page. |
| 6 | Objects | Charts and overlays over the grid. A placeholder until objects have a field in the body. |
| 7 | Comments | Open threads leading with the address they anchor to; Resolved as a second band, shut. |
| 8 | Variables | The project's name manager, as in the document and the presentation. Placeholder, as agreed there. |
| 9 | Templates (new key) | Placeholder, matching the other two editors' rails. |
| 10 | Prompts (new key) | Placeholder, matching the other two editors' rails. |

| Leaves the rail | Why | Where its job went |
| --- | --- | --- |
| `spreadsheet-editor.overview` | The document dropped Overview: the title bar carries the name and the sync word. | the title bar; the spreadsheet lens when nothing is selected; the Grid panel for the used range and cell count |
| `spreadsheet-editor.insert` | Content is typed; structure acts on a selection; a chart needs objects in the body. Nothing was left for a panel to insert. | the row, column and range lenses and the heading's context menu; the Objects panel's New chart, gated |
| `spreadsheet-editor.context` | A grid has no prompt blocks to use a scope, which the design record itself called premature. The document dropped it too. | nowhere, this round |
| `spreadsheet-editor.named-ranges` | Names are not in the body yet, and when they are they are a band of the grid's shape rather than a panel of their own. | the Grid panel's Names band; the named-range lens |

The keys that leave the rail stay in the vocabulary, as the document's did: a key
with no rail entry is designed and not offered, and the placeholder the shell draws
for a key with no file is how an unbuilt view is proved to route. Whether the order
and the landing are right is question 4.

## 02 · Grid

The sheet's own shape, and the one place frozen panes explain themselves. Three
bands open, one shut. Everything editable here is a `sheet` op on the body; nothing
here touches a cell.

Mock: **Grid** · *This grid*: Used range `A1:G8`; Cells 46; Rows · columns 36 · 12
drawn; Problems 2 ("Problems are broken formulas; the Dependencies panel lists them
and each opens its repair."). *Frozen*: Rows [1]; Columns [0] ("The heavier rule on
the grid is the frozen edge. Rows above it stay while the rest scrolls. A row's or
column's lens offers 'Freeze up to here' too."). *Sizes*: Row height 24 px; Column
width 112 px ("Defaults, applied where a row or column has no size of its own. A
row or a column that differs carries its size on its lens."). *Names* (shut, "not
yet"): Name this range, disabled; "Named ranges are not in the body. The band is
where they will list, with the range each covers and how many formulas use it;
'unused' is a word, not a zero."

| Control | Op |
| --- | --- |
| Frozen rows · columns | `set sheet frozenRows · frozenColumns` (asked) |
| Default sizes | nowhere today; question 22 |
| Name this range | gated on names in the body; question 10 |
| Problems | routes to `spreadsheet-editor.error-cell` |

Routes to `spreadsheet-editor.error-cell` from Problems and, later, to
`spreadsheet-editor.named-range` from Names. Nothing else here opens a lens.

## 03 · Find

A grid holds two layers of text, the formulas that are stored and the values they
show, and searching both at once is usually the wrong answer. So the layer is a
chip, the field contains its hits, every hit leads with its address and says which
layer it came out of. Selecting a hit selects the cell, brings it into view and
opens the lens for what it is. No replace this round.

Mock: **Find** · chips Everything · **Values** · Formulas; Match case off; search
field "F-1" with "2 of 46 cells"; hits `B2 · F-12` (value · Feeder · row 2, current)
and `B5 · F-19` (value · Feeder · row 5); "Hits are tinted on the grid. Enter moves to
the next hit; Shift+Enter to the previous."

| Control | Does |
| --- | --- |
| Layer chips | Everything · Values · Formulas. A formula hit matches its expression text; a value hit matches the display. |
| Selecting a hit | `runtime.scrollTo = cell` · `view.inspect(lens for the cell, { kind: "cell", id })` |
| Replace | Absent rather than half-drawn. Replacing inside a formula and inside text are different operations; question 20. |

## 04 · Dependencies

What the current cell reads, what it feeds, and what is broken anywhere in the
sheet. The first two bands are headed by the address itself so the panel names the
cell it describes. Every row moves the panel: selecting a dependency selects that
cell and the headings change with it, which is the only way to walk a chain
without losing your place. Problems lists the whole sheet, because finding a broken
cell is why anyone opens this.

Mock: **Dependencies** · *G3 reads* (2): `E3 · 194,224` spill child of E2; `F3 · 8.10`
value · Hardening spend. *G3 feeds* (1): `G6 · 44.11` `=AVERAGE(G2:G5)`. *Problems*
(2): `D8 · #REF!` `=SUM(#REF!)` · a range that no longer exists; `F8 · #NAME?`
`=F6/eventCount` · no such name. "Nothing here is stored. Reads are scanned out of
G3's expression; feeds are a scan over every other expression. The engine's parse
will replace the scanner."

| Row | Opens |
| --- | --- |
| A value | `spreadsheet-editor.cell` |
| A formula | `spreadsheet-editor.cell-with-formula` |
| A spill child | `spreadsheet-editor.spill` |
| A problem | `spreadsheet-editor.error-cell` |
| A name | `spreadsheet-editor.named-range`, later; a project variable routes to `analysis.variable` |
| A broken reference | nothing; there is no cell at `#REF!`, so the row states the fault and is not a target |

With nothing selected the first two bands say so in a sentence each: "Select a cell
to see what it reads." Problems stays.

## 05 · Styles

The named cell styles the sheet uses. Formatting lives on a style a rule carries
rather than on cells, so changing one reaches everything that shares it. A row is
a name, the one property that tells it from its neighbours, and how many cells wear
it through how many rules. Apply writes a rule over the selection; New style
creates one and opens its lens, where every property lives; selecting a row opens
the lens.

Mock: **Styles** · New style (primary); filter field "Filter styles…" (4); rows
Header · 600 · centred · 8 cells · 1 rule; **Minutes** · #,##0 · 5 cells · 1 rule;
Currency · #,##0.00 · 10 cells · 1 rule; Total · 600 · top border · 8 cells · 1 rule;
each with Apply. "Apply writes one rule over the selected range. Two cells that want
the same font and different decimals share a style and differ on their rule's value
format."

| Control | Op |
| --- | --- |
| Apply on a selection | `insert formatRule formatRules ids ["f9"] values [{ from, to, style: "minutes" }]` |
| New style | `insert sheet styles ids ["style-7"] values [{ name: "Untitled" }]` (asked) · then `view.inspect("spreadsheet-editor.named-style")` |
| Selecting a row | `view.inspect("spreadsheet-editor.named-style", { kind: "named-style", id: key })` |

The style set is typography: family, size, weight, italic, colour, background,
alignment. A value format and a border are on a rule's format, which is why the
shorthand shows what the rule adds.

## 06 · Print

Getting a grid onto paper. A grid has no natural page, so every setting here is a
decision, which is why print is a view you can sit with rather than a dialog sprung
at the moment of printing. Three bands answer "what goes on the paper"; one, shut,
answers "what it looks like". Every control is a `sheet` op on `print`; nothing
here is drawn on the grid.

Mock: **Print** · *Page setup*: Paper (Letter ▾); Orientation Portrait · **Landscape**;
Margins 0.5 · 0.5 · 0.5 · 0.5 ("Top, right, bottom, left, in inches, as the
document's are."). *Area and repeats*: Print area (empty: "Used range · A1:G8");
Repeat rows 1; Repeat columns None ("Typed as addresses, stored as ids, so an
inserted row does not move the area off the table."). *Scale*: **100%** · Fit width ·
Fit page. *Show* (shut): Gridlines on; Row and column headings off.

| Control | Op |
| --- | --- |
| Paper · orientation · margins | `set sheet print/page/paper · print/page/orientation · print/page/margins/top …` |
| Print area | `set sheet print/area { from: CellRef, to: CellRef }` |
| Repeat rows · columns | `set sheet print/repeatRows ["r1"]` · `print/repeatColumns` |
| Scale | `set sheet print/scale 1 \| "fit-width" \| "fit-page"` |
| Gridlines · headings | `set sheet print/gridlines` · `print/headings` |

All of these are the `sheet` target, which is asked for on the last page. Whether
this panel is called Print or Layout, to match the document's, is question 21.

## 07 · Comments

The conversation on this sheet, narrowed by chips from broad to specific. Every row
leads with the address the thread anchors to, because a remark about C3 is
otherwise found only by hunting the grid for a mark. Open threads first; Resolved
as a second band, shut on arrival. Selecting a row brings the cell into view and
opens the thread.

Mock: **Comments** · chips **Everywhere** · This cell. *Open* (3): "Is the 318,400
figure before or after the December restoration?" C3 · Priya Natarajan · 2 h ago;
"Reads correct against the outage log." C3 · Tom Adeyemi · 1 h ago; "Two events or
three? The log lists a third on 14 Jan." D2 · Priya Natarajan · yesterday. *Resolved*
(1), shut. "A thread anchors to a cell or to the whole sheet. A range, a row or a
column cannot be commented on yet; question 12."

| Row | Does |
| --- | --- |
| A thread | `runtime.scrollTo = cell` · `view.inspect("general.comment", { kind: "comment", id })` |
| This cell | narrows to threads anchored on the selected cell; the count reads matched of total |
| A thread on the sheet | has no address to lead with, and says so in words |
| A detached thread | its cell was cleared; the row keeps the quote and says the cell is gone |

Threads and remarks are store rows, read and written through the generic store,
exactly as the document does. Nothing about a comment is in the sheet.

## 08 · Four that stay placeholders, and what each will be

The shell draws a placeholder for a key the rail offers and the tree has no file
for. That is how an unbuilt view is reached, and each of these carries its reason.

- **Objects.** Charts and overlays floating over the grid: the row leads with the
  type, the anchor tells two apart, overlap is a word. Needs objects with ids in
  the body. Question 11.
- **Variables.** The project's name manager: every named table, value and function,
  and the only place they are created. A placeholder in all three editors, as
  agreed for the document.
- **Templates.** Placeholder, as on the document's and the presentation's rails. A
  spreadsheet template is addressed by A1 and instantiated into ids; that
  translation is a later round.
- **Prompts.** Placeholder, as on the other two rails. A grid has no prompt blocks;
  what a generated value means inside a cell is not decided.

## 09 · What this asks of the vocabulary

Context keys in `representation/data/types/workspace/views.ts` and
`behavior/workspace/views.ts`, the rail in `opening.ts`, labels and icons in
`surfaces/context/procedures/rail-entries.ts`. The table is total, so each new key
needs a label and an icon before it compiles.

| Key | Label | Icon | State |
| --- | --- | --- | --- |
| `spreadsheet-editor.grid` | Grid | grid-3x3 | new; on the rail, first, the landing |
| `spreadsheet-editor.find` | Find | search | on the rail, built |
| `spreadsheet-editor.dependencies` | Dependencies | network | on the rail, built |
| `spreadsheet-editor.styles` | Styles | type | on the rail, built |
| `spreadsheet-editor.print` | Print | printer | on the rail, built |
| `spreadsheet-editor.objects` | Objects | group | on the rail, placeholder |
| `spreadsheet-editor.comments` | Comments | message-square | on the rail, built |
| `spreadsheet-editor.variables` | Variables | hash | on the rail, placeholder |
| `spreadsheet-editor.templates` | Templates | layout-template | new; on the rail, placeholder |
| `spreadsheet-editor.prompts` | Prompts | sparkles | new; on the rail, placeholder |
| `spreadsheet-editor.overview` · `insert` · `context` · `named-ranges` | — | — | kept in the vocabulary, off the rail |

---

The rail order and landing are question 4 on the last page. Every panel reads the
live sheet through `view.spreadsheetRuntime(id)` and writes ops to it.
