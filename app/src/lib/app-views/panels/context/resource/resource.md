# Resource

These are the context panels of a resource editor — the rail down the side of an
open document, spreadsheet or deck. Together they answer one question: what is
in this thing, and how do I get to a piece of it or put a new piece into it.
Nothing here is the canvas; everything here is the way to reach the canvas by
name instead of by aiming at it.

The subject splits three ways, and the split is the thing a list of files does
not show. Five ideas appear once per resource kind — **Find**, **Insert**,
**Comments**, **Context**, and **Styles** — and each is deliberately the same
view three times, because searching is searching and a saved Context means the
same thing whether a prompt block lives in a paragraph or on a slide. What
differs between the three is not the shape of the panel but what the resource
actually holds: a grid has two layers of text where a document has one, a slide
has no structure to insert, a grid has no prompt blocks at all. Then each kind
has panels only it can have — the document's **Navigator** and **Page**, the
spreadsheet's **Dependencies**, **Named ranges**, **Objects** and **Print**, the
deck's **Slides**, **Layers**, **Notes**, **Layouts** and **Theme**. And the deck
has a fourth group: three panels that replace the whole rail while a layout is
being edited, standing in for the slide-side ones.

The families come first below, because they are the spine of the subject. The
kind-specific panels follow, grouped by the resource they belong to.

---

## Find

Search inside the open resource. It is a rail panel rather than a dialog, so it
never covers the text it is searching and never has to be dismissed to read a
hit. In all three kinds the search field *contains* its results rather than
sitting above them, so what the query is scoped to is answered by the shape of
the panel rather than by a convention someone has to remember. Every hit says
where it came from before it says anything else.

### In a document

The field, then a Results band. Each row shows the match in its surrounding text
with the match itself picked out, and underneath it the page, what the hit came
out of — a heading, a paragraph, a table, a prompt block's output — and, where
the text is authored, the block.

Replace is two controls in the actions row at the top: a field to type the
replacement into and the Replace button itself. The specification for this view
pins them at the foot, and they are at the top instead because a control below a
list of unbounded length is a control nobody finds. Enter in the field commits,
guarded the same way the button is disabled.

**A hit inside generated output is findable and not replaceable.** A prompt block
runs on open, so a replacement inside its output survives exactly until the next
run and then vanishes without anyone watching it go. Those rows carry the
intelligence tone, Replace stays disabled on them and says why on hover, and the
note at the foot says it in a sentence.

Routes to `resource.text-block-document` for authored hits and
`resource.prompt-block` for generated ones.

### In a spreadsheet

A grid holds two layers of text — the formulas that are stored and the values
they evaluate to — and searching both at once is usually the wrong answer. So the
layer is a chip (everything, formulas, values), every hit leads with its address,
and every hit says which of the two layers it came out of.

**There is no replace.** Replacing inside a formula and replacing inside text are
different operations and one of them can break a model, so the panel does not
offer a single control that would do either. Whether replace belongs here at all
is unsettled, and it is absent rather than half-drawn.

Routes to `resource.cell-with-formula` for a formula hit and `resource.cell` for
a value hit.

### In a deck

Deck-wide rather than slide-wide: a slide is small enough to read, and the deck
is not. Hits reach into speaker notes, which are not on the canvas at all and
would otherwise be unfindable by any means. Each row names the slide, the source,
and the block where there is one.

A hit opens what it is inside, and that differs by where it came from: a body hit
has a block to open, a notes hit has only its slide. So it routes to
`resource.text-block-deck`, `resource.speaker-notes`, or `resource.slide`.

Whether search reaches into layout-owned locked content is undecided. A hit you
cannot edit from the slide would have to say so on the row, and none of these
rows do.

---

## Insert

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

### In a document

Four bands: Basics, Content, Data and AI, then Structure. The first three arrive
open; Structure arrives shut, because it is layout rather than content.

Formula, Prompt block and Variable sit one row apart in Data and AI and are three
different acts, so the note on each row says which it is: an expression, a
generation, and a reference to a value the project already holds.

Text, heading, list and checklist route to `resource.text-block-document`, a
table to `resource.table`, formula and variable to `resource.formula` — a
variable reads as live text in the body, which is the inline formula lens —
and a prompt block to `resource.prompt-block`. Image, embed, divider, page break
and side-by-side name no lens of their own, so they fall through to the block
they insert.

### In a spreadsheet

Three bands: Charts, Content, Structure.

Charts render read-only. A chart has no stable id, which is what gates creating
one — and equally selecting, updating and commenting on the ones already there.

Content is formula, variable and prompt block, and the two that go inside a cell
select that cell when they land: `resource.cell-with-formula` for a formula,
`resource.cell` otherwise. Insert acts on the grid's selection.

Structure is insert rows, insert columns and merge, and these select the affected
block as a range. **They are the most dangerous commands on the screen.**
Inserting a row or a column has to rebase A1 keys, formulas, comments, named
ranges, merges, spills and chart anchors all at once — atomically, or rejected
with the work preserved — and there is no such contract to call.

### In a deck

Shorter than the document's, because a slide has no structural inserts:
everything is a box placed on a canvas. The sections are whatever groups the
entries already carry, so an entry moving between them is a change to the data
rather than to the panel.

Text routes to `resource.text-block-deck`, formula and variable to
`resource.formula`, prompt to `resource.prompt-block`, and anything else lands on
`resource.element`.

A prompt block on a slide runs when the slide is shown. Whether that means on
deck open, on slide selection, or on presentation is undecided, and the three
have very different costs.

---

## Comments

The conversation on this resource, narrowed by chips from broad to specific. Open
threads first; settled ones behind a disclosure where they are kept at all, since
a settled thread qualifies the conversation rather than being it. When a chip is
narrowing, the count reads matched of total, so a scoped list never reads as the
whole conversation. A thread that mentions you is toned rather than sorted to the
top — re-ordering the list would cost the ordering that makes it readable to say
something the tone already says. Every row routes to
`collaboration.comment`.

### In a document

Chips are Document, Page *n*, and Selection, and they sit above both bands rather
than inside either: they narrow what is being talked about, and open and resolved
are the same conversation in two states.

**The page chip is a computed filter, not a stored one.** A comment is anchored
to text and has no idea what page it is on; the layout decides that. So the chip
reads the page off the block the selection is in and matches comments whose
anchor lands on the same one. It relabels itself when the layout moves, which is
the honest way to draw a number that is not an address.

### In a spreadsheet

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

### In a deck

Chips are Deck, Slide *n*, and the selected element, and **the chips carry the
resolved subject** — "Slide 4", the element's own name — because a chip reading
"Slide" tells the reader the category they already knew.

Every row names its anchor on the title line, beside the author. Under the
deck-wide chip the list mixes three granularities, and a remark whose subject has
to be guessed is a remark the reader has to go and find. Resolved is a second
band, shut on arrival, and says so when it is empty.

Whether a comment can anchor to an element at all, or only to a slide, is not
settled. The document editor anchors to a text range; a deck's equivalent has no
agreed target.

---

## Context

The saved Contexts — the named scopes a prompt block looks things up in — seen
without leaving the resource. It is deliberately the same view in all three
editors, because a Context means the same thing in all three.

Each carries a way out to the Context category, sitting in the actions row at the
top for the same reason Replace does: a control below a list of unbounded length
is a control nobody finds. **Editing happens there and not here.** Nothing in
these panels changes a scope's membership, because a scope edited from inside one
document is a scope edited without seeing what else runs against it. Rows route
to `scope.context`.

Across all three, the resolved count is what a block would get if it ran now, not
what it got the last time it ran.

### In a document

The title picks a side on a question the other two leave open: **"Available to
prompt blocks"** means every saved Context is listed, and each row says whether a
block in this document uses it. Listing only what is already used would leave no
way to see one you could assign.

A second band, shut on arrival, is a resolved preview: a *sample* rather than the
set, because the resolve is bounded, so the count reads "of 96" and never claims
those four are all of it. It arrives shut because the question it answers — has
this scope drifted — is asked before a run, not on every visit. Its rows route to
`scope.resolved-resource`.

### In a deck

The same view, with the open question answered by making both readings one press
apart: a Show chip switches between the scopes used here and all of them, and the
count says which one is showing. A scope no block here uses says that in words
rather than by absence.

### In a spreadsheet

**The resolved count is on the row, and the block count is not.** A grid has no
prompt blocks, so "used by 2 blocks" would be a number that cannot be true here.
What a Context resolves to is true regardless of who is reading it.

Nothing in this spreadsheet reads any of these yet, for exactly that reason.
Either prompt blocks land in the grid, or this view is premature in this category.

---

## Styles

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

### In a document

Family, size, indentation and line spacing all live on a named style and never as
a selection-local override, so this is the whole set of answers the document has
about how its text looks. A row is a name and the typography in shorthand, which
is enough to tell two apart; everything else is the lens's business. Routes to
`resource.named-style-document`.

### In a spreadsheet

**A row is a name, the one property that tells it from its neighbours, and how
many cells use it.** A cell style mixes weight, alignment, borders and value
format together, and listing all four on every row would make four styles look
like one paragraph.

New style names the formatting on the current selection and opens the lens with
no style behind it — what a style is made of is decided there, and there is
nothing to hand it until it has been. Routes to `resource.named-style-sheet`.

Whether the value format belongs on the style or on the cell is a real open
question: two cells can want the same font and different decimal places.

---

## Navigator

*Document.* Getting somewhere in a long document. A filter field over one region,
and a chip that switches that region between Outline and Pages. The two answer
different questions, and they share one region rather than stacking two lists a
reader has to scroll past each other — showing both at once would make the panel
twice as long to say one thing.

Outline is the headings, indented one step per level so an H1 sits at the gutter,
each with the page it falls on. Pages are numbered rows carrying the heading that
starts on them, or the one they are still inside.

**Pages are numbered rows, not thumbnails.** A thumbnail needs the whole document
rendered small, which is the one thing a long document cannot do cheaply, and a
number plus the heading that starts on it already answers "what is on page 4".

A second band, shut on arrival, is breaks and furniture: the explicit structure
the author put in, plus the header and the footer, which are otherwise reachable
only by clicking the edge of a page. It is context rather than the reason anyone
opened the panel.

**A page number is a label, never an address.** It is computed from the layout as
it stands and moves when the paper or the gutters change, and the note at the
foot says so out loud.

Headings route to `resource.text-block-document`; a page and a page break both
land on `resource.document`, which is where page setup is; the header and footer
route to `resource.header` and `resource.footer`.

---

## Page

*Document.* Paper, gutters, furniture and numbering — everything that applies to
every page rather than to one place in the text. It is the largest form in the
subject and the only panel here that is entirely a form: it lists nothing and
opens no lens, because everything it names is a property of the document rather
than a thing to go to.

What is set here is drawn on the page itself as a dashed guide, and **that is why
there is no ruler above the text**. A margin is easier to judge where you are
writing than to measure on a scale somewhere else, and a ruler would be a second,
worse drawing of the same numbers.

Four bands, in the order a page is decided:

- **Paper** — size and orientation, both as chips rather than selects, because
  each has exactly two values and a chip shows both of them.
- **Gutters** — top, bottom, inside and outside, each typed. They are named for a
  bound document rather than for a category: inside is the bound edge and outside
  the open one, so a two-sided document keeps its wide margin at the spine when
  the page turns. Left and right would be wrong on every second page.
- **Header and footer**, shut on arrival — the depth of the two reserved bands,
  and whether the first page is exempt from them.
- **Page numbering**, shut on arrival — where numbering starts, where the number
  sits on the page, and whether it shows on the first page. Page numbers are
  generated from those three; a number typed into footer content is a literal and
  will not follow the document.

The controls hold their own values: a change stays in the panel and the stored
record answers for anything nobody has touched, so a re-read cannot throw an edit
away mid-form. The start number arrives as typed text and is taken only when it
is actually a number.

---

## Dependencies

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

Routes to `resource.cell`, `resource.cell-with-formula` for the formulas that
depend on this one, `resource.named-range` when a reference is a name, and
`resource.error-cell` from Problems.

---

## Named ranges

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
rather than a form grown here. Routes to `resource.named-range`.

A named range whose cells are deleted has no defined behaviour. It either becomes
`#REF!` everywhere it is used, or it is repaired, and the model does not say
which.

---

## Objects

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

Routes to `resource.chart`.

A chart identifies itself by its position in this list and by nothing else. That
is enough to name it here and not enough for granular update, remote
reconciliation, or a comment — so charts render read-only until they have a
stable id.

---

## Print

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

## Slides

*Deck.* The deck as an ordered list, with one band per section of the deck. This
is the deck's first rail entry and its default: the list of slides is the
orientation, so nothing sits above it.

A slide has no persisted name, so each one is a picture captioned with its index.
The bars a picture draws are its layout's placeholder count — the only thing
about a slide's shape that can be said honestly without a renderer. A hidden
slide is drawn as hidden rather than dropped.

Four actions at the top act on the selected slide: New, Duplicate, Delete, and
Hide or Show depending on the state of the one selected.

**New and Duplicate are inert, and they say why.** Duplicating a slide has to
mint fresh ids for the slide and for every identified thing inside it, or two
slides end up sharing element ids, and nothing decides that yet.

A section is anchored to its first slide, so reordering re-interprets where the
boundaries fall rather than carrying them along with the slides.

Routes to `resource.slide`.

---

## Layers

*Deck.* What is on this slide, in stacking order, and which of it the slide is
allowed to touch. **Anything selectable by clicking the canvas is selectable
here**, which is what makes this list the canvas's accessibility fallback rather
than a summary of it.

**Depth is the row's position, not a stored word.** The list *is* the stacking
order, so a reorder that left "Front" sitting beside the second row would be the
list contradicting itself.

Two bands. Slide objects first, in stacking order, front at the top. Layout
objects second — a separate list rather than more rows in the first, because what
the layout owns cannot be edited from the slide, and rows that looked the same
would promise that it could.

Four verbs at the top — front, forward, back, behind — act on the selection and
are off until something on this slide is selected. **Align and distribute are
deliberately absent**: they are properties of a selection and belong in the
inspector, not in the panel that owns order.

Cross-layer order between layout-owned and slide-owned objects is undefined in
the model. Two lists cannot express one stack, and these two are pretending they
can.

Routes to `resource.element` for slide objects and `resource.locked-element` for
layout-owned ones.

---

## Notes

*Deck.* Speaker notes, for this slide and across the deck. **Notes are not on the
canvas**: a tray under a 16:9 slide costs exactly the height that zooming needs,
and notes are read while presenting rather than while designing.

Two bands. The current slide's notes as editable text, headed with the slide's
index and a summary of what is in them. Then the whole deck as a list — index,
title and a paragraph count per slide, with the ones that have no notes toned so
they stand out.

**The deck list selects rather than previews.** A per-slide preview is expensive,
and a paragraph count already answers the question that band exists for: where
the gaps are, found before a rehearsal rather than during one. Selecting a slide
there moves the editable section above onto it, and an in-progress edit is held
per slide so switching does not carry a draft across.

Routes to `resource.slide`.

The same notes also appear in the slide inspector and in a notes lens of their
own. Which of the three is authoritative is not settled.

---

## Layouts

*Deck.* Which layout this slide uses, and what else it could use. This is
*applying* a layout, from the slide's side; editing one is the layout subscreen
below.

Two bands. Current is a short block of facts about the layout in force: its name,
what it contributes (placeholders and locked objects), where its background comes
from, and how many slides use it. Then Deck layouts, as cards two across.

**The alternatives are cards rather than rows because a layout is a shape and a
shape should be seen.** Each card draws one bar per placeholder, so the pictures
differ from one another for the reason the layouts actually differ, rather than
being decoration.

Choosing a card arms Apply; it does not change the slide until Apply is pressed.

Reset to layout is disabled and says why on hover: reset needs a slide element's
placeholder to resolve to exactly one role, and a placeholder has no stable key,
so two placeholders sharing a role cannot be told apart and there is no defined
element to reset a slide's copy back to. Edit layout is disabled for a different
reason: entering the subscreen is a move of the whole rail rather than a modal —
the layout views replace the slide views for as long as a layout is being edited
— and the deck's rail does not yet make that move.

This panel opens no lens. Selecting a card selects it here.

---

## Theme

*Deck.* Deck-wide colour, type and named styles — what every slide and every
layout inherits unless it overrides it.

One band of facts: the background kind and colour, the font, the palette, and how
many slides and layouts use the theme. **Every swatch carries its name.** The
colours have no roles, so the name is the only thing that tells two of them
apart, and colour is never the only channel a fact is carried on.

A second band, shut on arrival, is the deck's named styles: deck typography as
named styles rather than per-element overrides, the same principle the document
editor keeps. It arrives shut because it qualifies the theme rather than being
the reason anyone opens this. Routes to `resource.named-style-deck`.

How many colours a theme has, and what each one is *for*, is undetermined.
Nothing on a slide can ask for "the accent", so every use of one of these is a
literal that will not follow a theme change.

---

## The layout subscreen

*Deck.* Editing a layout replaces the deck's whole rail for as long as it lasts.
Three panels stand in for the slide-side ones: a list to move between, a list of
what is on the thing being edited, and the theme question narrowed to one layout.

### Layouts

Every layout in the deck, and which one is being edited. It is the first rail
entry of the subscreen and it replaces the slide list, because in this state
layouts are what you move between. Each row is the layout's name, what it is made
of — placeholders, and locked objects when it has any — and how many slides use
it.

**The used-by count is on every row.** It is how many slides an edit here will
change, which is the one number that decides whether an edit is safe to make.

New and Duplicate are drawn and inert: nothing mints a layout id.

**Deleting is absent rather than disabled.** A disabled control promises the
behaviour exists and is merely unavailable, and here there is no behaviour to
have — deleting a layout has no defined outcome. The slides using it either fall
back to Blank, or the deletion is refused, or the layout stays as a tombstone,
and nothing chooses.

Routes to `resource.layout`.

### Objects

What a layout owns, split by what a slide may touch. Locked content first, then
Placeholders. **The split is the whole point of a layout**, so the panel is built
on it rather than listing everything together and marking each row with which it
is.

A slide gets its own copy of each placeholder and then owns that copy; the layout
supplies the frame and the style key, never the content.

**Placeholder rows are not targets.** A placeholder has no stable key, so there is
nothing to select it by that survives a reorder. A row that repeats a role
already taken says so in words and is toned, instead of pretending to a name it
does not have.

Locked content routes to `resource.locked-element`.

### Theme

What this layout takes from the deck theme, and what it overrides. **Only
background is offered.**

Every value says which of the two it is, because an inherited value and a set
value that happen to match are not the same fact: there is an explicit Override
switch, and a Source field that reads either "Set on this layout" or "Inherited
from the deck theme". With the override off, the value follows the deck theme and
changes with it.

Kind is stated as a fact rather than offered as a control: solid is the only
background the model has, and a select with one option is a select that lies
about choice.

The colour list is the theme's own background plus its named colours — and a
stored override naming something outside that set is kept in the list, so opening
this panel cannot silently offer to change a value it could not offer back.

Whether a layout can override type or palette as well is undecided, and until it
is there is nothing else here to mark as inherited.

This panel opens no lens.

---

## What is not here

Read across the subject, the same few unanswered questions surface again and
again, from different sides.

**Nothing mints an identifier.** New slide, duplicate slide, new layout,
duplicate layout — all four are drawn and inert, each carrying its reason. The
question underneath is one question: duplicating a thing has to mint fresh ids
for it and for everything identified inside it, or two copies share ids. Until
that is settled the controls are shown as unavailable rather than hidden, so
nobody goes looking for them elsewhere.

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
