# Research Links

The edges between [questions](../questions/overview.md),
[hypotheses](../hypotheses/overview.md), and [findings](../findings/overview.md).
All three relationships are many-to-many, and all three run through this one
table.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `bearers` | query | what bears on a question or hypothesis, optionally of one kind |
| `subjects` | query | what a finding or hypothesis speaks to |
| `link` | mutation | draws one edge, returning its id |
| `unlink` | mutation | withdraws one |

Registered in
[`src/convex/capabilities/researchLinks.ts`](../../../convex/capabilities/researchLinks.ts),
all four built from `projectQuery` / `projectMutation`.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `researchLinks` | one row per edge: the two ends, the bearing, and the note saying why |

## The bearing is on the edge, and that is why the table exists

Supporting is something a finding does *toward a hypothesis*, not a property it
has. While `bearing` lived on the finding, a finding could support or contradict
exactly one thing — so a result that supports one explanation while undercutting
another, **the most valuable kind of evidence there is**, had no representation
at all. On the edge it is two rows and both readings stand.

It is optional and only meaningful when the bearer is a finding: a hypothesis
addressing a question is a proposal, not evidence, and
[`link`](api/link/link.md) refuses a bearing on one rather than storing a
judgement nobody made.

## Bearer and subject, and direction is canonical

A link says **the bearer bears on the subject**: bearers are the more specific
object, subjects the more general, running finding → hypothesis → question. So a
question is never a bearer and a finding is never a subject, and there are
exactly three pairings.

| Bearer | Subject | Means |
| --- | --- | --- |
| finding | hypothesis | this finding supports or contradicts this hypothesis |
| finding | question | this finding bears on this question |
| hypothesis | question | this hypothesis proposes an answer to this question |

Without canonical direction the same relationship could be stored two ways, every
read would query both directions and merge, and the duplicate check on the pair
would mean nothing. The rule is stated once as an order over the three kinds, in
[`researchLinkPair`](types/types.md), so the table above is a consequence rather
than a list to keep in step.

## Reading it, from either end

- **hypotheses proposed for a question** — [`bearers`](api/bearers/bearers.md) of
  kind `hypothesis`
- **findings bearing on a question** — the same read, of kind `finding`
- **evidence for a hypothesis** — the same read, taking each `bearing`
- **what a finding speaks to** — [`subjects`](api/subjects/subjects.md)

Both directions are one indexed read, which is what a join table buys over an
array on either side.

## There is no rank

Curation order on a relationship reads as an odd thing to store: ordering
evidence is a view concern, and relevance, recency, and bearing are all available
to sort by without anybody maintaining a position. Recency needs no column
either — `_creationTime` is returned as `at`.

`note` is a plain string for the same reason it is not blocks: a sentence of
justification, not a writeup. Anything longer is a finding.

## What does not link through here

**A [research thread's](../../../../../docs/data-models/research/research.md)
`questionId` and `hypothesisId` stay direct fields**, and must not be moved here
later. A thread is *about* one thing — its `mode` says which — and an anchor is
singular by nature; routing a one-to-one relationship through a many-to-many
table would make every thread read a join to answer something it already knows.

**`Question.parentId` stays direct too.** It is a tree, not a graph: a question
has one parent, and a decomposition producing two parents would be two questions.

## An endpoint that is deleted leaves its edge behind

Nothing here is notified when a question is removed, so an edge can outlive one
of its ends. Two things follow, and both are deliberate:
[`unlink`](api/unlink/unlink.md) tolerates a missing end rather than failing on a
label it cannot read, and the reads return `(kind, id)` pairs rather than
resolved objects.

**Cleaning up belongs to whoever deletes.** A capability that removes an object
takes its edges with it in the same transaction — that is why
[findings](../findings/overview.md) have no `remove` at all, and it is the
outstanding work on
[`questions.remove`](../questions/api/remove/remove.md).

## Capability Invariants

- **Exactly three pairings are legal**, and every other combination is refused
  before anything is written.
- **A bearing belongs to evidence.** Only a finding bears one.
- **The pair is the edge's identity.** The same two ends cannot be linked twice
  whatever bearing or note comes with the second attempt.
- **Uniqueness is this capability's invariant, not the database's.** Convex has
  no unique index; the read-then-insert is safe because a mutation is one
  serializable transaction, which is why there is no retry loop and no version
  column.
- **Both ends are proved to sit in the caller's project** before an edge is
  written, which is what lets every index lead with `projectId`.
- **A refusal is "not found", never "forbidden."**
- **Attribution is built from the scope**, never accepted as an argument.
- **Every mutation records its activity in the same transaction.**
- **Every refusal is thrown as `ResearchLinksError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Related

[research link](../../../../../docs/data-models/research/research-link.md) — the
model this implements ·
[findings](../findings/overview.md) · [hypotheses](../hypotheses/overview.md) ·
[questions](../questions/overview.md) — none of which hold foreign keys to each
other, because of this table
