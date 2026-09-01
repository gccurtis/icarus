# Project Overview

Lives at `src/lib/app-views/categories/project-overview/project-overview.md`.

Where a project is answered for as a whole: what is in it, who is in it, what
changed and what is waiting. A singleton — one tab per project, always open.

| Content | Shows |
| --- | --- |
| [`overview.svelte`](content/overview.svelte) | The bands, and the work table under them |

Its rail is the widest in the system, because every kind of thing a project
accumulates has an index here and nowhere else.

This category never scrolls. A view you have to scroll is a view you cannot
take in at a glance, which is the only thing this one is for.

## Context

These are the context panels for a project: the standing lists a person reads
down the side of a project category. Together they answer *what is in this project
and what has been happening in it* — and they answer it without ever leaving the
category, because every row opens its subject in the inspector rather than
navigating somewhere. That is the property the whole subject is built on: you can
look through eight resources, three people and a task without losing the place
you were working.

The nine panels fall into three groups.

**What the project holds** — Resources, Contexts, Templates, Variables. Each is
an inventory of one kind of thing, grouped by the first question a person asks
about that thing: what a resource *is*, what a template *makes*, whether a
variable has rows or holds a value or gets called.

**Who and what acts here** — People and Tasks. People is everything that can
appear as "who did this", person or not. Tasks is the work those actors are
running.

**What has happened** — Activity, Mentions and History. These three overlap on
purpose. Activity is the record with no judgment in it. Mentions is only what a
person addressed to you. History is the two of them in one panel, with what was
addressed to you above the record. Both arrangements exist and a category carries
one or the other — the merge, or the pair — never all three.

Four panels offer a way out to a full category, always as a control in the panel's
own header rather than a footer: a control under a list of unbounded length is a
control nobody reaches. Each stays disabled until whatever holds the panel hands
it somewhere to go — routing out is not something a panel decides for itself.

### activity

Everything an actor did in this project, newest first, with no judgment in it.
Whether something matters is what Mentions is for; whether something is broken is
a separate question this panel does not try to answer.

The controls come before the record, in order: a search field over the whole
record, a row of chips for when, then two listboxes for actor and target. The
chips and the listboxes are different controls for a reason — a when has four
values, but an actor list and a target list are as long as the project is, and
chips at that length wrap into a wall standing above the thing they narrow.

The window starts at *any time* rather than at Today. The layout puts the earlier
days on the screen, and a panel that opened on Today would draw them empty on a
quiet morning. Picking Today narrows to it.

The bands are Today, Yesterday and Earlier, with Today open. A day with nothing
in it is not drawn.

Each row reads as a sentence — who, what, to what — and the row itself is not a
button, because it holds two. The actor's name is the way to who did it and the
target's name is the way to the event itself, and a button inside a button is
neither of those.

What it deliberately does not do: there is no digest row. A day of many events
collapsing into one line needs a threshold to collapse at, and nothing decides
that threshold yet. The narrowing also belongs to the query rather than to the
panel: applied over a page of rows instead of the whole record, a filter counts
what it can see rather than what there is, and reports a wrong number
confidently.

Routes to `project-overview.activity` for the event, and — following the actor's name,
since the record stores an actor as a display name —
`general.person`, `agents.persona` or `project-overview.connector`.

### contexts

The project's saved scopes, and what each of them resolves to *now*. A Context is
a live rule rather than a stored list, which is why the count beside each name is
the whole point of the row: it is the only thing that says whether the rule still
means what it meant when it was written. One band, Saved Contexts, under a search
field.

A Context that resolves to nothing is drawn as a warning, and the note at the
foot says why: a rule with no members widens retrieval to the whole project
instead of restricting it to nothing, which is the opposite of what its author
asked for. Those Contexts are blocked from dispatch. The warning stands in for a
distinction the data cannot yet make — there is no way to record that an author
*meant* an empty scope, so an empty result and a deliberate emptiness look the
same and both get the warning.

What it deliberately does not do: it does not edit a rule. That happens on the
Context category, and the header control is the way there.

Routes to `context-editor.context`.

### contexts-library

Headed *Contexts*. Every saved scope in the project: its rule, and how many
things that rule currently resolves to. New, Open and Duplicate in the action
row, the last two dead until a row is chosen.

A Context is a rule rather than a list, so the count beside each one is resolved
now and not stored. Zero is therefore a real answer, and the row says "matches
nothing" out loud and takes an attention tone, because a bare 0 beside a rule
reads as a count that has not loaded yet.

Routes to `context-editor.context`.

### history

What has happened here, with what was addressed to you first. One panel for the
two things Activity and Mentions cover separately, because they answer one
question asked in one breath: *what have I missed*. A mention is an event with
your name in it. Splitting them across two panels means checking two places to
find out whether anything needs you, and finding the same edit described twice.

The bands, in order: Addressed to you, open, with a toggle for including
resolved; then the when chips; then Today, Yesterday and Earlier over the
record, with Today open. One search field covers both halves.

Addressed to you is a **band, not a filter**. It sits above the record rather
than being a chip over it, because the whole reason it is separate is that it
does not compete with the record for attention — it wins.

Resolved is excluded by default. A resolved comment is a thing that happened, so
it stays in the record; it is not a thing that needs you, so it leaves this band
unless it is asked for.

The record half works exactly as Activity's does — the row is a sentence holding
two links, the actor to who did it and the target to the event. It carries no
actor or target listboxes; the merge is meant to be read down, not narrowed.

Routes to `general.comment` for a mention, `project-overview.activity` for an event,
and `general.person`, `agents.persona` or `project-overview.connector` for an actor.

### mentions

What a person addressed to you, and nothing else. Two bands: Unread, then Read,
which arrives shut.

A mention is the one thing worth interrupting for. That is why it leads a category
and why machine noise is kept out of it: a resource changing did not address you,
and belongs in Activity. Each row names the author and where the comment sits —
the resource, and the place inside it when there is one — and puts the excerpt on
the second line rather than behind a hover. What the mention actually asks for is
the whole reason to open it or leave it alone, and a decision that needs a hover
is a decision nobody makes.

What it deliberately does not do: the read marker is local to this panel. Nothing
stores a per-person marker, so opening a mention moves it into Read for as long
as the panel is up, and the two bands start over next time. It is the marker's
behaviour without the marker's memory.

Routes to `general.mention`.

### overview

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

Routes to `general.person` from a face, `general.people` from the
overflow, `project-overview.connector`, `project-overview.file` or `agents.automation` from a
broken row, and selects `project-overview.mentions`.

### people

Everything that can appear as "who did this" — whether or not it is a person.
Three bands: Here now, Everyone, and Agents and machinery. One search field over
all three, because an actor is looked for by name and which of the three they
turn out to be is the answer rather than the question. Here now is a subset of
Everyone and is not counted twice in the totals.

Personas, Automations and connectors share the third band because they share the
property the band is about: they can act with no person present. A Persona shows
its work count, because that is the thing that says whether one is in use.

What it deliberately does not do: the machinery it lists is the machinery that
has a reported problem. A reported problem is the only place an Automation or a
connector is named today, so the band is honest about the ones in trouble and
blind to the ones that are fine. And the note at the foot says the other thing
the band cannot offer: only a person can be written to. The rest act here, but
there is nowhere to address them.

Routes to `general.person` for a person, `agents.persona` for a Persona,
`agents.automation` for an Automation, and `project-overview.connector` for a connector.

### resources

Everything in the project, in five groups by what it is, with one search field
over all of them so a name is looked for without first having to decide which of
the five it is. A row shows the name, the date it last changed, and — when
something is wrong — what is wrong on the second line, drawn as attention.

The bands, in order: Documents, Slide decks, Spreadsheets, Findings, then Files
and connectors. Findings arrive shut. They are resources like any other,
retrievable anywhere in the project exactly as a document is, but they are read
through whatever cites them far more often than they are browsed, so the group
does not take up room until it is asked for.

Files and connectors share the last band because a connector is mostly
interesting as the source of its files. Connectors are named rather than
numbered, because unlike the files they bring in, they are actors as well as
sources.

What it deliberately does not do: it does not list resources whose kind has no
group here. A count of them sits at the foot saying how many are not shown,
rather than a sixth band called "Other" that would suggest the grouping is
complete.

Routes to `project-overview.file` for a file, `project-overview.connector` for a connector, and
`project-overview.resource` for everything else.

### tasks

Agent work in this project, in four bands by state: Waiting, Running, Failed, and
Recently completed. These are the same rows the Copilot shows, narrowed to this
project, and every one of them opens the Copilot's own task lens rather than a
second one.

The order is by what needs you first, not by time. Waiting leads because a
waiting task has stopped and cannot move without a person. Recently completed
arrives shut because it needs nobody.

What it deliberately does not do: a waiting row carries no Reply and no Resume.
Nothing records *why* a task is blocked or *who* can unblock it, and a control
that cannot say which of those two things it does is a control that guesses.

Routes to `general.copilot-task`. The header control opens the Agents category, where the
Personas doing this work are managed.

### templates

What is available here, grouped by what comes out of it: Documents, Slide decks,
Spreadsheets. Grouped that way because the first question about a template is
what it makes. Each row carries its scope and its variable count as one line,
because they are one decision — together they say whether the template can be
used at all.

What it deliberately does not do: a row opens a template and cannot instantiate
one. There is no Use control, because nothing in a body carries a variable key
yet; a Use that ran today would hand back a document with the keys still sitting
in it, which is worse than no Use.

A note at the foot counts the templates that make a single slide, which has no
group here yet.

Routes to `templates.template`. The header control opens the Templates category.

### variables and variables-create

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

These are the inspector lenses for a project and the things inside it: what the
right-hand side shows when a row somewhere is selected, and — for one of them —
what it shows when nothing is. Together they answer *what is this thing, who is
in it, where did it come from, and what does it touch*.

They split into three groups.

**The container.** One lens on the project itself. It is also the resting state
of the inspector: nothing selected is this lens rather than a blank panel, which
is why it needs nothing handed to it — there is one project.

**Things in the project.** A general lens for anything first-class, and two
specializations. The general one is about identity and relationships and nothing
else; the two specializations exist for the kinds whose whole interest is
external — where the bytes came from and whether anything can be read out of
them.

**A fact about the project.** One lens on a single recorded event, which is not a
thing you can open but a statement about something that was.

One boundary runs through the entire subject and is worth stating on its own:
**kind-specific detail belongs to the category that owns the kind.** The inspector
says what a resource is, who has it open, who last touched it and what it links
to. It does not become a document reader, a slide sorter or a spreadsheet viewer,
and a rebuild that starts adding per-kind bands here is rebuilding the wrong
surface.

Two conventions hold everywhere. Every lens takes its title from the thing's own
name, so no identity band repeats it — a Name field under a heading that already
says the name costs a row of a narrow panel and tells the reader nothing they
have not just read. And every lens except the project's own opens with a
breadcrumb whose first step is the project.

### activity

One recorded event: who, what, to what, when. The smallest lens in the subject.
An event is a fact, so the work here is restating it precisely and offering the
way to its target — the actor at the head, then the action, target and time, then
Details, then Navigation.

**The actor's kind is named beside the actor.** "Edited by Nightly filing digest"
and "edited by Ana Reyes" are different claims about what happened, and a face
alone does not tell them apart, so the lens says person, agent or connector in
words.

**A target that no longer exists gets a sentence, not a dead button.** The record
stores its subject by name, so whether that subject is still in the project is a
lookup, and the answer decides which of two things the Navigation band draws:
the way to open it, or a line saying it is no longer here.

The time reads as the day and the hour together. The feed groups by day, so a
lens on one event pulled out of that feed has to carry its own day.

Details arrives shut. The machine-readable form of a record is for somebody
chasing it through a system, not for the reader who just clicked a row in a feed.

What it deliberately does not do: no machine-readable event kind is stored, so
the Event field is empty and the action word above is the whole record.

Routes to `general.person`, `agents.persona` or `project-overview.connector` from
the actor, `project-overview.resource` from the target, and `project-overview.project` from the
breadcrumb.

### connector

One connection to an outside system: what it may read, how material arrives, and
whether it is working. It opens by drawing the connector as the actor it is,
because a connector acts in this project rather than merely sitting in it — then
provider, display name and status, then Scope and delivery, Synchronization, and
Actions.

Scope lists what was asked for and whether it was granted, and marks which are
required. Both halves are chosen explicitly and neither is inferred from the
provider, which is why a scope that was asked for and refused is still a row —
drawn in danger when it is a required one.

**Sync now is disabled while authentication is expired, and says so in the
control.** The order of failure is the argument: a sync started against a dead
token fails a minute later with an error that reads like a brand new problem, so
the control that explains itself up front is the better one. **Reconnect goes to
the connect panel** rather than re-authenticating here, because re-authenticating
is the same flow as authenticating, and a second one living in this lens would be
the same category written twice.

While a sync runs, the progress bar says running rather than sitting at zero: no
extent is reported, and a bar at nothing reads as a stall.

What it deliberately does not do: the band is called Scope *and delivery*, but
how material arrives is not stored on a connector, so delivery cannot be said.
Only one last-sync record is kept, so what the Synchronization band shows is the
last attempt and not a trend. And what disconnecting does to the files already
synced is undefined — whether they stay as project resources, become orphaned, or
are removed with the connection — which the note states before anyone presses it.

Routes to `new-tab.connect` from Reconnect, and `project-overview.project` from the
breadcrumb.

### file

A file that came in from somewhere, and whether anything in it can be read. It
leads with identity — type, size, origin — but it exists mostly for the
Extraction band, because an external file is only useful once text has come out
of it. The connector behind it comes last and arrives shut: it is context, not
the reason the lens was opened.

**The failure is stated as what it costs**, not as an error code. "Scanned
document with no text layer" tells an engineer what happened; "nothing in this
file is retrievable until text comes out of it" tells the person who was looking
for it why their search came back empty. Both appear, in that order, with the
consequence given the plainer words.

Extraction is read from the record of reported problems, and that record holds
problems and nothing else. So a file with no entry is a file with **no reported
problem** — which is not the same claim as text having come out of it, and the
band is careful not to write it as one. It says "Nothing reported" and then says
what that does and does not mean.

What it deliberately does not do: Size is an em dash, because no byte size is
stored on a resource. Type comes from the file extension, because that is the
only thing in the record that says what the file is. And a retry can be asked for
but nothing can say whether it would help — the reason a file failed is not
stored with any flag saying whether a second attempt would read differently, so
the panel offers the retry and admits it is a guess.

Routes to `project-overview.connector` from the connector behind the file, and
`project-overview.project` from the breadcrumb.

### project

The project itself. Description, its state as a chip, and your own role, then
three bands: People, Dates, and Project actions.

People puts the counts first and the faces second — the counts are the
membership, the faces are who they happen to be. A strip of four avatars over a
project of seven people reads as the whole of it, which is why the numbers come
first. Owners is a count and never a name: several owners are permitted and at
least one is required, so a single name in that slot would be a claim the data
cannot carry.

Dates arrives shut and says only dates. The project stores no updated timestamp,
so the head of the activity feed is the closest true answer available, and it is
a time rather than a person for the same reason the band carries no *by* line:
nothing records who created the project or who last changed it, and the note
under the fields says exactly that rather than leaving the reader to wonder.

Project actions arrives last and shut, because neither control is why anyone
opened this lens. Archive is separated from Settings by a rule, because one
changes a preference and the other changes what the project is.

What it deliberately does not do: it does not say what archiving means. Whether
an archived project stays readable, whether its Automations stop, and whether it
can be brought back are all undecided, and the note says so rather than the
button implying an answer. There is also no settings lens behind the Settings
control — what a settings surface would even contain is unspecified.

Routes to `general.person` from a face, `general.people` when the
face strip overflows, and `project-overview.project` from Settings.

### resource

The general lens for anything first-class in the project. The action row carries
Open and Duplicate, then the fields say what kind of thing it is and its id, then
four bands: Editing now, Provenance, Relationships, Actions.

Open and Duplicate sit in the **action row** rather than in the Actions band at
the foot. Both were called for in two places — beside the identity and again at
the bottom — and drawing them twice in a narrow panel gives the reader two of the
same button to tell apart. The foot keeps only what belongs nowhere else: the
destructive one.

Open means the thing itself. Where a thing opens and which lens reads it are two
separate questions asked by several surfaces, so both are answered away from this
panel. When no category holds a kind — a file, a finding, a connector, a Context —
that is not a failure: those are things you look at rather than places you go, so
Open gives them their lens.

Editing now draws faces and then a sentence naming the people, because a strip of
initials says who only to somebody who already knows them.

Provenance arrives shut. **Updated by falls back and never guesses**: the
record's own actor if it has one, otherwise the most recent activity entry
attributable to this resource, otherwise an em dash. Not every kind stores an
updating actor, and inventing one is worse than leaving the field empty.

Relationships arrives shut and lists only links the model actually holds, which
today means research: a finding knows the thread it came out of and the
hypothesis it bears on, a thread knows its question and the findings accepted
from it. Those are real rows in one direction.

What it deliberately does not do, in three places. No resource stores a creating
actor or a template origin, so Created by and From template stay empty and say
why rather than being dropped from the band. Citations between ordinary resources
are not modeled at all, so nothing here can answer what cites this. And Delete is
present but disabled: deleting anything a Context can name is gated on a
reverse-dependency query that does not exist, so the control names the gate
instead of offering an unsafe deletion.

Routes to `general.person` from a face or from Updated by, `project-overview.project`
from the breadcrumb, and — from a relationship row —
`research.research-thread`, `research.hypothesis`, `research.question` or
`research.accepted-finding`. Open resolves to whichever category or lens holds the
resource's kind.

## What is not here

**Nothing writes.** Every panel in the subject lists and routes. The single
exception is defining a variable, and even that ends by leaving the form.

**No paging, anywhere.** Every list draws all of its rows and every filter is
applied to the rows the panel already holds. That is correct only while the whole
set arrives at once. The panels that admit unbounded length — Resources,
Activity, People — put their search and their controls above the list rather than
below it for the same reason, and the narrowing in Activity is written knowing
that the real answer is a query that takes when, actor and target as parameters.

**Three places where the data has a shape the grouping does not**, each recorded
on the panel rather than hidden: resources of a kind with no group, templates
that make a single slide, and Contexts that resolve to nothing. In all three the
panel states the count and the consequence instead of quietly dropping the rows
or inventing a band for them.

**No panel edits its subject.** Contexts are edited in the Context category,
Personas in the Agents category, templates in the Templates category. A panel that
began editing in place would be a second, smaller version of a category that
already exists.

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

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

**Nothing writes.** Archive, Duplicate, Retry extraction, Sync now and Disconnect
are all drawn as real controls and all of them only change what the button says.
Each is present because the control is part of what these lenses specify; none of
them has anywhere to write yet, and each says as much in its own words rather
than being hidden until the day it works.

**Nobody created anything.** Neither the project nor any resource stores a
creating actor, so Created by is an em dash in two lenses and the notes explain
the absence. The same is true of a template origin. Every one of these is written
as a field that exists and cannot be filled, never as a field quietly removed.

**Deletion is gated everywhere**, on one missing thing: a query for what depends
on a resource. Until that exists, anything a Context can name cannot be safely
deleted, so the destructive control names the gate instead of offering the
action.

**Two kinds have no lens in this subject.** A Context and a template are both
first-class, both selectable elsewhere, and both route to keys another subject
owns. This subject covers the container, the general resource, the two external
kinds, and one event — and the general lens is what anything else lands in.
