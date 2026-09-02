# Research

Lives at `src/lib/app-views/categories/research/research.md`.

One line of enquiry, keyed by `resourceId`. A thread is opened, worked in and
closed, exactly as a document is — which is why it is a tab and not a place.

| Content | Shows |
| --- | --- |
| [`thread.svelte`](content/thread.svelte) | One turn, with its answer and its findings |

Anchored to a single turn rather than scrolled through all of them; earlier
turns are a context view, not scrollback.

The composer at the foot of the screen is the one place to say the next thing.
This is already a conversation with an agent, so the category owns its input
rather than borrowing one from the shell.

## Context

These are the context panels of the Research category: the rail beside one line of
enquiry. Together they answer *what is this enquiry standing on, and what has it
produced* — and they answer it about a category that is anchored to a single turn
rather than scrolled through all of them. That anchoring is the fact the whole
subject is built on. The centre shows one turn; the rail says where that turn sits
in the thread, what the thread was allowed to look at, what it read, what steps it
took, and what came out.

The six panels sit at three levels, and knowing which level a panel belongs to is
most of what makes it legible.

**Above any thread** — Inquiry. Questions and hypotheses belong to the project and
outlive every thread that works on them, so they are listed in the rail rather
than inside one thread's history.

**The thread** — Context and History. What this thread is allowed to search, and
the turns it has taken, with the other threads in the project beside them as a way
across.

**This turn** — Sources, Trace, Findings. What was read, how it was arrived at,
and what conclusion is being offered. All three read from whichever turn is
currently anchored.

Two things the rail cannot do are worth stating once rather than six times.
**Nothing here decides anything.** Every row opens a lens; the decisions —
accepting a finding, editing a thread, answering a question — happen in the
inspector, and a control in the rail would be a shortcut past a review. And **the
anchored turn is held in a panel**, in History, because a turn has no lens of its
own: the workbench carries a selection alongside an inspection, and with nothing
to inspect there is nowhere else to put it.

### context

What this thread can search, and what that came to when it last resolved. Three
bands: *This thread searches*, naming the scope and, separately, the web; then
*Resolution*, the numbers; then a warning.

The panel carries no controls at all. The scope is set once for the thread and
there is no per-turn switch, so this states facts — a control here would offer a
change the model has nowhere to put.

**The thread names its scope rather than referencing it.** The saved scope is
matched by name so the row can open its definition, and where no saved scope
carries that name the row is inert rather than a link that leads nowhere. Every
count in the panel is the thread's own resolution; the saved scope's stored counts
are a different resolution, and mixing the two would print two answers to one
question.

The web is a second place to look, not a resource in the set, so it is its own row
saying enabled or not available rather than a number folded into the total.

Resolution shows resolved and indexed as two numbers rather than one percentage,
with the count of resources that have no material beside it. Holding a resource
and being able to retrieve a passage from it are different things, and the gap
between them is the number worth reading.

What it deliberately does not do: nothing stops a scope that resolves to nothing.
An absent or empty scope searches the whole lattice rather than nothing at all, so
a thread can be silently unbounded; the warning says it, and the panel says why
saying it is not enough — a zero-member scope has to be refused where it is saved,
or the widest possible search is the silent result of the narrowest possible rule.

Routes to `context-editor.context`, when a saved scope of that name exists.

### findings

The same object in three states: proposed by this turn, accepted in this thread,
and accepted somewhere else in the project. Three bands in that order, with
*Elsewhere in the project* arriving shut — it is context rather than the reason
the panel is open.

A finding is a conclusion rather than a quotation, so every row leads with the
claim and qualifies it with what it bears on, said as the link reads: *Supports
H-3*. A finding with no links says that instead. The passages a finding stands on
are inside its lens, not on the row. Rows from other threads carry the thread that
established them, because a conclusion with no origin cannot be checked.

**Proposed sits first and decides nothing.** Accept, Edit and Dismiss are beside
the answer in the centre of the screen; this band is the list of what is waiting,
drawn as attention rather than success, and a row here opens the proposal for that
review rather than short-cutting it.

What it deliberately does not do, twice. Proposed is drawn here and stored
nowhere: a finding has no state in the model, so nothing tells one awaiting a
decision from one already dismissed. And the elsewhere band lists everything the
project has accepted, which is not what the heading means — "relevant here" needs
a rule before the list can be narrowed to it.

Routes to `research.proposed-finding` or `research.accepted-finding`, chosen by
the state of the row.

### findings-library

Headed *Findings*. Everything this project has accepted, in one searched list.

A finding is a resource — retrievable anywhere in the project — which is why
this list exists at all rather than living as a detail inside each thread.

There is no action row, deliberately: nothing here is created, and a finding is
accepted in the thread that proposed it. Each row says where it came from and,
when a bearing exists, what it bears on, because a conclusion with no origin is
a claim nobody can check.

Routes to `research.accepted-finding`.

### history

The earlier turns in this thread, and the other threads in the project. A search
field over the turns, then *This thread*, then *Other threads* outside the search.
A header control starts a new thread.

Every turn row says what its turn produced, not just what was asked: a list of
prompts alone would not say which turn mattered. Selecting a row moves the centre
onto that turn, and this panel keeps which one is showing.

The search covers the turns and nothing else, which is why the other threads sit
outside it: they are a way across to another enquiry, not part of this one's
history. Each of those rows carries its mode as an icon and the number of turns it
has taken, because the mode repeats on every row and the title is the part worth
reading.

What it deliberately does not do: selecting an earlier turn and asking something
new has no defined relationship to the turns after it. Nothing records a branch.

Routes to `research.thread`, both for the other threads and for the new one.

### inquiry

The questions and ideas the project is working on. Two bands: Questions, then
Hypotheses. Each question row carries its own status, each hypothesis its
confidence and its assessment, and the question the current thread is anchored to
is marked in place rather than lifted out of the tree — where it sits under its
parent is half of what it means. Two header controls create a new question
(primary) and a new hypothesis.

Questions nest one level and no more. A child of a child is a tree a rail-width
panel cannot draw, and the model's depth stops at one for the same reason.

**Nothing is rolled up.** Each question carries the status a person set on it, so
a parent reading Investigating while all three of its children are answered is a
legal state and is drawn as one. Answering a child leaves its parent exactly where
it was, and the panel says so rather than letting the tree imply otherwise.

What it deliberately does not do: a confidence has no author and no date on it.
0.7 set by a person last month and 0.7 left by the last turn read identically on
the row and are not the same claim.

Routes to `research.question` and `research.hypothesis`, including for the two
create controls.

### inquiry-library

Headed *Inquiry*. What the project is trying to find out when there is no
current thread to anchor against. Two bands: the questions, then the ideas being
tested.

Questions nest exactly one level. A child hangs off its parent, and a child of a
child would be a tree this panel is 300px too narrow to draw.

An idea carries its assessment as its tone: ruled out and supported are settled,
testing is live, untested is neither.

The second band is called *Ideas being tested* rather than *Hypotheses*, which
is the wording the single-question centre uses. The two disagree and one of
them will eventually lose.

Routes to `research.question` and `research.hypothesis`.

### overview

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
also the one place the product says why the composer belongs to this category** —
the thread already is a conversation with an agent, so the input sits inside the
tab that holds the conversation rather than anywhere else.

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
`agents.persona` from the agent, `general.person` from the author, and
selects `research.context`.

### sources

What has been read: by this turn, and across the thread. A search field, then a
row of four chips — All, Resources, Files, Web — then two bands, *This turn* and
*Whole thread*.

A derived ledger, and nothing in it has state. Reviewed and Accepted are decisions
about a finding; a source is only ever something that was read, and the note at
the foot says so rather than leaving the absence to be read as an oversight.

**The filter is stated over the thread.** The turn's sources are a subset of the
thread's, so one matched-of-total covers both lists honestly, and a filter that
empties the thread has emptied the turn with it. The search field contains the
chips and both bands, so the scope of the narrowing is answered by where the
controls sit rather than by a convention.

The second line differs by kind, because the locator that matters differs by kind:
a page or a row range points into something stable, while a web address only means
anything with the time it was taken beside it. In the whole-thread band the second
line gives way to the turns that used it, with a use count — which is what
identifies the source the thread keeps returning to.

What it deliberately does not do: a capture time claims stored content, and
nothing stores it. A web source holds an address and a time, and the page under
both can change without either changing.

Routes to `research.source`.

### threads

Headed *Threads*. Every line of enquiry in the project, searched, split into open
and answered. The mode — discover, question, hypothesis — is carried by the icon
rather than by a word, because it repeats on every row and the title is the part
worth reading.

*Answered* is a projection of the anchoring question's status, not a state
anyone sets, so the two bands are a split of one list rather than two lists: a
thread moves between them without being edited.

Choosing a thread opens its tab and inspects it, two acts in one press and
deliberately. This panel is the map onto a category that has no list of its own,
so a press that only inspected would leave the map with no way onto the
territory. Opening is idempotent, so a thread reached from here, from a finding
and from the work table is one tab.

Nothing starts a thread, so **New thread** opens the first one the category is not
already holding rather than pretending to create.

Routes to `research.thread`, opening the research category on the same press.

### trace

How the answers were arrived at: the agent's steps, grouped by turn, newest first,
with only the current turn open. "Why did it say that" is asked of one turn, so
the turns are the sections and the earlier ones qualify the answer rather than
being the reason anyone opened this. Each row names the tool, its outcome and what
came back, with the duration beside it.

**A call that found nothing is an outcome, not an error.** It is drawn as
attention rather than danger and says the words, because it is the most
informative row on the screen when a turn produced a weak answer. Only a genuine
failure is drawn as one.

This is the one panel in the subject that records no gap. Its closing note is a
claim rather than an apology: a weak answer is usually explained by one of these
rows rather than by the prompt above it.

Routes to `research.tool-call`.

## Inspector

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

### accepted-finding

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
link, and to `project-overview.resource`; the crumb goes to `research.thread`.

### hypothesis

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

Routes to `research.accepted-finding`; the crumb goes to `project-overview.project`.

### proposed-finding

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

### question

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

### research-thread

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
`project-overview.project`.

### source

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

Routes to `project-overview.resource`, from the excerpt and from the action; the crumb goes
to `research.thread`.

### thread

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

Routes to `agents.persona` for the agent; the crumb goes to `project-overview.project`; the
action opens the Research category keyed by this thread.

### tool-call

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

**No paging and no query.** Every list draws the rows it holds and every filter is
applied to those rows. That is honest only while the whole set arrives at once,
which is why the panels that admit unbounded length — Sources, History — put their
search above the list and report matched of total.

**No branch.** The rail lets a person centre an earlier turn and ask again, and
records nothing about the relationship between the new turn and the ones that
already followed the old one. This is the largest undecided thing in the subject.

**Three states the model does not hold.** A finding's proposed / accepted /
dismissed, a per-thread record that a scope was deliberately empty, and a stored
capture of a web page. In each case the panel draws the distinction, states that
it is unbacked, and names what would go wrong if the distinction were quietly
dropped instead.

**Nothing is derived that a person should set.** A question's status, a
hypothesis's assessment, whether a finding is relevant — the rail shows counts
beside all three and computes none of them, because a category that showed a tally
next to a judgment would invite the judgment to be read as the tally.

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

**Almost nothing here creates.** Nothing counts template uses, starts a thread,
creates an analysis, or mints a template. Where a New button exists it opens a
lens, lands the centre on a blank id, or reaches for an existing row it has not
already opened — it does not make a record this panel would then fail to list.

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
