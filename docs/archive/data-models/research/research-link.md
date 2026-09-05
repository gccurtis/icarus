# Research link

The edges between [questions](question.md), [hypotheses](hypothesis.md), and
[findings](finding.md). All three relationships are many-to-many, and all three
run through this one table.

```ts
interface ResearchLink {
  projectId: Id<"projects">;
  bearerKind: "finding" | "hypothesis";
  bearerId: string;
  subjectKind: "hypothesis" | "question";
  subjectId: string;
  bearing?: "supports" | "contradicts" | "neutral";   // findings only
  note?: string;
  createdBy: Actor;
}
```

Three legal pairs:

| Bearer | Subject | Means |
| --- | --- | --- |
| finding | hypothesis | this finding supports or contradicts this hypothesis |
| finding | question | this finding bears on this question |
| hypothesis | question | this hypothesis proposes an answer to this question |

## Bearer and subject, not from and to

A link says **the bearer bears on the subject**. The finding says something about
the question; the hypothesis proposes something about the question. The evidence
is the subject of the sentence and the thing it addresses is its object.

`from`/`to` was worse for two reasons. It carried no meaning, so the direction
had to be memorized rather than read. And the direction it implied ran the wrong
way — pointing from the question outward, when what a link actually asserts is
made *by* the finding.

`bearing` is then obviously the bearer's property toward its subject, which is
exactly what it is.

## Why many-to-many is the truth

A single foreign key on the narrower object was the obvious model and it is wrong
in every direction:

**A finding bears on several questions.** One piece of evidence routinely answers
more than one thing being asked, and a `questionId` forces someone to pick the
one it "really" belongs to, losing the rest.

**A hypothesis addresses several questions.** A claim about pricing power bears
on "why did margin fall" and "should we raise prices" at once, and duplicating
the hypothesis to attach it twice makes two things that must be assessed together
and cannot be.

**A finding relates differently to different hypotheses.** This is the one that
was outright broken: `bearing` lived on the finding, so a finding could support
or contradict only one hypothesis. A result that supports one explanation while
undercutting another — the most valuable kind of evidence there is — had no
representation at all.

## The edge carries its own attributes

`bearing` belongs here rather than on the finding, because supporting is
something a finding does *toward a hypothesis*, not a property it has. On the
edge, the same finding supports one and contradicts another.

It is optional and only meaningful when the bearer is a finding. A hypothesis
addressing a question has no bearing — it is not evidence, it is a proposal.

`note` says why the link exists when that is not obvious. A plain string: a
sentence of justification, not a writeup. Anything longer is a finding.

There is no `rank`. Curation order on links sounded useful and reads as an odd
thing to store on a relationship — ordering evidence is a view concern, and
relevance, recency, and bearing are all available to sort by without anyone
having to maintain a position. If deliberate ordering turns out to be wanted, it
is a field here, but it should arrive on evidence rather than in anticipation.

## Direction is canonical

Bearers are always the more specific object, subjects the more general: finding →
hypothesis → question. A question is never a bearer and a finding is never a
subject.

Without that rule the same relationship could be stored two ways, and every read
would query both directions and merge. The duplicate check on
`(bearerKind, bearerId, subjectKind, subjectId)` only means anything because
direction is canonical.

## Reading it

- **hypotheses proposed for a question** — `by_subject("question", id)`, bearers
  of kind `hypothesis`
- **findings bearing on a question** — the same query, bearers of kind `finding`
- **evidence for a hypothesis** — `by_subject("hypothesis", id)`, reading
  `bearing`
- **what a finding speaks to** — `by_bearer("finding", id)`

Both directions are one indexed read, which is what a join table buys over an
array on either side.

## What does not link through here

A [research thread's](research.md) `questionId` and `hypothesisId` stay direct
fields. A thread is *about* one thing — its `mode` says which — and an anchor is
singular by nature. Routing a one-to-one relationship through a many-to-many
table would make every thread read a join to answer something it already knows.

Sub-questions also stay direct. `Question.parentId` is a tree, not a graph: a
question has one parent, and a decomposition producing two parents would be two
questions.

## Related

[question](question.md) · [hypothesis](hypothesis.md) · [finding](finding.md) ·
[research](research.md)
