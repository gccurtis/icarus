# Project

## What the subject is

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

## Project

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

Routes to `collaboration.person` from a face, `collaboration.people` when the
face strip overflows, and `project.project` from Settings.

## Resource

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

Routes to `collaboration.person` from a face or from Updated by, `project.project`
from the breadcrumb, and — from a relationship row —
`research.research-thread`, `research.hypothesis`, `research.question` or
`research.accepted-finding`. Open resolves to whichever category or lens holds the
resource's kind.

## File

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

Routes to `project.connector` from the connector behind the file, and
`project.project` from the breadcrumb.

## Connector

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

Routes to `library.connect` from Reconnect, and `project.project` from the
breadcrumb.

## Activity

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

Routes to `collaboration.person`, `agents.persona` or `project.connector` from
the actor, `project.resource` from the target, and `project.project` from the
breadcrumb.

## What is not here

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
