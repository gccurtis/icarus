# Hypothesis

A proposed answer to a [question](question.md), stated so that evidence can bear
on it.

```ts
interface Hypothesis {
  projectId: Id<"projects">;
  questionId: Id<"questions">;
  statement: string;
  rationale: ContentBlock[];
  assessment: "untested" | "supported" | "refuted" | "inconclusive";
  confidence?: number;         // 0–1, only meaningful once assessed
  createdBy: Actor;
  updatedBy: Actor;
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

`inconclusive` is a real outcome, separate from `untested`. It records that the
work was done and did not settle the question, which is information the next
person needs and which `untested` would erase.

Assessment is stored rather than derived from the [findings](finding.md) that
link to it. A count of supporting versus contradicting findings is not a
judgement — three weak findings do not outweigh one decisive one — and a model
that computed it would be asserting a confidence nobody chose.

## Belongs to a question

`questionId` is required. A hypothesis with no question is a claim with nothing
at stake — there is no criterion for what would settle it, and no place for the
answer to go once it is settled. If a hypothesis outgrows its question, the
question is the thing to revise.

`projectId` is stored alongside it despite being derivable, so hypotheses can be
queried project-wide without joining through questions.

## Related

[question](question.md) · [finding](finding.md)
