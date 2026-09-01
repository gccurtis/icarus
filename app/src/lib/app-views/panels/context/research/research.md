# Research

## What the subject is

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

## Inquiry

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

## Context

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

Routes to `scope.context`, when a saved scope of that name exists.

## History

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

## Sources

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

## Trace

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

## Findings

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
