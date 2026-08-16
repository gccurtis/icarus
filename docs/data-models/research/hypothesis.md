# Hypothesis

A proposed answer to a [question](question.md), stated so that evidence can bear
on it.

```ts
interface Hypothesis {
  projectId: Id<"projects">;
  statement: string;
  rationale: ContentBlock[];
  assessment: "untested" | "testing" | "supported" | "refuted" | "inconclusive";
  confidence?: number;         // 0–1, only meaningful once assessed
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
}
```

## Statement is plain, rationale is blocks

Same split as a question, for the same reason. `statement` is the claim in one
line — it has to read cleanly next to its assessment in a list. `rationale` is
the argument for it, which wants structure: prior evidence, a chart, a link to
the finding that suggested it.

## Assessment and confidence

`assessment` is the judgement. `confidence` is optional and only meaningful once
an assessment exists — an untested hypothesis has no confidence to report, and a
default of `0` or `0.5` would be a fabricated number that charts and summaries
would happily consume.

`testing` is work in progress — someone is actively gathering evidence. Without
it a hypothesis sits at `untested` while a research thread runs against it, which
reads as nobody having started.

`inconclusive` is a real outcome, separate from both. It records that the work was
done and did not settle the question, which is information the next person needs
and which `untested` would erase.

The five split cleanly into three states of *work* — `untested`, `testing`, done —
and three *verdicts* once done. They are one field rather than two because a
verdict implies the work happened, so the combinations a second field would allow
are mostly nonsense.

Findings supporting or contradicting a hypothesis are its
[links](research-link.md), read by `by_subject("hypothesis", id)`. The `bearing`
lives on each link rather than on the finding, so one finding can support this
hypothesis and contradict another.

Assessment is stored rather than derived from the [findings](finding.md) that
link to it. A count of supporting versus contradicting findings is not a
judgement — three weak findings do not outweigh one decisive one — and a model
that computed it would be asserting a confidence nobody chose.

## It stands on its own

A hypothesis holds no `questionId`. Questions attach through
[research links](research-link.md), and the relationship is many-to-many: a claim
about pricing power bears on "why did margin fall" and "should we raise prices"
at once, and duplicating the hypothesis to attach it twice would make two things
that must be assessed together and cannot be.

It also needs no question at all. A hunch arrives before the question it belongs
to is articulated, and forcing attachment at that moment means either inventing a
question nobody asked or losing the hunch.

This is the shape the whole research group has: [questions](question.md),
hypotheses, [findings](finding.md), and [research threads](research.md) reference
each other and none is subordinate. Each has its own purpose and each can exist
alone — which is what makes them all top-level objects rather than parts of one.

`projectId` is stored directly rather than reached through a question, so an
unattached hypothesis is not stranded outside every query.

## Related

[question](question.md) · [finding](finding.md) ·
[research link](research-link.md)
