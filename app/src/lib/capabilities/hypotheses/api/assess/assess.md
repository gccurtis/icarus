# API: `assess`

Records the judgement on a claim, and how sure of it whoever made it is.

Registered as `api.capabilities.hypotheses.assess`, built from `projectMutation`.

## Procedure Tree

```text
assess(ctx, scope, id, assessment, confidence?)
├── requireHypothesis(ctx, scope, id)                    ../shared/require-hypothesis.ts
├── hypothesisAssessment(assessment)                     ../../types/hypothesis.ts
├── hypothesisConfidence(assessment, confidence)         ../../types/hypothesis.ts
├── ctx.db.patch(id, { assessment, confidence })         assess.ts
└── record(ctx, scope, "assessed")                       ../../../activity/api/shared/record.ts
```

## The judgement is stored, and this is the only thing that writes it

Nothing derives an assessment from the findings that link to the hypothesis. A
count of supporting against contradicting links is not a judgement — three weak
findings do not outweigh one decisive one — and a derived column would assert a
confidence nobody chose.

`testing` and `inconclusive` are why the five values are one field rather than a
verdict plus a flag: `testing` says work is under way, which `untested` would read
as nobody having started, and `inconclusive` says the work finished without
settling anything, which `untested` would erase.

## It takes no revision, and still moves one

A judgement is made with the hypothesis in front of you rather than filled in over
minutes, so there is no stale draft to catch. The `revision` still advances,
because the hypothesis a form was opened against is no longer the one on the row.

## Confidence follows the assessment, and never leads it

A confidence on an `untested` claim is refused, and moving back to `untested`
clears one that was there — a number left behind would stand for a judgement that
was withdrawn. Out of `0`–`1` is refused too: a confidence that is not a
probability is not a confidence.

Both are constraints between two values, which is why they live in
[`types/`](../../types/types.md) rather than in the door's validators.
