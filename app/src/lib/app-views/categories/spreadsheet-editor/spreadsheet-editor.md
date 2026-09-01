# Spreadsheet Editor

Lives at `src/lib/app-views/categories/spreadsheet-editor/spreadsheet-editor.md`.

One sheet, keyed by `resourceId`.

| Content | Shows |
| --- | --- |
| [`sheet.svelte`](content/sheet.svelte) | A grid, edge to edge |

No sheet tabs, no formula bar and no name box taking rows off it. What a cell
holds is read in the inspector, which is where everything else about a
selection is read.

## Context

### comments

The conversation on this resource, narrowed by chips from broad to specific. Open
threads first; settled ones behind a disclosure where they are kept at all, since
a settled thread qualifies the conversation rather than being it. When a chip is
narrowing, the count reads matched of total, so a scoped list never reads as the
whole conversation. A thread that mentions you is toned rather than sorted to the
top — re-ordering the list would cost the ordering that makes it readable to say
something the tone already says. Every row routes to
`general.comment`.

Every row leads with the address the thread is anchored to, because a remark
about C2 is otherwise found only by hunting the grid for a marker. A thread on
the whole grid has no address to name, so it says so in words. Chips are
Everywhere and This cell.

**Only open threads are listed.** There is one band and it is Open: a settled
thread is history, and this view is what still needs answering.

A thread anchors to the spreadsheet, to a cell, or to a range of text inside one.
A column, a row, a range of cells or a chart cannot be commented on — which rules
out the most natural thing in a spreadsheet to want to say something about, a
column of numbers.

### context

The saved Contexts — the named scopes a prompt block looks things up in — seen
without leaving the resource. It is deliberately the same view in all three
editors, because a Context means the same thing in all three.

Each carries a way out to the Context category, sitting in the actions row at the
top for the same reason Replace does: a control below a list of unbounded length
is a control nobody finds. **Editing happens there and not here.** Nothing in
these panels changes a scope's membership, because a scope edited from inside one
document is a scope edited without seeing what else runs against it. Rows route
to `context-editor.context`.

Across all three, the resolved count is what a block would get if it ran now, not
what it got the last time it ran.

**The resolved count is on the row, and the block count is not.** A grid has no
prompt blocks, so "used by 2 blocks" would be a number that cannot be true here.
What a Context resolves to is true regardless of who is reading it.

Nothing in this spreadsheet reads any of these yet, for exactly that reason.
Either prompt blocks land in the grid, or this view is premature in this category.

---

### dependencies

*Spreadsheet.* What the current cell reads, what it feeds, and what is broken
anywhere in this spreadsheet. Three bands, and the first two are headed by the
address itself — "G3 reads", "G3 feeds" — so the panel names the cell it is
describing rather than leaving that to be inferred from where the grid happens to
be sitting.

**Every row here moves the panel.** Selecting a dependency selects that cell, so
the headings change with it and the audit walks. That is the only way to follow a
chain of formulas without losing your place in the grid. Problems is the
exception in scope rather than in behaviour: it lists the whole spreadsheet,
because finding a broken cell is why anyone opens this panel at all.

A reference says what it is at a glance — a value, an expression, a spill child,
a name, or nothing. **A broken reference has no target and therefore no click:**
there is nothing at `#REF!` to select, and a row that looked selectable would
promise otherwise. Each band says in a sentence what its emptiness means, rather
than showing a blank: nothing read, nothing fed, or every formula resolves.

Neither direction is stored. Reads are parsed out of the selected formula and
feeds are a reverse scan over every other formula, both redone when the selection
changes — so nothing here can be stale, and a large grid pays for the scan every
time.

Routes to `spreadsheet-editor.cell`, `spreadsheet-editor.cell-with-formula` for the formulas that
depend on this one, `spreadsheet-editor.named-range` when a reference is a name, and
`spreadsheet-editor.error-cell` from Problems.

---

### find

Search inside the open resource. It is a rail panel rather than a dialog, so it
never covers the text it is searching and never has to be dismissed to read a
hit. In all three kinds the search field *contains* its results rather than
sitting above them, so what the query is scoped to is answered by the shape of
the panel rather than by a convention someone has to remember. Every hit says
where it came from before it says anything else.

A grid holds two layers of text — the formulas that are stored and the values
they evaluate to — and searching both at once is usually the wrong answer. So the
layer is a chip (everything, formulas, values), every hit leads with its address,
and every hit says which of the two layers it came out of.

**There is no replace.** Replacing inside a formula and replacing inside text are
different operations and one of them can break a model, so the panel does not
offer a single control that would do either. Whether replace belongs here at all
is unsettled, and it is absent rather than half-drawn.

Routes to `spreadsheet-editor.cell-with-formula` for a formula hit and `spreadsheet-editor.cell` for
a value hit.

### insert

Putting something new into the open resource — where the toolbar's insert menu
went. Entries are grouped by what the thing is rather than by how often anyone
reaches for it, so the list keeps its shape as it grows.

Two decisions run through all three. **Every entry inserts and then selects what
it inserted**, which is why each row opens a lens: the inspector shows the thing
you just made, in the place you would go to change it, so the panel never grows a
configuration form of its own. And **an entry that cannot be used yet is drawn
and not pressable**, carrying the reason on the row. Hiding it would change the
group's shape under a reader for a reason nothing on the screen explains, and
would send someone hunting for a chart somewhere else in the product.

Three bands: Charts, Content, Structure.

Charts render read-only. A chart has no stable id, which is what gates creating
one — and equally selecting, updating and commenting on the ones already there.

Content is formula, variable and prompt block, and the two that go inside a cell
select that cell when they land: `spreadsheet-editor.cell-with-formula` for a formula,
`spreadsheet-editor.cell` otherwise. Insert acts on the grid's selection.

Structure is insert rows, insert columns and merge, and these select the affected
block as a range. **They are the most dangerous commands on the screen.**
Inserting a row or a column has to rebase A1 keys, formulas, comments, named
ranges, merges, spills and chart anchors all at once — atomically, or rejected
with the work preserved — and there is no such contract to call.

### named-ranges

*Spreadsheet.* Names that mean something inside this spreadsheet only. One band,
headed "This spreadsheet" rather than "Names": the scope is the whole claim this
view makes, and it belongs in the heading rather than in a sentence underneath
it. A row is the name, the range it covers, and how many formulas use it — and
zero is the word "unused" rather than a digit, because an unused name is the one
worth questioning.

**This is not the project's Variables view and must never read as one.** Both are
names you can type into a formula. A named range resolves in this spreadsheet and
nowhere else; a variable resolves everywhere. One combined list would make that
difference invisible at exactly the moment it matters — while someone is typing
the name into a cell.

Name this range acts on the grid's current selection and opens the lens, naming
the selection on the button so it is clear what is about to be named. Naming is
where the scope, the range and the name are all settled, and that is the lens
rather than a form grown here. Routes to `spreadsheet-editor.named-range`.

A named range whose cells are deleted has no defined behaviour. It either becomes
`#REF!` everywhere it is used, or it is repaired, and the model does not say
which.

---

### objects

*Spreadsheet.* Charts and overlays floating over the grid — the grid's equivalent
of the deck's Layers. Anything that is not a cell lives here, because an object
anchored underneath another object cannot be reached by clicking the canvas at
all.

**The row leads with the type and the anchor tells two apart.** Two column charts
have the same name and different addresses, so the address is what makes the list
usable; each chart's own title belongs to its lens.

**Overlap is a state, so it is a word and a tone rather than a tint alone.**
Overlapping objects on a grid are how one becomes unreachable, which is the whole
reason this view exists, and a reader who cannot perceive the tint still has to
be told.

Routes to `spreadsheet-editor.chart`.

A chart identifies itself by its position in this list and by nothing else. That
is enough to name it here and not enough for granular update, remote
reconciliation, or a comment — so charts render read-only until they have a
stable id.

---

### overview

The spreadsheet as a whole, and the shortest of the three: the grid carries no
header bar and no name box, because a sheet's chrome belongs in the rail where
every other resource keeps it.

Title, used range, and populated cells. **Both numbers, because the grid is
sparse**: a used range of that size with a few dozen cells in it is a different
object from one with four thousand, and either number alone hides which.

Calculation is a band holding a chip and a sentence and no control. Every formula
reads its inputs when it runs, so there is no stored result that could fall
behind; the band exists to say that, and a button offering to fix a problem that
cannot occur would imply the opposite. The state is structural rather than read
from an engine — nothing is cached, so nothing can be stale.

Saved and From template are the document's, unchanged. There is no presence band
and no attribution here, and the panel routes nowhere.

### print

*Spreadsheet.* Getting a grid onto paper. A grid has no natural page, so every
setting here is a decision someone has to make — which is why print is a view you
can sit with rather than a dialog sprung on you at the moment of printing.

Three bands:

- **Page setup** — paper, orientation, scale. **Paper and scale show what is
  stored rather than offering a choice**, because there is no set of papers and
  no set of scales to choose from, and a free-text field over "Letter" would be
  worse than a plain stated fact. Orientation has its two values, so it is a
  control.
- **Area and repeats** — the print area, and the rows and columns that repeat on
  every page. Repeats sit beside the print area rather than under Show because
  all three answer "what goes on the paper", and the two flags below answer only
  "what it looks like". Repeats are what keep a table readable past page one.
- **Show**, shut on arrival — gridlines and headings, two flags that qualify the
  page rather than defining it.

The settings are read once and then edited in place: a re-read on every change
would throw the edit away.

Print area, repeat rows and repeat columns are all ranges, and a range shifts
when a row or a column is inserted. They belong in the same structural-rebase
contract as everything else in a grid that holds an address, and there is no such
contract.

---

### styles

The named styles the resource uses. The principle is the same in all three
editors: formatting lives on a named style rather than as a selection-local or
per-cell override, so changing one reaches everything that shares it. A search
field contains the list it filters, so the scope of the search is answered by the
markup.

**Making one and editing one are different places.** New style creates and then
opens the lens, which is where every property of a style lives; a second editor
in this panel would be the same form twice, and the lens is the copy with room
for it. A new style is unnamed and unset until someone sets it there.

The deck has no panel in this family — deck typography is a shut band inside
Theme, since it qualifies the theme rather than standing on its own.

**A row is a name, the one property that tells it from its neighbours, and how
many cells use it.** A cell style mixes weight, alignment, borders and value
format together, and listing all four on every row would make four styles look
like one paragraph.

New style names the formatting on the current selection and opens the lens with
no style behind it — what a style is made of is decided there, and there is
nothing to hand it until it has been. Routes to `spreadsheet-editor.named-style`.

Whether the value format belongs on the style or on the cell is a real open
question: two cells can want the same font and different decimal places.

---

### variables

The project's Name Manager: every named table, value and function, and the only
place they are created.

A variable is stored as a *value*, not as an expression. What the panel shows is
exactly what a formula will get when it runs, so nothing here is ever stale and
no band carries a refresh.

The filter is four chips — All, Tables, Values, Functions — not the nine types a
variable can actually be. Nine is a storage taxonomy; the question a person asks
is whether a thing has rows, holds a value, or gets called. A scalar is short
enough to show, so it is shown outright. Anything else shows its type and hands
the value to a hover that reads a bounded prefix rather than the whole thing.

Two controls sit in the header. Create is primary, because defining a variable is
why a person opens this panel. Function Builder is the specialist path and opens
a modal over the whole screen.

**Create is a state of this panel, not a panel a person navigates to.** Choosing
Create swaps the Variables panel out in place for the create form; the form's
breadcrumb swaps it back. It is the only place in the panel tree where one panel
mounts another. The reason is that a variable is defined against the formulas and
fields you can see — a modal would cover exactly what you were looking at to
decide what to define. So the work surface stays where it is and the panel
becomes the form.

The form is three fields: Name, Type, Value. The name is checked against existing
names on the lookup form — lowercased, whitespace removed — because
`TargetMargin`, `targetmargin` and `Target Margin` are one variable; what is
shown back is the casing that was typed. A conflict is decided before the value
is looked at at all, and the note says so, so nothing else on the form is marked
wrong yet.

Value changes shape with type. Logic gets two options rather than a text field.
Record, List and Table get a pair editor, where a List's name column is ordinal
and cannot be renamed — positions are reordered, not renamed — while a Record's
can.

The commit sits at the end of the form it commits, not pinned. A panel has no
footer and should not gain one, but the objection is to a control buried under
content of unbounded length, and three fields are bounded. There is no Cancel:
the breadcrumb is the way out, and a Cancel beside the commit would read as the
more deliberate of two exits that are the same exit. A breadcrumb is itself
unusual for a context panel — a context panel is not normally inside anything —
and it is here precisely because the panel has entered a state that has to be
left.

What it deliberately does not do: the name manager evaluates nothing. There is no
preview band and nothing to refresh, because there is no expression to evaluate.
And leaving discards what has been entered — there is nowhere to park a
half-defined variable, and one that reappeared later against a project that had
moved on would be worse than one that did not.

Routes nowhere. The only things it opens are itself and the function-builder
modal.

## Inspector

### cell

A cell holding a literal value: its address, what it draws, what is stored in
it, and how it is formatted. The address is the title, because a cell's identity
is its A1 address.

Value and Content are two different readings of the same cell and both are
shown. Value is what the grid paints with the format applied; Content is the
string that is stored, and Content is the one that is editable — there is no
formula bar, so this is where a cell is written from outside the grid. Where the
two differ the panel says so in words.

Bands: the head (address, value, type), Content, Format — style as a link,
alignment, value format falling back to the style's — then Merge and spill,
shut, because neither membership is why anyone opened the cell.

Ask for a coordinate with nothing in it and you get a sentence, not a failure:
the grid is sparse, nothing is persisted there, so there is no content, no
format and nothing for a band to hold. Type into it on the grid and it becomes a
cell.

The merge and spill band can only answer half its title. Merge membership is not
in the model, so it reports the spill and says it cannot report the merge.

Crumb to `spreadsheet-editor.spreadsheet`. Routes to `spreadsheet-editor.named-style` from the
style, and to `spreadsheet-editor.cell-with-formula` from a spill origin that is not this
cell.

### cell-with-formula

A cell whose content is an expression: what it evaluates to, the expression
itself, what it reads, what it feeds, and how it is formatted.

This lens replaces the formula bar. A bar takes a row off the grid to show one
line of text; the expression is edited here or in the cell instead, which is why
it is stacked across the whole panel and set to wrap rather than scroll. What a
bar could never carry is the two bands under it: the same formula's dependencies
in both directions. Reads is open and counted; Feeds is shut, because it is
context rather than the reason the cell was opened.

Shows and Type describe the result, not the expression. A formatted number and
the value underneath it are different claims and both belong at the top.

Each reference in Reads opens the lens for what it actually is — a plain cell, a
formula, a spill child, a named range. A broken one opens nothing: there is no
cell at a broken reference and no name behind a name that does not resolve, so
the row states the fault in danger tone instead of pretending to lead somewhere.

The expression is set as plain mono, and that is the gap: syntax colouring is
what makes a wrapped expression readable at this width, and nothing tokenises
the expression yet.

Crumb to `spreadsheet-editor.spreadsheet`. Routes to `spreadsheet-editor.cell`,
`spreadsheet-editor.cell-with-formula`, `spreadsheet-editor.spill` and `spreadsheet-editor.named-range` from
references, and to `spreadsheet-editor.named-style` from the style.

### chart

A chart floating over the grid: what it draws, where it reads from, and where it
sits. Type, source range and title at the head; Placement shut, because where it
floats is rarely why it was opened; then Status.

Nothing here is editable, and Status says why rather than leaving a reader to
discover it. A chart is addressed by its position in the sheet's object list,
because a chart has no stable id, and a position is enough for a list and not
enough for a granular update, a remote reconciliation, a selection that survives
a reload, or a comment. The same missing id gates creating a chart as much as
editing one.

The anchor is an address, so the chart moves when rows or columns are inserted
above or to the left of it — said in the placement band, because it is the part
that surprises.

Ask for a position the sheet does not have and the lens says there is no object
there.

Crumb to `spreadsheet-editor.spreadsheet`. The source range routes to `spreadsheet-editor.range`.

### error-cell

A cell whose formula cannot resolve: what broke, the expression as written, and
the two ways out of it.

An error is a repair job, not a failure to report, so the lens is built around
fixing it. The fault is the head of the panel as a danger chip, the explanation
is in words, the formula is shown exactly as stored — broken reference included,
because a repaired guess is worse than the fault, and the panel says that
outright — and the repair is the last thing on the panel.

The repair is a grid gesture with a panel half: pressing Pick a new range puts
the panel into a selecting state and tells you the range you pick replaces the
broken reference in the formula.

Picking a new range needs to know which reference it replaces. With one broken
reference that is obvious; with two the panel cannot say, so the control goes
dark and says why rather than rewriting the wrong one.

Clear cell is last and behind a rule. It routes to `spreadsheet-editor.spreadsheet`,
because a cleared coordinate holds nothing to inspect. Crumb to
`spreadsheet-editor.spreadsheet`.

### named-range

One name that means a range, inside this spreadsheet only. Name, sheet, the
range as a link, then usage, shut.

Not a project variable. A variable resolves everywhere in the project; a name
here resolves in this grid and nowhere else, which is the whole reason the two
lists are separate.

The Sheet field is left over from when a spreadsheet was a workbook of sheets. A
spreadsheet is one grid now, so the field has nothing to say and is due to go.

The larger gap is on Usage: renaming or deleting a name that formulas use has no
defined outcome. Either the references are rewritten or they break, and this
panel should say which before the edit rather than after.

Crumb to `spreadsheet-editor.spreadsheet`. The range routes to `spreadsheet-editor.range`.

### named-style

One named cell style, edited once for every cell using it. The fields, then
usage, shut.

The identity fields *are* the edit. A style is not a description of cells that
already look this way — changing a field here changes every cell wearing the
style, which is why Usage carries a count rather than a list, and why the count
is repeated in prose with the sentence that every field above applies to all of
them.

Value format and border are shown where the style carries them, which answers
half of the open question about whether they belong to the style or the cell:
the style holds both. Fill is the unanswered half — it is on neither the style
nor the cell — and border is a string rather than something a control can set.
Until both are modelled, a sheet style is typography, a value format and a rule,
and the band says that rather than drawing a control that would have nowhere to
save to.

Crumb to `spreadsheet-editor.spreadsheet`.

### range

Several cells selected together: what the block contains, where it agrees, what
it sums to, and the three things you can do to it at once.

Mixed is a value, not a blank. A property the selection disagrees on shows
nothing selected rather than one cell's answer, and setting over it applies to
every cell in the range — which is why the formatting band is controls and not a
read-out, and why the band says so in a sentence.

Cells with content is counted against coordinates covered, both at the top. On a
sparse grid a range can be large and almost empty, and one number without the
other hides that.

Bands: the head, Shared formatting, Aggregate (shut), Actions, Empty coordinates
(shut). Actions are Name this range — which reveals a name field and confirms
that the name resolves to this range in this spreadsheet and nowhere else — and
Merge; Clear is last, behind a rule, and asks first, saying how many cells it
will empty and that formatting stays.

Two things are unsettled and both are recorded. The status bar already carries
sum, average and count for the selection, so whether the Aggregate band adds
anything — or should carry the measures the bar cannot fit — is undecided. And
formatting is stored on a block, which an empty coordinate does not have:
formatting an empty range either does nothing or mints a block for every
coordinate in it, and the model chooses neither.

Crumb to `spreadsheet-editor.spreadsheet`. Merge routes to `spreadsheet-editor.cell` at the anchor,
the first cell of the range.

### spill

A cell filled by a formula somewhere else: where the value came from, and why
you cannot type here.

The lens exists to explain a difference, not to report a state. A spill child
looks exactly like a cell with a number in it and behaves like a read-only
projection, and the first time somebody types into one is the moment that has to
be explained. So: origin, occupied range and status at the top; the origin's
formula in full in the next band, one click closer than it needs to be because
the fix belongs at the symptom; and then Behavior, which is the rule in prose.

The origin is a link, unless this cell *is* the origin. A control that reselects
what is already selected teaches nothing and looks broken, so at the origin the
address is plain text.

The rule Behavior states: a write anywhere in the occupied range fails visibly
and names the origin. It is refused rather than accepted quietly, and the spill
does not stop spilling to make room for it. The calculation engine has no
defined write-collision behaviour yet — a silent failure is the worst outcome
here and the easiest one to build by accident, which is why the rule is written
down before it is implemented.

Crumb to `spreadsheet-editor.spreadsheet`. The origin routes to
`spreadsheet-editor.cell-with-formula`.

### spreadsheet

The spreadsheet itself, which is what the inspector shows when nothing in the
grid is selected. Title, used range, populated cells, saved; then nothing
selected; then calculation.

Nothing selected is a state, not a blank panel — the same compensation the other
two editors make. It says what selecting something would offer, in the place
where the offer would appear: click a cell to see what is in it, select several
and the panel offers formatting, a name for the range, and merge.

The calculation band exists to close a question rather than to hold a control.
The formula engine is the only calculation authority here and every formula
reads its inputs when it runs, so there is nothing to recalculate and no command
to do it with.

No crumb trail: this is the top of the ancestry.

## What is not here

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**No template origin, three times.** The document, the deck and the spreadsheet
each carry a From template band with nothing in it and a sentence saying why. The
band stays because that is where the answer goes; dropping it would hide the gap
rather than record it.

**Presence is only presence.** Two of the three resource overviews and the
project overview carry it, and all three record the same limit — it names the
resource somebody is in and nothing about where inside it, so a page, a slide or
a cell is never claimed.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

**There is no structural rebase in a grid.** Three panels name the same missing
contract from three sides: Insert, where adding a row or a column is the command
that needs it; Print, where the print area and the repeats are ranges that shift;
and Named ranges, where a deleted range has no defined fate. All of them hold an
address, and all of them have to move together, atomically or not at all.

**Almost nothing in a grid or a layout has a stable id.** A chart identifies
itself by its position in a list, which is enough to name it in Objects and not
enough for update, reconciliation or a comment. A placeholder has no key at all,
which is why it cannot be selected in the layout's Objects panel, why Reset to
layout is gated in Layouts, and why the deck's cross-layer stacking order is
undefined in Layers. Three panels are gated by one missing key.

**Where a comment can anchor is unsettled in two kinds of three.** A deck has no
agreed target below the slide. A grid cannot take a remark on a column, a row, a
range of cells or a chart, which rules out the most natural thing in a
spreadsheet to want to say something about.

**No panel here edits a Context**, and the three do not agree on whether they
list the scopes already in use or every scope so one can be assigned — the
document picks one, the deck offers both, the spreadsheet has no blocks to use
one at all.

**Editing is elsewhere, on purpose, everywhere.** A named style, a named range, a
comment thread, a chart, a Context, a layout's own properties: named in a panel,
configured in a lens or in a category. A panel that grew a second editor for one of
them would be the same form drawn twice, and it would be the copy without room
for it.

And a set of things deliberately not drawn, each for its own stated reason: no
ruler above the document text, no page thumbnails in the Navigator, no replace in
the spreadsheet's Find, no align or distribute in Layers, and no delete in the
layout list.

- **No row lens and no column lens.** A cell's identity is its A1 address, and
  rows and columns are not identified objects. Everything the grid offers is
  addressed as a cell or a range.

- **No merge.** The range lens offers Merge and the cell lens has a band for
  merge membership, but merge membership is not in the model, so the band
  answers spill only and the action lands on the anchor cell.

- **Nothing writes yet.** Every edit on every lens is held in the panel until
  there is something to write it back to. The visible consequence is the dark
  buttons: duplicating a slide or a layout, minting a new slide, resetting to a
  layout. Where an action would mint identified objects the panel says so in the
  button's own words rather than failing later.

- **No stable key for placeholders, and none for charts.** Both are addressed by
  position in a list. That single absence is what makes the placeholder lens
  read-only, blocks reset where a layout has two placeholders in one role, and
  makes the chart lens read-only including chart creation.

- **No refresh, anywhere.** Not on an inline formula, not on a prompt block, not
  on the spreadsheet. Everything reads its inputs when it runs, so there is no
  cached copy to fall behind and nothing to mark stale.

- **No toolbar, and that is the trade the whole subject makes.** It is why the
  three resource lenses carry a "nothing selected" band that tells you what to
  click, why there is no formula bar and the expression lives in a stacked band
  instead, and why a property that cannot be set here has a sentence saying
  where it is set.
