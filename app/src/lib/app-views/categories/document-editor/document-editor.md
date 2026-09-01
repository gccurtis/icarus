# Document Editor

Lives at `src/lib/app-views/categories/document-editor/document-editor.md`.

One document, keyed by `resourceId`. Two documents are two tabs.

| Content | Shows |
| --- | --- |
| [`document.svelte`](content/document.svelte) | The page, edge to edge |

One region and one track. A rich-text editor is not a composition of panels,
and drawing it as one would describe something this is not.

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

Chips are Document, Page *n*, and Selection, and they sit above both bands rather
than inside either: they narrow what is being talked about, and open and resolved
are the same conversation in two states.

**The page chip is a computed filter, not a stored one.** A comment is anchored
to text and has no idea what page it is on; the layout decides that. So the chip
reads the page off the block the selection is in and matches comments whose
anchor lands on the same one. It relabels itself when the layout moves, which is
the honest way to draw a number that is not an address.

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

The title picks a side on a question the other two leave open: **"Available to
prompt blocks"** means every saved Context is listed, and each row says whether a
block in this document uses it. Listing only what is already used would leave no
way to see one you could assign.

A second band, shut on arrival, is a resolved preview: a *sample* rather than the
set, because the resolve is bounded, so the count reads "of 96" and never claims
those four are all of it. It arrives shut because the question it answers — has
this scope drifted — is asked before a run, not on every visit. Its rows route to
`context-editor.resolved-resource`.

### find

Search inside the open resource. It is a rail panel rather than a dialog, so it
never covers the text it is searching and never has to be dismissed to read a
hit. In all three kinds the search field *contains* its results rather than
sitting above them, so what the query is scoped to is answered by the shape of
the panel rather than by a convention someone has to remember. Every hit says
where it came from before it says anything else.

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

Routes to `document-editor.text-block` for authored hits and
`document-editor.prompt-block` for generated ones.

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

Four bands: Basics, Content, Data and AI, then Structure. The first three arrive
open; Structure arrives shut, because it is layout rather than content.

Formula, Prompt block and Variable sit one row apart in Data and AI and are three
different acts, so the note on each row says which it is: an expression, a
generation, and a reference to a value the project already holds.

Text, heading, list and checklist route to `document-editor.text-block`, a
table to `document-editor.table`, formula and variable to `document-editor.formula` — a
variable reads as live text in the body, which is the inline formula lens —
and a prompt block to `document-editor.prompt-block`. Image, embed, divider, page break
and side-by-side name no lens of their own, so they fall through to the block
they insert.

### navigator

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

Headings route to `document-editor.text-block`; a page and a page break both
land on `document-editor.document`, which is where page setup is; the header and footer
route to `document-editor.header` and `document-editor.footer`.

---

### overview

The document as a whole: what it is, who is in it, whether it is safe. The first
entry in the rail, and where the document's identity lives, because the editor
carries no header bar across its top — the page is the page.

The title is editable in place; beside it the kind, the page count and the word
count. Pages are a property of the current layout rather than something stored,
so the count moves with paper and gutters — the same reason the Navigator calls a
page number a label and never an address.

Editing now is the presence band, each person opening their profile, saying
plainly when nobody else has it open. Its gap: presence names the resource
someone is in and nothing about where inside it, because a position on a page is
not modelled.

**Saved is a chip, not a control.** The editor owns saving; this reports it in
the shell's shared save language, so the word means the same thing on every
screen.

From template arrives shut and is a band with nothing in it: a document records
no template origin, so where it came from cannot be shown. It stays as a band
rather than being dropped, because the answer will go here when there is one —
and it is provenance either way, since later edits to a template never reach a
document made from it and there would be nothing to follow or refresh.

Attribution arrives shut: the creator, drawn as a link where the stored name
resolves to somebody in the project and as plain text where it does not, then
when it was updated. There is no creation timestamp on the record, so Created is
absent rather than guessed.

Routes to `general.person`.

### page

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

Family, size, indentation and line spacing all live on a named style and never as
a selection-local override, so this is the whole set of answers the document has
about how its text looks. A row is a name and the typography in shorthand, which
is enough to tell two apart; everything else is the lens's business. Routes to
`document-editor.named-style`.

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

### document

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

Routes to the context stack for `document-editor.insert` and `document-editor.page`,
and to `general.person` from the creator.

### footer

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

Crumb to `document-editor.document`; the numbering note routes to the context view
`document-editor.page`.

### formula

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

Crumb to `document-editor.document`. Open variable routes to `analysis.variable`.

### header

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

Crumb to `document-editor.document`.

### link

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

Crumbs to `document-editor.document` and `document-editor.text-selection`. An internal target
opens `project-overview.resource`; an external one opens a browser tab. Remove routes to
`document-editor.text-selection`.

### named-style

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
Styles context view, so that crumb selects a context (`document-editor.styles`);
the document crumb inspects (`document-editor.document`). The trail says where the style
sits, and where it sits is in both.

### prompt-block

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
`document-editor.text-block`: what you are looking at afterwards is a text
block.

Crumb to `document-editor.document`. Scope routes to `context-editor.context`.

### table

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

Delete is last, behind a rule, and routes to `document-editor.document` — the table it
was about is gone. Crumb to `document-editor.document`.

### text-block

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

Crumb to `document-editor.document`.

### text-selection

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

Crumbs to `document-editor.document` and `document-editor.text-block`. Routes to
`document-editor.named-style` from the style name, `document-editor.link` from Add
link, and `general.comment` from Comment.

## What is not here

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**No template origin, three times.** The document, the deck and the spreadsheet
each carry a From template band with nothing in it and a sentence saying why. The
band stays because that is where the answer goes; dropping it would hide the gap
rather than record it.

**Attribution is thin, and thin differently on each panel.** The project records
neither a creator nor an updater and says its dates are dates only. A document
and a template record a creator and no creation time. An analysis records who
last changed it and no creator at all. Each panel says which half it has instead
of drawing an empty pair, and none of them guesses.

**Presence is only presence.** Two of the three resource overviews and the
project overview carry it, and all three record the same limit — it names the
resource somebody is in and nothing about where inside it, so a page, a slide or
a cell is never claimed.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

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

- **Nothing writes yet.** Every edit on every lens is held in the panel until
  there is something to write it back to. The visible consequence is the dark
  buttons: duplicating a slide or a layout, minting a new slide, resetting to a
  layout. Where an action would mint identified objects the panel says so in the
  button's own words rather than failing later.

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
