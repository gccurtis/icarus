# Resource

These are the lenses the inspector shows while you are inside a resource — a
document, a deck, a spreadsheet. Between them they answer one question: what is
the thing I have selected, what does it belong to, what can I change about it
here, and where is the lens that owns what I cannot change here. They are the
whole of the editing surface, because none of the three editors has a toolbar:
if a property can be set, it is set in one of these panels, and if it cannot,
one of these panels says why.

The subject splits three ways, by resource kind, and it mirrors the context
stack: for every kind there is a lens for the resource itself, a lens for each
kind of thing you can select inside it, and a lens for one named style of that
kind. The resource lens is what the editor opens with and what it falls back to
when nothing is selected — those three (`document`, `deck`, `spreadsheet`) are
the only lenses with no crumb trail, because a trail with one entry is a heading
drawn twice, and each of them carries a "nothing selected" band that says what
clicking something would offer. That band is the compensation for having no
toolbar, and all three make it.

Three families run across the kinds, and the family is the point rather than the
member:

- **The named styles** — `named-style-document`, `named-style-deck`,
  `named-style-sheet`. One lens shape: this style's fields, edited once, and a
  shut Usage band carrying the count of things wearing it. The count is the
  price of the edit above, which is why it is a number on the header and not a
  list.
- **The text blocks** — `text-block-document` and `text-block-deck`. The same
  content object in two housings: in a document a block sits in the body flow, in
  a deck it sits inside an element that owns the box around it.
- **The spreadsheet selection** — `cell`, `cell-with-formula`, `error-cell`,
  `spill`, `range`. One vocabulary for what you have picked on the grid, split by
  what is actually under the pointer: a literal value, an expression, an
  expression that will not resolve, a coordinate filled from somewhere else, or a
  block of several. A cell's identity is its A1 address, which is why there is no
  row lens and no column lens anywhere on the screen — rows and columns are not
  identified things.

**Where each edit lives.** The rule the subject keeps is that one piece of text
or one setting has exactly one writable copy, and every other lens showing it
shows it and routes to the owner. Two writable copies is how one of them quietly
wins.

- Speaker notes are owned by `speaker-notes`. The slide lens shows the same
  paragraph, because the canvas carries none of it, and routes here to change it.
- Family, size, line spacing and paragraph spacing are owned by the named style.
  `text-selection` shows which style a range wears and routes to it; a local
  override on the range would quietly disagree with the style around it.
- Block variant, block alignment and the space around a block are owned by
  `text-block-document`; marks belong to a range and are owned by
  `text-selection`.
- Page numbering, paper and gutters are owned by the Page view in the context
  stack. `footer` and `document` mirror them read-only and route there.
- The spatial box is owned by `element`; what is inside it is owned by
  `text-block-deck`. The element lens shows what it holds and hands editing over
  rather than offering a second text field.
- A cell's stored content is owned by `cell`, an expression by
  `cell-with-formula`. There is no formula bar anywhere — that is the trade, and
  it is why the expression band is stacked across the whole panel and set to
  wrap.
- Layout-owned content is owned by `locked-element`, and only inside the layout
  subscreen. On a slide the same object draws and is not selectable at all.

Two more conventions hold across the whole subject. A band that is context
rather than the reason you opened the lens arrives shut — usage counts, feeds,
placement, attribution, box format. And a destructive action is last, behind a
rule, never in the row beside the harmless ones.

## document

The document itself, and what the editor shows before you click anything. Four
bands: what this document is (title, pages, words, saved), what to do next, how
the page is set up, and who made it.

The second band is a single sentence and it is the whole toolbar: it names the
four things worth clicking — a block, a formula, the header, the footer — and
says where new content comes from, because on an empty page none of that is
visible. Page setup is a summary of paper, orientation and gutters with the four
margins on one line and the unit said once; it says outright that it is a
summary and points at the view that writes them. Attribution shows the creator
as a face where the stored name resolves to a person in the cast and as plain
text where it does not.

No crumb trail: this is the outermost thing there is.

Routes to the context stack for `resource.insert-document` and `resource.page`,
and to `collaboration.person` from the creator.

## header

The header band, on any page. A content field, then spacing, then the first-page
exception.

Height sits beside the editable distance from the top and is not editable: it is
measured from the content, and a field you can type into that silently loses
what you set is worse than a fact. The first-page content only appears when the
switch saying the first page differs is on — a second header shown next to an
off switch is a value with no effect, and a reader cannot tell which of the two
is on the page.

The lens closes with a footnote rather than a band: there is one header, and
what appears on every page is a read-only projection of that one state. You are
never editing the header on page 3. It is said because the header is visibly
repeated and repetition suggests independent copies.

Crumb to `resource.document`.

## footer

The footer band and the page number in it. Content, then the page number
settings, then spacing, shut.

The content is set in mono and carries `{page}`, never a number: the number is
generated from the numbering settings, so what you edit is a string you would
retype exactly, and the panel says where the generated number falls.

The numbering settings — position, start at, show on first — are shown here and
not editable. They are owned by the Page view, and two editable copies of one
setting are two settings that will disagree. What the panel cannot say is which
of the two is authoritative; that is unsettled, and it is recorded next to the
mirror rather than hidden.

Crumb to `resource.document`; the numbering note routes to the context view
`resource.page`.

## text-block-document

A whole block of the document body — a paragraph, a heading, a list — selected
as a block rather than as text inside it. It opens with the block's own text
quoted, so a reader can tell which of six paragraphs they have.

Bands in order: Variant, which changes what the block means rather than how it
looks; Block format, which is alignment and the space before and after; and a
shut Placement band giving the row position and the page. The page is labelled
computed and the panel says why: it is a label for where this block currently
falls, not an address, and it moves when paper or gutters change.

Line spacing is deliberately absent. It is set on the named style, which is what
makes it the same everywhere the style is used. Space after is the one that
leaks: the named style carries it too, and which wins — and whether the block's
value should be marked as an override — is unsettled.

The variant and alignment sets are read off the block's own types rather than
listed by hand, so the control and the model stay in step.

Crumb to `resource.document`.

## text-selection

A range of text inside one block. This is the most common selection in the
editor, and the reason its formatting is read in a side panel rather than off a
toolbar floating over the words it is about to change.

The selected text is quoted at the top; offsets and atom counts are internals
and are not shown, because what you selected is the useful confirmation, not
where it starts. Then Marks — the on/off ones, several at once — with the two
things a selection can *become* sitting under them rather than beside them: a
link, or a comment thread anchored to the range. Then Text style: which named
style this range wears, and how many characters the selection covers.

Family, size and spacing are not offered here. They belong to the style, and the
band says so — changing one from here edits the style and every block using it.

Crumbs to `resource.document` and `resource.text-block-document`. Routes to
`resource.named-style-document` from the style name, `resource.link` from Add
link, and `collaboration.comment` from Comment.

## link

A link mark on a selection: the URL, the text it is on, and whether the target
is a resource in this project or a website. The target and the text are shown
together on purpose, so a link whose text misleads is visible as such.

Open and Copy sit in the panel's own actions row — what a panel offers belongs
above what it lists. Remove is last and behind a rule, because a destructive
action set beside two harmless ones is a misclick waiting to happen. Removing
the mark leaves the text selected, so the lens hands the inspector back to the
selection the mark was on.

What is unsettled: an internal link to another resource is a different thing
from a URL, and whether both are the same mark has not been decided.

Crumbs to `resource.document` and `resource.text-selection`. An internal target
opens `project.resource`; an external one opens a browser tab. Remove routes to
`resource.text-selection`.

## formula

A formula inside running text. On the page it reads as ordinary prose and
nothing about it pops out of the document, so everything you might want to know
about it is here instead: what it shows, the expression, what the value is and
when it is read, and the display format, shut.

There is no refresh and no stale marker anywhere on the lens. A formula reads
its value when it runs, so what is on the page is what the variable holds; a
control offering to bring it up to date would be offering to fix a state that
cannot happen. The panel says that in words rather than leaving the absence to
be noticed.

The display format language is shared with the spreadsheet, and it has to stay
one language — otherwise the same number formats one way in a document and
another in a grid.

Crumb to `resource.document`. Open variable routes to `analysis.variable`.

## table

A table in the document body: rows, columns, and the proportional column widths.
A document table is content, not a grid — no addresses, no formulas, no
calculation, and nothing on the lens pretends otherwise.

Insert row and Insert column are in the panel's actions row and both append at
the end. Inserting relative to a selected cell would need cell selection, and
this lens does not have it, so the panel adds at the end and says so rather than
implying a position it cannot know. Adding a column redistributes every width,
so the stored distribution is replaced by a sentence saying it was
redistributed: the stored numbers describe the stored columns and no others.

The shut Structure band lists the header row and the body row count, and records
the gap: the body model has no header-row flag. Styling the first row
differently is not the same as declaring it a header, and only a declaration
survives a page break.

Delete is last, behind a rule, and routes to `resource.document` — the table it
was about is gone. Crumb to `resource.document`.

## prompt-block

A block of the document body whose content is generated rather than typed. On
the page it reads as ordinary prose, because a document is stable and things do
not pop out of it, so everything that distinguishes it is on this lens: the
instruction, the output, what the block could look at when it ran, and how it
was run.

The output is quoted in the one tone the product reserves for generated rather
than authored content — that distinction is carried in exactly one place and
this is it. Run again shows progress in the same tone. Scope is a single row
naming what the block could see and how much that resolved to.

There is no stale badge and no "last generated" warning. The block runs when the
document is opened, so what is on the page was generated against the project as
it is now; provenance says how it was run, and nothing needs to say it has
fallen behind.

Copy out is not a clipboard copy. It takes the generated paragraph out of the
block and makes it ordinary text, which is why it hands the inspector to
`resource.text-block-document`: what you are looking at afterwards is a text
block.

Crumb to `resource.document`. Scope routes to `scope.context`.

## named-style-document

One named text style — its typography and its spacing, edited once for
everywhere it is used. Editing a style changes every block using it; that is the
point of a style and the risk of one.

Identity first (name, and what it is based on), then Typography — family, size,
line height, weight — then Spacing, shut, then Usage, shut. Every field is
editable: a style is not a description of blocks that already look this way.

The usage count sits on the Usage header rather than in a band of its own, so it
is legible while the section is shut. That answers the part that mattered — how
much this edit affects is visible *before* the edit — without a second band
competing with identity.

The crumb trail mixes two destinations on purpose. A style is reached from the
Styles context view, so that crumb selects a context (`resource.styles-document`);
the document crumb inspects (`resource.document`). The trail says where the style
sits, and where it sits is in both.

## deck

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

## slide

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

Crumb to `resource.deck`. Routes to `resource.speaker-notes` and
`resource.layout`.

## speaker-notes

One slide's speaker notes, on their own: the text, and one sentence about what
they are.

This lens is the editor. The slide lens shows the same paragraph and routes here
to change it.

The note under the text is there because the editing experience misleads: notes
use the same block editor as everything else and never appear on the slide
canvas. The editor is what makes them feel like slide content; they are not.

Crumb to `resource.slide`.

## element

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

Crumb to `resource.slide`. Edit text routes to `resource.text-block-deck`.

## text-block-deck

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

Crumb to `resource.element`. Routes to `resource.named-style-deck` from the
style, and to `analysis.variable` from an inline formula.

## multi-selection

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

Crumb to `resource.slide`. Each member row routes to `resource.element`.

## layout

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

Crumb to `resource.deck`; Done routes there too.

## placeholder

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

Crumb to `resource.layout`.

## locked-element

Content the layout owns and a slide cannot touch — a footer wordmark, a slide
number. The content, the frame with its owner, and one sentence about editing.

The content is editable *because this lens exists only in the layout subscreen*.
On a slide the same object is visible and inert, and there it is not selectable
at all. The crumb names the layout rather than a slide, so where you are is
answered before you try to type.

The owner chip is the point of the frame band: the frame belongs to the layout,
every slide on that layout draws this, and none of them can change it.

Crumb to `resource.layout`.

## theme

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

Crumb to `resource.deck`.

## named-style-deck

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

Crumb to `resource.theme`.

## spreadsheet

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

## cell

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

Crumb to `resource.spreadsheet`. Routes to `resource.named-style-sheet` from the
style, and to `resource.cell-with-formula` from a spill origin that is not this
cell.

## cell-with-formula

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

Crumb to `resource.spreadsheet`. Routes to `resource.cell`,
`resource.cell-with-formula`, `resource.spill` and `resource.named-range` from
references, and to `resource.named-style-sheet` from the style.

## error-cell

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

Clear cell is last and behind a rule. It routes to `resource.spreadsheet`,
because a cleared coordinate holds nothing to inspect. Crumb to
`resource.spreadsheet`.

## spill

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

Crumb to `resource.spreadsheet`. The origin routes to
`resource.cell-with-formula`.

## range

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

Crumb to `resource.spreadsheet`. Merge routes to `resource.cell` at the anchor,
the first cell of the range.

## named-range

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

Crumb to `resource.spreadsheet`. The range routes to `resource.range`.

## chart

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

Crumb to `resource.spreadsheet`. The source range routes to `resource.range`.

## named-style-sheet

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

Crumb to `resource.spreadsheet`.

## What is not here

- **No row lens and no column lens.** A cell's identity is its A1 address, and
  rows and columns are not identified objects. Everything the grid offers is
  addressed as a cell or a range.
- **No merge.** The range lens offers Merge and the cell lens has a band for
  merge membership, but merge membership is not in the model, so the band
  answers spill only and the action lands on the anchor cell.
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
- **The Page view owns the page.** Paper, gutters and numbering are mirrored on
  the document and footer lenses and edited in the context stack. Which of the
  two mirrors is authoritative for numbering is the one piece of that split that
  is still unsettled.
