# Overview

## What the subject is

Ten panels, one per category, each the entry its rail opens on. They are not a
family of similar things: what they have in common is a position. Every other
panel in the tree lists something or reads one thing closely; these say *what
this category is about, what state it is in, and what is outstanding* — and then
hand off to the panels and lenses that do the work. Nine of them are headed
**Overview** and are read as the category's own summary; the Agents one is headed
with its category's name, because in that category the summary is of a population
rather than of a subject.

They fall into four groups, and the group is what tells you what to expect.

**One thing, described** — Document, Deck, Spreadsheet, Context, Research,
Analysis, and the authoring half of Templates. Each is the identity band of a
single record: what it is called, a few counts, whether it is saved, who made it.
Seven of the ten are this shape, and the three resource editors are near-siblings
of each other — same bands, in the same order, differing only in the counts a
document, a deck and a grid can honestly report.

**A whole category's state** — Project and Agents. These describe no one record.
Project answers *where am I and what is outstanding*; Agents answers *what is
running right now*, in a category whose subject changes under you while you read
it. Both are the only place their category states the whole of its situation.

**A map** — the library half of Templates: what a template is, how many this
project has by kind, and what is selected.

Three things run through all ten and are worth saying once. **Nothing here
writes**: every editable field — a project's name and description, a Context's
name and description, four titles, a template's name — is held in the panel, on
the standing rule that an edit which plainly stays put is better than one that
appears to take and vanishes on the next read. **Nothing here lists**: these are
fields, a state chip, and at most a handful of rows, because the lists are the
rest of each rail. And **the identity band is never a section**: a collapsible
over the name of the thing you are looking at would let a reader hide the one
thing that says which thing it is. Everything that qualifies it below is
disclosable; the name is not.

## Project

The project itself, and the resting state of the whole application: it answers
where you are and what is outstanding before anything has been clicked. Name and
description are editable in place; then State, Here now, Needs you, and Dates.

State carries the status as a chip, your own role, the membership count, and how
much work the project holds. **Project work counts the same query the centre
table lists** rather than a stored total, so the number beside it and the rows in
the table can never disagree.

Here now is presence and only presence — the people who are somewhere, not the
people who were recently. With nobody else in the project it says so rather than
drawing an empty band, and the overflow opens the roster.

**Needs you is the point of the panel, and it admits two kinds of interruption
and no third**: somebody addressed you, or something is broken. Everything else
the project is doing belongs in Activity, which is the panel with no judgment in
it. The mentions row is a count and selects the Mentions panel. Each broken thing
opens as what it actually is — a connector as a connector, a file whose
extraction failed as a file, a rule as an Automation — rather than as a generic
health row that would then need a second click to become useful. It is the same
set of broken rules the Agents category's Health view reads as one list, seen here
as the two or three that need somebody today.

What it deliberately does not do: nothing records which mentions you have read,
so every mention addressed to you is counted as unread. It is the count without
the marker behind it.

Dates arrives shut and says only dates: the project stores no updated stamp, so
the newest recorded event stands in for one, and it records neither a creator nor
an updater, so there is no *by* line to draw.

**There is no Settings control here or anywhere on the screen**, and that is
deliberate rather than pending: settings belong in a top bar that is not built,
and a button with nowhere to go is the one thing on a panel that teaches a reader
not to trust the others. The project lens in the inspector is where a Settings
control appears; this panel does not draw a second one.

Routes to `collaboration.person` from a face, `collaboration.people` from the
overflow, `project.connector`, `project.file` or `agents.automation` from a
broken row, and selects `project.mentions`.

## Agents

What is running right now and what is standing by. The orientation panel for a
category whose subject changes under you — a task finishes while you are reading a
persona — so the figures are the state of the whole category rather than of
whatever the centre happens to be showing, and they stay put while you move
between Personas, Tasks, Automations and Health.

Three figures across the top: Running, Failed, Personas. Waiting is counted
inside Running, on the same reading the Persona's Work view takes — a task
blocked on an input has been dispatched and has not finished, which is the same
situation for the person looking at it.

**Running comes first and Failed second.** A finished task is a result you go and
read; a failed one is a thing to decide about, and the panel that orients you
should say so before it says how much has gone well. Done is not here at all.
Failed is not drawn when nothing has failed — unlike the Health view, where an
empty group stays on screen to say that nothing is in that state. Automations on
arrives shut and is summarised by each rule's trigger, because that is what tells
two rules apart that both ask an agent for something.

Like the Agents category's Tasks panel, this one navigates rather than inspects:
choosing a running or failed task lands the centre on it, choosing a rule lands
the centre on the rule, and the two actions land the centre on a new persona or a
new Automation. Nothing here opens a lens.

What it deliberately does not do: it reports nothing about what an Automation
produced. An Automation is a task with a trigger — its runs are tasks, and the
task is what carries the results — so a rule's row says what fires it and stops
there.

## Document

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

Routes to `collaboration.person`.

## Deck

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

Routes to `collaboration.person`.

## Spreadsheet

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

## Context

This Context: what it is, what it resolves to right now, and whether it is saved.
Name and description are editable in place and held there, exactly as they are on
the Context lens.

**The two numbers under *Right now* are the point.** Two hundred and eleven
resources of which eighty-eight are retrievable is a very different scope from
two hundred and eleven of which all are retrievable, so contained and retrievable
are separate rows rather than one total. Beside them, when the rule was last
worked out — which is read off the record a search carries, because that is the
only place the time of a resolve is kept, and it reads *not yet* until a search
has run. The band closes on the fact the whole Context vocabulary rests on: a
Context is a rule, not a list, and a document created tomorrow that fits the rule
is in it without anyone editing this.

Saved is a chip that says either the revision it is at or how many changes are
unsaved, drawn as attention when there are any — because other things read this
Context, and what is set up and what is saved stay two visible states.

Used by arrives shut and is one row per kind of consumer with a count, each
opening the Used by view, which holds the rows themselves. Its gap is the
subject's standing one: only consumers that can be queried truthfully are
counted, and with no universal reverse index this list can never claim to be
complete.

**Delete is drawn and disabled rather than hidden, because the reason is the
interesting part** — there is no reverse-dependency query that could say what
deleting this would break, and the control carries that sentence. Duplicate sits
beside it and opens the Context lens rather than making a copy.

Routes to `scope.context` from Duplicate, and selects `scope.used-by`.

## Research

The thread: what it is for, who is asking, what it can see, what it has produced.
The first entry in the rail and the default, so it answers *what is this line of
enquiry* before you read any single turn.

Title, editable; the job; what it is anchored to, where there is an anchor; and
how many turns it has taken. The anchor is drawn only when the thread has one — a
Discover thread has no anchor at all, and an absent anchor is not an empty one —
and following it opens a hypothesis when the thread is a Hypothesis thread and a
question otherwise, on the rule the Research thread lens keeps: the anchor's
reference *is* its identifier, so the mode decides which lens it opens.

Asking names the agent as an actor row into its profile, and states the rule: the
agent is set once for the whole thread and there is no per-turn switch. **It is
also the one place the product says why this category has no Copilot** — the thread
already is a conversation with an agent, so a second composer floating over it
would be two ways to say the same thing.

Looking in is the scope as a row reading so many of so many retrievable, opening
the thread's Context panel; and the web as its own row when it is on, saying it
is used when a turn asks for it. The web is a second place to look rather than a
resource in the set, which is why it is a row of its own and not folded into a
total.

Produced is accepted, proposed, and sources used. It is a section rather than a
footnote because it is what a thread is for. Its gap: a proposed finding has no
state in the model, so proposed, accepted and dismissed have to exist before that
count can be real.

Attribution arrives shut: who started it, as a link where the name resolves, and
when it last moved.

New thread sits in the actions row. A new enquiry is a new tab rather than a
state of this one, so it opens rather than selecting a context — and since
nothing creates a thread, it opens a real thread the category is not already
holding rather than minting an id that would put a tab in the strip nothing can
answer for.

Routes to `research.hypothesis` or `research.question` from the anchor,
`agents.persona` from the agent, `collaboration.person` from the author, and
selects `research.context`.

## Analysis

The analysis itself: what it is called, whether it is saved, what it last
produced. One field — the title, editable and held here — and then three bands.

Under the title sits a gap rather than a field: the record has no description, so
the reason for the chart has nowhere to live. A chart needs one more than most
things do, because the title says what is plotted and a description says why, and
stating the absence is better than drawing an empty box for it.

Saved carries the state and the revision together, with a sentence about what
saving is: a check against the revision it started from, with undo covering
unsaved builder actions only. There is no history of changes behind it.

Result is rows kept of rows there were, the limit, and when it was evaluated.
Both numbers, always — a limit that does not bite still leaves a bare figure
reading as the whole answer. **Result describes a run rather than a definition**:
nothing about a result is stored, so this describes the most recent evaluation
and nothing before it.

Run again sits in the actions row as the panel's primary control, and it asks for
a fresh evaluation and saves nothing. It is the only control in the Analysis
subject that runs anything — every other panel there reads the definition, moves
a local choice, and waits.

Attribution arrives shut and says who last changed it; there is no creator on the
record.

Routes to `collaboration.person`.

## Templates library

What a template is, what this project has, and what is selected. The panel opens
on the sentence that explains the whole authoring category: **a template is an
ordinary body with some of it left open**, so authoring one is authoring a
document, a deck, a slide or a spreadsheet, and there is no separate template
editor. Everything on the authoring subscreen follows from that.

In this project is a total and then one count per kind — Documents, Slide decks,
Single slides, Spreadsheets. **The counts are by kind rather than one total**,
because the fastest way to notice this project has no deck template is a zero
beside Slide decks; and the plural has to say which kind it means, since a single
slide is not a deck.

From outside this project is a separate count, kept apart from the project's own
on purpose. A shared or personal template can be used here, and who may edit one
is a deployment rule the model does not carry — the same thing the Personas list
says about a global persona — so the panel counts them and claims nothing about
them.

Selected is the chosen template's name, what it makes, and what it asks for, read
as so many required of so many. Open opens the template lens. Use is primary and
disabled, and the reason on it is the one the instantiation form itself gives
rather than a guess made here: nothing in a body records which variable it stands
for, so a supplied value would have nowhere to go.

New template sits in the actions row, because making a template is an act of the
map rather than of any one title — what you can add belongs beside the counts
that say how much there already is. There is no kind picker yet, so it lands on a
blank document rather than asking what to make first; the library's own
template-kinds panel is where a target is chosen deliberately.

Routes to `library.template` from Open and `library.use-template` from Use.

## Templates authoring

The template being authored: what it makes, what it asks for, whether it is
saved. The other half of the pair — the library panel is the map, this one is the
thing on the bench, and the Back control in the actions row is the seam between
them. Where the library is is handed in by whatever holds the panel rather than
decided here.

Name, editable and held here; then the kind, who it is available to, and how many
variables it asks for. **Kind is a fact, not a field.** What a template makes is
fixed when it is created — changing it would mean converting the body, which is
not modelled — so it is shown with that said on the face of it rather than
offered as a choice.

Saved is a chip and a sentence. A template keeps its body inside itself and saves
as one thing, checked against the revision it started from, and that is the one
way saving a template differs from saving a document.

Attribution arrives shut: the creator as a link where the name resolves, and when
it was updated.

Routes to `collaboration.person`.

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

**Nothing is deleted.** Only the Context overview draws a Delete at all, disabled
and carrying its reason: the same missing reverse-dependency query that gates
deletion everywhere else in the tree.

**Presence is only presence.** Two of the three resource overviews and the
project overview carry it, and all three record the same limit — it names the
resource somebody is in and nothing about where inside it, so a page, a slide or
a cell is never claimed.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.
