# Scope

## What the subject is

These are the right-hand lenses of the Context vocabulary: one per thing you can
be looking at inside a scope. Where the context panels answer "what is in this
Context", these answer "what is this one thing, why is it here, and what happens
if I change it". They all rest on the same fact — **a Context is a rule rather
than a list, resolved at the moment it is read** — and most of what each one says
is a consequence of that. Nothing here is a stored membership; every count is a
resolve as of this second; a *Right now* band appears again and again because
right now is the only tense a Context has.

`scope.context` is the hub of the whole tree, reached from more than twenty
other panels — the second most-linked lens anywhere in it. Every other lens in
this subject carries a crumb trail whose first step is the Context's name and
whose destination is `scope.context`, so wherever you arrived from, one step
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

## context

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

## include-everything, take-out-kind, include-context

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

### include-everything

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

### take-out-kind

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

### include-context

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

Routes to `scope.context`, both from the crumb and from the action.

## resolved-resource

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

Routes to `project.resource` from Open, and `scope.context` from the crumb.

## search-result

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

Routes to `project.resource` from the quoted source, and `scope.context` from
the crumb.

## generated-block

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

Routes to `project.resource` from the row saying where it lives, and
`scope.context` from the crumb.

## lattice-node

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

## What is not here

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
