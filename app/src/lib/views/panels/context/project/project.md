# Project

## What the subject is

These are the context panels for a project: the standing lists a person reads
down the side of a project screen. Together they answer *what is in this project
and what has been happening in it* — and they answer it without ever leaving the
screen, because every row opens its subject in the inspector rather than
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
addressed to you above the record. Both arrangements exist and a screen carries
one or the other — the merge, or the pair — never all three.

Four panels offer a way out to a full screen, always as a control in the panel's
own header rather than a footer: a control under a list of unbounded length is a
control nobody reaches. Each stays disabled until whatever holds the panel hands
it somewhere to go — routing out is not something a panel decides for itself.

## Resources

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

Routes to `project.file` for a file, `project.connector` for a connector, and
`project.resource` for everything else.

## Contexts

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
Context screen, and the header control is the way there.

Routes to `scope.context`.

## Templates

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

Routes to `library.template`. The header control opens the Templates screen.

## Variables (and Create)

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

## People

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

Routes to `collaboration.person` for a person, `agents.persona` for a Persona,
`agents.automation` for an Automation, and `project.connector` for a connector.

## Tasks

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

Routes to `copilot.task`. The header control opens the Agents screen, where the
Personas doing this work are managed.

## Activity

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

Routes to `project.activity` for the event, and — following the actor's name,
since the record stores an actor as a display name —
`collaboration.person`, `agents.persona` or `project.connector`.

## Mentions

What a person addressed to you, and nothing else. Two bands: Unread, then Read,
which arrives shut.

A mention is the one thing worth interrupting for. That is why it leads a screen
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

Routes to `collaboration.mention`.

## History

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

Routes to `collaboration.comment` for a mention, `project.activity` for an event,
and `collaboration.person`, `agents.persona` or `project.connector` for an actor.

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

**No panel edits its subject.** Contexts are edited on the Context screen,
Personas on the Agents screen, templates on the Templates screen. A panel that
began editing in place would be a second, smaller version of a screen that
already exists.
