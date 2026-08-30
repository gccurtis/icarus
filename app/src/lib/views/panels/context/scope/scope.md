# Scope

## What the subject is

These are the narrow-column panels of the Context screen, and they carry one
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

## Contexts

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

Routes to `scope.context`.

## Add to this Context

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

## Contents

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

Routes to `scope.resolved-resource`.

## Knowledge

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

Routes to `scope.generated-block` and `scope.lattice-node`.

## Used by

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
