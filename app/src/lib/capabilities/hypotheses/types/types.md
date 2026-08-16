# Hypotheses Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`hypothesis.ts`](hypothesis.ts) | `hypothesisAssessmentValidator`, `HypothesisAssessment`, `Hypothesis`, `HypothesisDraft`, `hypothesisStatement`, `hypothesisAssessment`, `hypothesisConfidence` |

## The assessment validator is the model

`schema.ts` imports it and so does the deployment door, which makes the column's
five literals and the door's refusal of a sixth the same statement.
`hypothesisAssessment` reads its set off the validator's own members, so there is
one list and it cannot drift.

## `hypothesisConfidence` states the rule the schema cannot

`v.optional(v.number())` says a confidence may be absent. What it cannot say is
that an *untested* claim must not have one, or that a confidence is a probability
— both are constraints across two values, which no validator expresses.

Keeping it here rather than in `api/shared/` is deliberate: it says what a
confidence *is*, which is a statement about the model rather than a step in a
procedure.

## `Hypothesis` is not the row

It carries `id`, drops `projectId`, and keeps `revision` — a client cannot send
back a revision it was never given.
