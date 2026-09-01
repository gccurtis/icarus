# Context Editor

Lives at `src/lib/app-views/categories/context-editor/context-editor.md`.

One named context, keyed by `resourceId`. A context is a rule rather than a
list, so what it resolves to is computed now and never stored.

**Nothing here is built.** The rail and the lenses are named by the vocabulary
and no file answers to them yet, so a tab on this category renders the
placeholder. It has a home because its views had one to belong to, not because
it is finished.

## Context

These are the narrow-column panels of the Context category, and they carry one
idea between them: **a Context is a rule, not a list**. Nothing in it is a stored
membership. What a Context contains is worked out at the moment it is read, so
every count in this stack is a resolve as of that second rather than a number
somebody saved. That single decision is why a resource created tomorrow is
inside a Context saved last month without anyone editing anything, why a row
has to say what put it there, and why nearly every gap recorded below is a
consequence of it rather than an oversight.

Together they answer *which Contexts exist, what survives this one's rule right
now, what can actually be retrieved from what survived, and what breaks if the
rule changes*. Five panels in three jobs: one is a chooser across every saved
Context; one is the surface where a term goes into a rule; the other three are
three different readings of the one Context being worked on — what is in it,
what is retrievable from it, and what depends on it.

One warning runs through the whole subject and is worth stating once here: an
empty scope does not restrict retrieval to nothing. It currently broadens it to
the whole project, so a rule matching nothing does the opposite of what it looks
like, and a count of zero is a real answer rather than an empty state.

### add

Putting something into one half of a Context. A sentence at the top says which
half — Include or Take out — everything chosen here lands on, and below it a
single search field covers two sections: By rule, then By name.

A rule and a name are two sections rather than one list with a toggle. A rule
keeps matching and a name does not, which is the whole model of a Context; a
control flipping between the two would demote that distinction to a setting. A
rule row is marked Live where what it covers today is not what it covers
tomorrow, and each rule kind is drawn with its own picture so a live rule is
tellable at a glance from a named thing.

The half is decided before the panel opens, because it is the half you were
pointing at. Both halves accept the same things, so nothing here differs between
them except where the term lands — which is why the half is stated as the
premise at the top rather than as a footnote at the bottom.

The search sits above both sections and contains both. A field narrowing only
the named half while sitting above both would be a scope no reader could check
from what is on screen.

A named connector stands for the files it synced rather than for itself, so a
term naming one brings in everything under it, and its row says how many files
that is.

Deliberately not doing, twice. A term naming another saved Context re-reads that
Context, and what it re-reads is itself a rule — nothing yet bounds how deep
that nests, or catches a Context that ends up including itself. And a named
resource that is later deleted has no resolver contract: fail, omit it, or come
back as an unresolved descriptor are all still open.

Nothing here routes anywhere. A chosen term is marked as added for the sitting
and the panel opens nothing.

### contents

What survives the rule, with anything unsaved or broken above it. The band order
carries the meaning: Problems, then Unsaved changes, then Contents, because each
of the first two changes what the list under it means.

A broken term is kept exactly as it was written. Repairing one silently would
make the term vanish and the count move with no explanation, so the resolver's
failure is a row rather than an absence. No row in Problems is a target: a term
the resolver could not do names something there is nothing to open.

Unsaved changes say what would be added and what would be taken out, and say
plainly that none of it is live. Other things read this Context, so what is set
up and what is saved stay two visible states until it is saved.

Every content row says why it is there — the term that put it here, named
through whatever it came through. A Context stores no membership, so this is a
resolve rather than a lookup, and without the term there is nothing to check a
surprising result against. The band counts what is listed against what the scope
contains, so a page of rows under a larger total reads as the sample it is, and
says that a resource made tomorrow that fits the rule will be here without
anyone editing anything.

Deliberately not doing, twice. What a broken term should do — fail, omit it, or
come back as an unresolved descriptor — is not settled, so a problem here is
reported rather than handled. And the reason a row is in comes from the
resolver, one proof per result; reconstructed in this panel instead, the reason
a row survived a nested reference would be a guess.

Routes to `context-editor.resolved-resource`.

### contexts

Every saved Context beside the one being worked on, searchable, under one Saved
heading. A row is a name, a line describing the rule, and a count of what it
resolves to. New Context and Duplicate sit in the actions row; Duplicate waits
for a chosen row and says so.

This is the same list the library subscreen leads with, kept here so moving
between Contexts is not a mode change.

The line under each name is generated from the rule and never typed. That is
what makes the list scannable: the summary and the count describe the definition
as it stands, rather than what someone wrote about it once and did not revisit.

A count of zero is toned as a warning and the panel says why whenever one
appears, because the row otherwise reads as a Context that restricts everything
when it restricts nothing.

Routes to `context-editor.context`.

### knowledge

What can actually be retrieved from this scope, and what has been written
against it. Containing a resource and being able to retrieve from it are
different things, and this panel is about the second.

Three bands: what can be retrieved, the generated blocks using this Context, and
the lattice, which is debug-only and arrives shut.

The retrieval split is two rows rather than one percentage. A figure like "42%
indexed" hides which of the two numbers a reader is looking at; both are counts
of resources and both are things a person can act on, and a search over the
Context can only ever reach the first line. Neither row is a target: the split is
a count of the scope, not a thing in it.

The lattice band starts shut and offers nothing, and the panel has no actions row
at all. Its nodes are system-managed, so a control here would suggest they are
part of what a person configures. They are kept for investigating a scope that
returns something unexpected; nothing there is a product concept.

Deliberately not doing, twice. Nothing upstream separates *not processed yet*
from *cannot be processed*, and those two want different responses — until a
source registry exists they are one number. And a generated output stores no
pointer back to the block that owns it, so where one lives is a reverse query;
when it comes back empty the row says the owner could not be found and the band
says how many are in that state.

Routes to `context-editor.generated-block` and `context-editor.lattice-node`.

### overview

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

Routes to `context-editor.context` from Duplicate, and selects `context-editor.used-by`.

### used-by

What depends on this Context. Everything in it is a reason not to change the
scope carelessly.

Two sections rather than one list, because the two consequences differ: a
persona reads this Context every time it looks something up, and a prompt block
reads it the next time it runs. The first section says how many resources an
agent bound to this scope reaches, and nothing else; the second says each block
produces something different the next time it runs if the rule changes.

No row is a target. The answer comes back with the names of consumers and not
their ids, so a row here says what depends on this Context without pretending to
be a way into it.

Deliberately not doing: only consumers that can be queried truthfully are
listed. There is no universal reverse index of everything using a Context, so
this list is incomplete by construction — and the panel says so, in the same
breath as the reason Delete on the Context stays gated.

## Inspector

These are the right-hand lenses of the Context vocabulary: one per thing you can
be looking at inside a scope. Where the context panels answer "what is in this
Context", these answer "what is this one thing, why is it here, and what happens
if I change it". They all rest on the same fact — **a Context is a rule rather
than a list, resolved at the moment it is read** — and most of what each one says
is a consequence of that. Nothing here is a stored membership; every count is a
resolve as of this second; a *Right now* band appears again and again because
right now is the only tense a Context has.

`context-editor.context` is the hub of the whole tree, reached from more than twenty
other panels — the second most-linked lens anywhere in it. Every other lens in
this subject carries a crumb trail whose first step is the Context's name and
whose destination is `context-editor.context`, so wherever you arrived from, one step
takes you to the scope itself.

They fall into four groups:

- **The scope itself** — `context`: the rule in plain words, what it resolves to,
  and the one destructive action, drawn and disabled.
- **The three ways a rule is edited** — `include-everything`, `take-out-kind`,
  `include-context`: one lens per term, siblings in shape, differing in what
  kind of rule the term is.
- **What the rule produced** — `resolved-resource`, one row of the contents with
  the proof of why it survived, and `search-result`, one hit from a test search
  against the scope.
- **What was written against it, and what is underneath it** —
  `generated-block`, the consequence view for an edit you are about to make, and
  `lattice-node`, retrieval internals kept for debugging.

### context

A Context: its name and what it describes, its rule stated in plain words, what
it resolves to right now, and how it was last saved.

Bands in order: an identity band with no heading, because the panel's title
already names it — the name and the description, both editable in place; then
*In plain words*; then *Right now*; then *Saved*, which arrives shut because it
is provenance rather than the reason anyone opened the lens; then, after a
separator, the one action.

*In plain words* is the band that makes a Context reviewable by somebody who did
not build it. The two halves of the rule are shown spatially in the centre of the
screen; this says the same thing in a sentence, generated from the definition
rather than typed by anyone.

*Right now* is its own band and not a pair of fields in the identity band,
because the counts are a resolve as of this second rather than facts about the
record. It says how many resources the rule contains and how many of those can be
retrieved from, and states outright that a document created tomorrow which fits
the rule is inside without anyone editing anything.

Both editable values are held in the lens rather than written back. An edit that
vanished on the next read would be worse than one that is plainly local.

Deliberately not doing, twice. The plain-words sentence goes one level deep: a
union nested inside a union cannot be said as one flat sentence any more than it
can be drawn as two flat halves. And Delete is drawn and disabled rather than
absent, carrying its reason on hover and again underneath: it stays gated until
one query can find every Context, persona, prompt block and generated output
depending on this one, because deleting blind makes broken scopes that fail at
retrieval time instead of at delete time.

### generated-block

Something written against this Context, and where it lives. This is the
consequence view for an edit you are about to make: changing the scope changes
what this block produces the next time it runs.

Bands: the prompt; where it lives; *Runs*; *Provenance*, shut; and *Owner
lookup*, shut.

The prompt is quoted, not restated. It is a person's words, carried here from
the block, and the lens must not read as though it wrote them.

*Runs* is a band rather than a footnote because it is the whole point of the
lens. What the block produces is generated against this Context as it stands at
the moment it runs, so editing the scope edits the document, one run later.

*Owner lookup* is its own band because it is a gap and not a value. A generated
output stores no pointer back to the block that owns it, so the owner is a
reverse query, and it is that query which gates where the block is said to live.
The band reports found or not found rather than hiding the miss.

Routes to `project-overview.resource` from the row saying where it lives, and
`context-editor.context` from the crumb.

### include-everything, take-out-kind and include-context

Three lenses, one per kind of term, and they are the three ways a rule is
edited. Each is a term seen on its own: what it says, what it matches right now,
and how to get rid of it.

They share a shape. A crumb trail of the Context's name, the half the term sits
on, and the term itself. A *Rule* band stating the term in words with a sentence
underneath about what being live means for this particular kind. A *Right now*
band with the count. A third band that arrives shut because it qualifies the
count rather than answering it. Then a separator and Remove.

Remove clears the inspection rather than navigating anywhere. Removing the term
removes the thing this lens is about, and a lens whose subject is gone has
nothing to show.

Two of the three offer Move, which flips the term to the other half. The flip is
held in the lens, like every other edit in this subject, because what is on
screen is a read.

#### include-everything

The broadest rule there is: everything in this project, including anything
created later. Most Contexts start here and narrow with Take out.

The "including anything created later" clause is the whole term and is stated
rather than left implicit — it is the difference between a rule and a snapshot of
today's project. The shut third band is *Retrievable*, splitting the match count
into what is indexed and what is not, because containing a resource and being
able to retrieve from it are different things.

Deliberately not doing, twice. Nothing upstream separates *not processed yet*
from *cannot be processed*, and those two want different responses. And this
term on Take out empties the Context by construction; whether that is refused or
allowed is undecided, and it is the one composition that produces a zero-member
scope on purpose.

#### take-out-kind

A live rule removing everything of one kind. The rule band says it plainly: a
resource of that kind created tomorrow is taken out too.

The count is what this term removes from *this* Context, and the band says so —
not how many resources of that kind the project holds. The two differ whenever
Include is narrower than the project, and only the first tells anyone anything.

The shut third band is a sample of what disappears, so a rule doing more than
intended is visible. It is counted as so many of the total, because a section
showing four of thirty-seven and reporting a bare four claims the sample is the
whole. Those rows open nothing: the resolve returns names, and a row that looks
like a target and opens nothing is worse than a row that does not look like one.

#### include-context

A reference to another saved Context, on either half. A reference, not a copy:
what it contributes is whatever the referenced Context contains at the moment
this one is read, so editing that one edits this one.

This is why the *Right now* band carries a circularity check beside the count.
It is coloured only when it is a problem — a green "No" is a state nobody needs.
The shut third band is the chain: how deep the reference goes and what it passes
through.

In place of Move, this lens offers a way into the Context it names, switching
the inspector to it.

Deliberately not doing, twice. The cycle is checked when the reference is read;
until it is checked at save time as well, a Context can be saved into a state
that fails only when something tries to use it. And chain depth needs a limit —
three levels are readable, six are not, and this lens has no way to draw them.

Routes to `context-editor.context`, both from the crumb and from the action.

### lattice-node

A lattice node: retrieval internals, for debugging. Not a product concept — it
exists so retrieval behaviour can be investigated when a scope returns something
unexpected, and the lens opens with a note saying exactly that.

Bands: the node — its tier, its level and how many members it has; *Windows*,
shut, holding the statistics behind it rather than what it is; and
*Contradiction*, which is open on arrival.

Nothing here is editable and nothing is offered. Lattice nodes are
system-managed, so the lens has no actions row: a control here would suggest this
is part of what a person configures.

*Contradiction* is open because it is a warning about what the rows above it
mean. The knowledge model describes one parent per node; the clustering describes
overlapping cliques. Both cannot be right, so the lens names the parents it was
given and promises no hierarchy. Those rows open nothing — the clustering hands
down labels, and a row that opened one would be claiming an edge this model
cannot promise.

### resolved-resource

One resource that survived the rule, and the proof of why it did. This is the row
that makes a Context debuggable: everything else says what the rule is, and this
says what the rule did to one thing.

Bands: an unheaded identity band — title, kind, when it was updated; then *In
because*, the proof; then *Retrievable*, shut, because it is the qualifier rather
than the question; then a band for taking this one thing out.

*In because* names the term that put the row here and, where it came through a
connector, names the connector as the step and not as the content. A connector
expands to the files it synced, and the connector record itself is never
retrievable. Something that arrived that way is labelled as external, because it
is not a resource of this project.

*Retrievable* answers whether anything in the resource can actually be searched.
Zero indexed regions is called out rather than shown as a number, and the band
says the consequence: it is in the scope, and a search over this Context will
never return a passage from it.

Add to Take out is the one-click escape from a rule that caught something it
should not have. It adds a named term for this resource to the other half rather
than editing the resource, so the rule stays the thing that decides and the rule
above is left as it was written. Like every other edit here, it is held locally.

Deliberately not doing: the proof comes from the resolver. Reconstructed in the
lens instead, the explanation for a nested reference would be guesswork.

Routes to `project-overview.resource` from Open, and `context-editor.context` from the crumb.

### search-result

One result from a test search against this Context. The retrieval test answers
the only question that really matters about a scope: if an agent searched this,
what would it get?

Bands: *What was found*, the passage itself; *Where*; *Scoring*, shut, because it
is how the hit ranked rather than what it says; and *What was searched*, also
shut.

The passage is quoted verbatim. It is what the retriever returned, and a lens
that paraphrased it would be answering a different question. A page number is
shown only where the source has pages — an absent page is not page zero.

*What was searched* carries the scope as it stood when the search ran, recorded
with the result rather than read again now. A Context resolves at the moment it
is read, so a fresh reading would describe a different search from the one that
produced this hit, and the result would stop being interpretable.

Deliberately not doing: the offsets in *Where* are internals. They are useful for
debugging retrieval and meaningless to anyone else, and whether they belong in a
product view at all is undecided.

Routes to `project-overview.resource` from the quoted source, and `context-editor.context` from
the crumb.

## What is not here

**Nothing is written back.** A term chosen in Add is marked for the sitting and
nothing more. Unsaved changes are shown as a state of the Context rather than
applied, because other things are reading it meanwhile.

**Nothing is deleted.** No panel in this stack deletes a Context; the gating
reason is quoted here, and the disabled action itself lives on the lens.

**There is no reverse index.** It is why Used by is incomplete by construction,
why a generated output's owner sometimes cannot be found, and why Delete stays
gated everywhere it appears.

**The resolver has no contract for what it cannot resolve.** Fail, omit it, or
return an unresolved descriptor are open in two places at once — a broken term
in Contents, and a named resource deleted after it was added.

**Nesting is unbounded.** A Context can name another Context, that one can name
a third, and nothing yet limits the depth or catches a cycle before something
tries to use the result.

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**Nothing is deleted.** Only the Context overview draws a Delete at all, disabled
and carrying its reason: the same missing reverse-dependency query that gates
deletion everywhere else in the tree.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

**Nothing is written back, anywhere in the subject.** A renamed Context, a
redescribed one, a term moved to the other half, a resource added to Take out —
all of them are held in the lens and lost on the next read. What is on screen is
a read, and an edit that silently vanished would be worse than one that is
plainly local.

**Nothing is deleted.** Delete on the Context is drawn and disabled and says
why: there is no one query that finds every Context, persona, prompt block and
generated output depending on a scope. The same missing reverse index is what
leaves a generated block's owner sometimes unfound.

**Composition has no limits.** Depth of nesting is unbounded, cycles are caught
only when a reference is read rather than when it is saved, and the plain-words
sentence gives up past one level.

**Retrievability is one number where it should be two.** Nothing upstream
separates material that has not been processed yet from material that cannot be,
and that gap is repeated in every band that counts what is indexed.

**Internals are on display without a decision about them.** Search offsets, the
lattice, node densities and cohesion figures are all shown for debugging, all
marked as such, and none of them has been ruled in or out of the product view.
