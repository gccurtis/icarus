# Slide Deck Editor

Lives at `src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md`.

One deck, keyed by `resourceId`.

| Content | Shows |
| --- | --- |
| [`deck.svelte`](content/deck.svelte) | The canvas, and whatever is being edited on it |

One region and one track. Editing a slide, editing a layout and choosing a new
slide are states of this one editor, entered from the panel that already holds
the thing they act on — a toolbar across the canvas is exactly what it refuses.

It opens on its list of slides rather than on an overview, because the slide you
are on is the orientation a deck has instead of a summary.

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

The same view, with the open question answered by making both readings one press
apart: a Show chip switches between the scopes used here and all of them, and the
count says which one is showing. A scope no block here uses says that in words
rather than by absence.

### find

Search inside the open resource. It is a rail panel rather than a dialog, so it
never covers the text it is searching and never has to be dismissed to read a
hit. In all three kinds the search field *contains* its results rather than
sitting above them, so what the query is scoped to is answered by the shape of
the panel rather than by a convention someone has to remember. Every hit says
where it came from before it says anything else.

Deck-wide rather than slide-wide: a slide is small enough to read, and the deck
is not. Hits reach into speaker notes, which are not on the canvas at all and
would otherwise be unfindable by any means. Each row names the slide, the source,
and the block where there is one.

A hit opens what it is inside, and that differs by where it came from: a body hit
has a block to open, a notes hit has only its slide. So it routes to
`slide-deck-editor.text-block`, `slide-deck-editor.speaker-notes`, or `slide-deck-editor.slide`.

Whether search reaches into layout-owned locked content is undecided. A hit you
cannot edit from the slide would have to say so on the row, and none of these
rows do.

---

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

Shorter than the document's, because a slide has no structural inserts:
everything is a box placed on a canvas. The sections are whatever groups the
entries already carry, so an entry moving between them is a change to the data
rather than to the panel.

Text routes to `slide-deck-editor.text-block`, formula and variable to
`document-editor.formula`, prompt to `document-editor.prompt-block`, and anything else lands on
`slide-deck-editor.element`.

A prompt block on a slide runs when the slide is shown. Whether that means on
deck open, on slide selection, or on presentation is undecided, and the three
have very different costs.

---

### layers

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

Routes to `slide-deck-editor.element` for slide objects and `slide-deck-editor.locked-element` for
layout-owned ones.

---

### layout-layouts, layout-objects and layout-theme

*Deck.* Editing a layout replaces the deck's whole rail for as long as it lasts.
Three panels stand in for the slide-side ones: a list to move between, a list of
what is on the thing being edited, and the theme question narrowed to one layout.

#### Layouts

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

Routes to `slide-deck-editor.layout`.

#### Objects

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

Locked content routes to `slide-deck-editor.locked-element`.

#### Theme

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

### layouts

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

### notes

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

Routes to `slide-deck-editor.slide`.

The same notes also appear in the slide inspector and in a notes lens of their
own. Which of the three is authoritative is not settled.

---

### overview

The deck as a whole. Second in the rail rather than first, because on a deck the
slide list is what orients you — which is also why the aspect ratio is here
rather than on the canvas: it does not change while you work, so it never earned
permanent width.

Title, slide count, and the aspect ratio as a choice. **Changing the aspect ratio
asks first.** It re-frames every element on every slide, so the choice is staged:
the panel says what it is about to do and to how many slides, and offers to
re-frame or to keep what is there. It is the only staged confirmation in the
subject — everywhere else a control simply moves — and after the launcher has
asked once, before there is anything to re-frame, this is the only place the
ratio changes.

Editing now, then Saved, then From template work exactly as the document's do,
with one difference in the presence gap: presence names the resource someone is
in, not which slide they are on.

The panel says nothing about any one slide, and that is the division of the deck
rail rather than an omission: the Slides, Layers and Layouts panels are what reach
a slide, an element or a layout, and the lenses behind them are where any of the
three is read.

Routes to `general.person`.

### slides

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

Routes to `slide-deck-editor.slide`.

---

### theme

*Deck.* Deck-wide colour, type and named styles — what every slide and every
layout inherits unless it overrides it.

One band of facts: the background kind and colour, the font, the palette, and how
many slides and layouts use the theme. **Every swatch carries its name.** The
colours have no roles, so the name is the only thing that tells two of them
apart, and colour is never the only channel a fact is carried on.

A second band, shut on arrival, is the deck's named styles: deck typography as
named styles rather than per-element overrides, the same principle the document
editor keeps. It arrives shut because it qualifies the theme rather than being
the reason anyone opens this. Routes to `slide-deck-editor.named-style`.

How many colours a theme has, and what each one is *for*, is undetermined.
Nothing on a slide can ask for "the accent", so every use of one of these is a
literal that will not follow a theme change.

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

### deck

The deck itself — what the slide editor opens with, and what it falls back to
whenever nothing on the canvas is selected. Three bands: this deck (title,
slides, aspect ratio, saved), nothing selected, and the handout, shut.

Nothing selected is a band and not an empty panel: the canvas carries no
toolbar, so with nothing picked there is nowhere else to say how to pick
something. It names shift-click for several, and says that new, duplicate and
delete live at the top of the Slides panel rather than here.

The handout is how the deck prints, which is a different output from the deck,
so it is shut.

No crumb trail: a deck is the outermost thing a selection can be inside.

### element

One element on a slide: the spatial box, where it sits, how it stacks, and how
the box itself is drawn.

The box is here and the content is not. Content is the first band and it shows
what the element holds and hands editing over — one button to the block lens —
so that frame, rotation and overflow never leak into content. Then Position and
size; then Arrange; then Overflow; then Box format, shut, because how the box is
drawn is rarely why it was opened; then Placeholder origin, shut.

The frame is fractions of the slide, to three decimals. That is the model, and
it is what lets a deck survive a change of aspect ratio — and it is useless to
type a value into, so the numbers are read here and dragged on the canvas. Under
the pointer they are pixels, and the panel says so.

The stacking position is read off the slide's own layer list, so the two buttons
that would do nothing at the front or the back are dark rather than left to be
pressed twice. Arrange also carries the sentence that tells you align and
distribute exist — shift-click a second element and they appear.

Placeholder origin either says the element was drawn on the slide and so has
nothing to reset to, or names the placeholder it came from and whether reset is
eligible. Eligibility is inferred from the placeholder's role, because a
placeholder has no stable key; where a layout has two in the same role, reset
stays shut.

Crumb to `slide-deck-editor.slide`. Edit text routes to `slide-deck-editor.text-block`.

### layout

A layout: what it is made of, what it inherits, and what editing it will do.
Identity, background, a Careful band, then actions.

Careful is a band rather than a dialog. Editing a layout changes every slide
using it, and the count of those slides is said twice — once as a fact in the
identity band and once in prose beside the warning — because the thing people
get wrong about layouts is which of the two they just changed. The band also
says what does *not* come from here: slides keep their own copies of placeholder
content, and only the frame, the locked content and the background are inherited.

Duplicate is dark, because nothing writes a layout and a copy would not survive
the next read. There is deliberately no delete: a layout in use has slides
pointing at it, and where those slides go is a decision the Layouts view makes,
not this one.

Crumb to `slide-deck-editor.deck`; Done routes there too.

### locked-element

Content the layout owns and a slide cannot touch — a footer wordmark, a slide
number. The content, the frame with its owner, and one sentence about editing.

The content is editable *because this lens exists only in the layout subscreen*.
On a slide the same object is visible and inert, and there it is not selectable
at all. The crumb names the layout rather than a slide, so where you are is
answered before you try to type.

The owner chip is the point of the frame band: the frame belongs to the layout,
every slide on that layout draws this, and none of them can change it.

Crumb to `slide-deck-editor.layout`.

### multi-selection

Two or more elements, shift-clicked: the selection as a group. The members
listed, then Align, Distribute, Arrange, then the geometry and format they share.

A multi-selection is a different thing from an element, not a degraded one.
Align and distribute exist only here, and distribute is dark with two members
because there is nothing between two things to distribute. Each action says what
it did, where it did it, rather than the panel going quiet.

Mixed is a value. A property the selection disagrees on shows as Mixed rather
than as one member's answer, and typing over it sets all of them — the only
honest way to edit three values through one field.

Group is offered and dark: there is no group in the model to make. Either a
group is a thing that survives a reload or it is a selection convenience, and
the difference shows up the next time the deck is opened.

The second gap is inside the lens itself: Shared geometry lets Mixed be typed
over and Shared format does not. It states which properties differ across the
selection and which agree, and gives nowhere to set them. It should do what
geometry does.

Crumb to `slide-deck-editor.slide`. Each member row routes to `slide-deck-editor.element`.

### named-style

A named style in the deck's theme: typography edited once, for everywhere it is
used. Identity, typography, then usage, shut.

The style key is shown and not edited. A layout placeholder names a style by key
rather than by name, so the key is a reference other objects hold: renaming the
style is safe and re-keying it is not. Whether the key is authored or derived
from the name when the style is made has not been settled, so name and key can
drift apart and the key is read-only until it is.

The difference from the document's named style is one field and it matters: a
deck style has no line height. The document editor's styles carry one, so a
title that wraps to two lines will not set the same way twice.

Crumb to `slide-deck-editor.theme`.

### placeholder

A placeholder in a layout: a frame and a style key that a slide fills in. Role,
frame, style key, then Status.

It is addressed by position, not by name. A placeholder has no stable key, so
the lens takes a position in the layout's list, and two placeholders in the same
role can only be told apart by which one comes first — where that happens the
panel says so, describing this one by its neighbour and its position. Ask for a
position the layout no longer has and the lens says that plainly: a list that
has shortened leaves the last address pointing at nothing.

The whole lens is read-only, and Status says why rather than offering fields
with nowhere to save to. The missing stable key is what blocks selection,
duplicate-role reset, and any per-placeholder property at all — so this is a
summary of the layout rather than an independently selectable object.

Crumb to `slide-deck-editor.layout`.

### slide

A slide, selected in the Slides panel rather than something on it. Speaker
notes, then the slide's own properties, then actions, then reset.

Speaker notes come first and are read-only here. They belong to the slide and
the canvas carries none of them, so this is where a person looks — but
`speaker-notes` is the editor, and an Edit notes button goes there. Two writable
copies of the same paragraph is how one of them quietly wins.

The slide band gives the layout as a link, the section name, and the background,
with Hidden as a switch sitting outside the field list, because a switch is a
control rather than a fact. The section names a place in the deck and has no
lens of its own, so it appears in the trail as a label with nowhere to go.

Duplicate and New after are dark. Both mint ids for the slide and every
identified thing inside it, which is the model's job and not the panel's, and
nothing writes a deck, so a new slide would not survive the next read. Delete is
different and does work: it clears the inspection, which is a true thing at the
selection level.

Reset to layout is shut and dark. Reset is only available where an element's
placeholder resolves to exactly one role, and placeholders have no stable key,
so a layout with two placeholders in the same role cannot promise which one a
slide came from.

Crumb to `slide-deck-editor.deck`. Routes to `slide-deck-editor.speaker-notes` and
`slide-deck-editor.layout`.

### speaker-notes

One slide's speaker notes, on their own: the text, and one sentence about what
they are.

This lens is the editor. The slide lens shows the same paragraph and routes here
to change it.

The note under the text is there because the editing experience misleads: notes
use the same block editor as everything else and never appear on the slide
canvas. The editor is what makes them feel like slide content; they are not.

Crumb to `slide-deck-editor.slide`.

### text-block

The text inside an element: the ordinary content object, the same kind of thing
the document editor edits. The text, the named style it wears and its alignment,
its marks, any inline formulas in it, and Ancestry, shut.

Same content object as `text-block-document`, different housing, and the
differences follow from that. Here the block is inside an element, so the crumb
names the element and not the resource; the style is a link into the deck's
theme rather than the document's style list; alignment is a choice on the block
itself; and marks live on this lens rather than on a separate range lens,
because a deck has no text-selection lens. What the document version has and
this does not is variant and block spacing — a deck block is not a paragraph in
a flow.

Inline formulas are listed with the expression set in mono even inside a row,
because an expression is a thing you retype.

The element around it is a separate lens and the separation is the point: frame,
rotation and overflow belong to the box, text, style and marks to the block.
Nothing spatial appears here, which is why Ancestry exists at the bottom — to
say that once, rather than leaving a reader to wonder where the width went.

Crumb to `slide-deck-editor.element`. Routes to `slide-deck-editor.named-style` from the
style, and to `analysis.variable` from an inline formula.

### theme

The deck's theme: one background, one type family, four named colours, and what
it costs to change any of them.

Usage is the band that says what an edit costs — one theme per deck, and
everything that does not override it inherits it, so the counts of slides and
layouts are the price of any change above. The swatches are painted from
semantic tokens carried on the colour itself, so they are the same four values
the rest of the product uses rather than four literals kept in step by hand.

Two gaps. Only a solid background exists, and the Kind field implies otherwise;
whether an image or a gradient background is a thing has not been decided. And a
theme colour has a name and no role, so nothing on a slide can ask for *the
accent* — every use of one is a literal that will not follow a change made here.

Crumb to `slide-deck-editor.deck`.

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

**Nothing mints an identifier.** New slide, duplicate slide, new layout,
duplicate layout — all four are drawn and inert, each carrying its reason. The
question underneath is one question: duplicating a thing has to mint fresh ids
for it and for everything identified inside it, or two copies share ids. Until
that is settled the controls are shown as unavailable rather than hidden, so
nobody goes looking for them elsewhere.

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

- **No group on a slide.** Grouping is offered on a multi-selection and dark
  behind it, because either a group survives a reload or it is a selection
  convenience, and that has not been decided.

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
