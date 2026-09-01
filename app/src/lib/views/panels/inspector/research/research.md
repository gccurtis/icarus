# Research

## What the subject is

These are the lenses of the Research category: what opens in the inspector when a
row in the research rail, or anything in the project that cites an enquiry, is
followed. Together they answer *what exactly is this, and what does it rest on* —
one object at a time, in full, with its evidence and its provenance attached. Each
one is reachable from several places, so each stands on its own and carries a
trail back to the thread or the project rather than assuming the reader arrived
from the panel that lists it.

The eight lenses fall into four groups, and two of the groups are pairs.

**The enquiry** — Thread and Research thread. One line of enquiry, described twice
for two entrances. Thread is the working description reached from inside Research:
the mode, the anchor, the agent, the scope, with the title editable. Research
thread is the same enquiry seen from the project's work table, where a thread sits
beside documents and decks: identity and provenance, and a control that opens it.
They must agree about one rule in particular — a thread's anchor reference *is* an
identifier, so the mode decides which lens the anchor opens.

**What the enquiry answers to** — Question and Hypothesis. Both are named by their
reference rather than their sentence, because that is how they appear everywhere
else, and both carry a status a person sets and nothing derives.

**What it produced** — Proposed finding and Accepted finding: one object in two
states, and the most consequential pair in the subject. See below for what changes
between them.

**How it got there** — Source and Tool call. The evidence and the workings; the
two lenses a weak answer is diagnosed with.

## Thread

The line of enquiry itself: its job, its agent, its scope. Two bands — Thread,
then Agent — and an action row above both with a single primary control that opens
the thread.

The Thread band carries the title, editable in place; the mode, drawn as three
visible options rather than hidden behind a trigger; the anchor's reference where
there is one; and the number of turns. Three things define what kind of enquiry a
thread is — the mode, the anchor it answers to, and how far it has gone — and they
sit above the agent because the agent is how the job gets done rather than what
the job is. The mode is shown rather than hidden because which of the three jobs
this is, is the first thing a reader wants, and a trigger would cost a click to
say it.

The Agent band names who the thread runs as and what that persona is for, then
what it can look up and what it may do: the scope and its size, whether the web is
on, how many tools are allowed. All of those belong to the thread rather than to
any turn. **The agent is set once, for the whole thread**, and the band says so
outright, because an absence nobody names reads as an omission.

Open is in the action row rather than buried. This lens is reached from the map of
threads and from anything that cites one, and a description of a line of enquiry
with no way onto it is a dead end. A thread is a tab keyed by itself, so the
control mints one or activates the one already open.

What it deliberately does not do: whether the mode can change once turns exist is
unsettled — a Discover thread that becomes a Question thread has to acquire an
anchor from somewhere, and nothing says where. Where the scope resolves to
nothing, the panel says the thread is searching everything, because an unbounded
scope is the one that never announces itself. And the closing note records why
there is no assistant dock here: the whole Research category is the conversation, so
a second composer floating over it would be two ways to say the same thing.

Routes to `agents.persona` for the agent; the crumb goes to `project.project`; the
action opens the Research category keyed by this thread.

## Research thread

The same enquiry, selected from the project's work table. Two bands: Identity —
the title, the mode as a chip, and the anchor as a link where there is one — then
Provenance, which arrives shut: who created it, its revision, when it last moved.
A thread is work rather than a resource, which is why it is in that table at all.

**Opening it lands on the thread's own tab.** A line of enquiry is opened, worked
in and closed exactly as a document is, so it is keyed by its own identifier in
the tab strip and several can stand open beside one another; closing the tab
closes the thread. The control does two things in one press — opens the tab, and
puts this thread's working lens in the inspector — because the tab it lands on
opens with an empty inspector, and emptying the panel the reader was already in is
a cost for nothing.

**The anchor's reference is its identifier**, so the mode decides which lens the
anchor opens: a Hypothesis thread's anchor opens a hypothesis, anything else
opens a question. A Discover thread has no anchor at all, and an absent anchor is
not an empty one — the field is not drawn rather than drawn empty.

Routes to `research.hypothesis` or `research.question` by mode; the crumb goes to
`project.project`.

## Question

One thing the project wants to know, and what bears on it. A question outlives any
thread that works on it, so this lens is about the question and never about the
conversation. Three bands: Question, then Linked hypotheses, then Accepted
findings, which arrives shut.

**The title is the reference.** *Q-14* is how the question is named in every other
panel in the subject, and a heading carrying the sentence would repeat the first
field underneath it. The sentence, the status and — where there is one — a link to
the question this one sits under are the fields.

**Status is set by a person.** Nothing derives it and nothing should: a question
with three accepted findings can still be open, and the note says so under the
field so the two bands below are not read as a scoreboard. Linked hypotheses is
open, because the ideas offered as answers are what the question is for; the
findings band is shut, because it qualifies rather than answers.

Findings on a row carry their direction, and a neutral bearing is the absence of a
claim, so it is not drawn as one.

What it deliberately does not do: a finding can bear on a question directly or
through a hypothesis. Whether the findings band shows both, and how it would tell
them apart, is unsettled — so the band today is honest about being one list of
undistinguished links.

Routes to `research.hypothesis`, to `research.accepted-finding`, and to
`research.question` again for the parent and the crumb.

## Hypothesis

One idea being tested, and the evidence on both sides. Named by its reference —
*H-3* — for the same reason a question is: that is how it appears wherever else it
is mentioned, and the statement is a sentence rather than a name. Three bands:
Hypothesis, Evidence, and a closing note that arrives shut.

**Assessment is a human judgment.** It is never calculated from the count of
supporting and contradicting findings, and the panel says so directly under the
field, because a category showing both a tally and an assessment invites exactly
that inference.

Evidence is one list holding both directions rather than two lists. Splitting them
would make the direction a heading rather than a property of each link, which is
the mistake the closing note exists to prevent: bearing lives on each
finding-to-hypothesis relationship, not on the finding, so the same finding can
bear differently on two different hypotheses.

What it deliberately does not do: who set the confidence, and when, is not
recorded. A bare 0.70 with no author is not interpretable, and the panel prints
the number with that stated beside it rather than dressing it as a measurement.

Routes to `research.accepted-finding`; the crumb goes to `project.project`.

## Proposed finding

A conclusion offered for acceptance: still editable, not yet part of the project.
This is the lens where a conversation becomes knowledge, so it is built as a
review — read it, fix it, decide. Bands in order: Finding, Body, Standing on,
Bears on, then a rule, then Accept.

The title and the claim are both editable, before the decision rather than after
it, because what you accept is what enters the lattice. Standing on is the
evidence — the passages the conclusion rests on, which can be lattice sources, web
sources, or both — and it is open, because a reviewer cannot decide without it.
Bears on is what the conclusion touches: the questions and hypotheses it supports
or contradicts, each row carrying its direction, with a neutral bearing left
undrawn because it is the absence of a claim.

**Accept is its own section**, separated by a rule from everything it is a
decision about. It writes the finding and its links together and makes the whole
of it retrievable across the project — a durable act with a wide blast radius
rather than one button among four. Dismiss sits beside it, drawn as danger. Once
either is pressed the editors and both buttons go inert and the state chip says
which way it went.

What it deliberately does not do: a proposed finding has no state in the model at
all. Proposed, accepted and dismissed have to exist before any of this can ship —
which is the same gap the rail's Findings panel records from the other side.

Routes to `research.source` for each citation, and to `research.question` or
`research.hypothesis` per link; the crumb goes to `research.thread`.

## Accepted finding

The same object once the project has adopted it: retrievable everywhere, and no
longer editable in place. It carries the same band names as the proposal, and
almost everything about them has changed.

**Nothing here is an editor.** The proposal lens carries the title and body
editors; once accepted, what the project retrieves and what this panel shows have
to be the same text, so changing it is a withdrawal rather than a keystroke.

**Two chips instead of one.** Accepted, and in the lattice — the same fact from
two angles, because being in the lattice is the whole of what acceptance buys. The
Finding band gains who accepted it and when.

**Standing on and Bears on arrive shut.** On the proposal they are what the
decision is made on; afterwards they qualify the finding rather than being the
reason anyone opened it. Each citation now also says how it was captured, which is
the durability question: an excerpt is copied on accept and survives the source
changing, while a locator only points, and can rot.

**Accept becomes Actions**, still set apart by a rule — now from everything it
would retract. Two controls. *Open as resource*, because an accepted finding is a
resource of the project like any other; it asks the project for its row by name,
and where the project holds none the control is disabled and says that, rather
than opening whichever row sorts first. And *Withdraw*, drawn as danger.

What it deliberately does not do: withdrawal semantics are undecided. A finding
that has been retrieved into a generated block, or cited by another finding,
cannot simply vanish, and nothing yet says what happens to those. One citation
also still names a research-specific message store that the model has replaced
with a general one.

Routes to `research.source`, to `research.question` or `research.hypothesis` per
link, and to `project.resource`; the crumb goes to `research.thread`.

## Source

Something that was read, and the passage that mattered. Bands: Source, Excerpt,
then Retrieval detail, Used by and Actions.

**The excerpt sits high**, directly under the identifying fields, because it is
the reason the source is listed at all — the title and the locator only say where
to find it again. The capture time is drawn on web sources only, and it is part of
what identifies one: a URL stops being the source the moment the page changes.

**Scores are tool output, not source fields.** They appear only where the
retriever supplied them, and where it did not the section says why — a web result
never carries them — rather than drawing an empty pair of numbers.

What it deliberately does not do, twice. Used by is read backwards from the
answers and findings that cite this source; there is no stored link to follow yet,
so no row there opens anything. And a web source has no resource to open, only a
URL — with a captured page a third thing again — so which of the three a click
should reach is undecided and the control is drawn disabled with that as its
reason rather than quietly absent.

Routes to `project.resource`, from the excerpt and from the action; the crumb goes
to `research.thread`.

## Tool call

One step the agent took: what it asked for, and what came back. It is the lowest
level the Research category goes to, and it exists so a weak answer can be diagnosed
rather than argued with. Bands: Call, Input, then Output, which arrives shut.

**A call that found nothing is an outcome, not an error.** It is toned as
attention rather than danger, and when that is the outcome the panel says in words
that this is usually the most informative row on the screen for a turn that
produced a weak answer.

Input is the arguments as stored, unrendered: what was sent, not a reading of it.

**The resolved scope is recorded on the call.** That is where historical scope
truthfully lives — the thread's scope can be edited afterwards, and then it no
longer describes the search that produced this. The Output band prints the scope
this call actually resolved beside the result, and says why the two can disagree.

What it deliberately does not do: raw arguments are honest and unreadable.
Whether the input should be rendered or shown as stored is an open review
question; the query and the scope are the two parts anyone actually reads.

Routes nowhere but its crumb, `research.thread`.

## What is not here

**No lens for a turn.** A turn is the unit the whole category is anchored to and the
only thing in Research with nothing to inspect, which is why the rail's History
panel has to hold the anchor itself.

**Nothing re-runs.** No tool call can be repeated, no scope re-resolved, no
question re-asked from its lens. These are lenses on what happened, and the place
to ask again is the conversation.

**Provenance is thin in exactly three places**, each recorded on the panel that
suffers from it: a confidence with no author or date, a proposed finding with no
stored state, and a citation whose only durability guarantee is whether an excerpt
was copied at acceptance.

**Two lenses describe one thread.** The pair exists because the entrance differs —
inside Research, or from the project's work table — not because the object does.
Anything that changes what a thread is has to change both, and the anchor rule is
the part they most need to keep agreeing on.

**Judgment is never derived.** A question's status, a hypothesis's assessment, a
finding's acceptance: every one is set by a person, every panel that shows counts
beside one says so under the field, and no panel computes one from the other.
