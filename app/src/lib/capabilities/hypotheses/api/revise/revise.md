# API: `revise`

Replaces a hypothesis with the version the author has in front of them.

Registered as `api.capabilities.hypotheses.revise`, built from `projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, draft)
├── requireHypothesis(ctx, scope, id)                ../shared/require-hypothesis.ts
├── hypothesisStatement(draft.statement)             ../../types/hypothesis.ts
├── ctx.db.patch(id, { statement, rationale })       revise.ts
└── record(ctx, scope, "revised")                    ../../../activity/api/shared/record.ts
```

## `revision` is the stale-form check

Convex's transactions cover a read and a write inside one mutation. They do not
cover a form opened before lunch, and `rationale` — the argument for the claim,
with its prior evidence and its chart — is exactly what somebody spends that long
on.

**Rejection is the whole mechanism.** The client is told the hypothesis moved and
decides what to do; there is no merging and no field-level reconciliation.

## The assessment is untouched

Rewording a claim is not reassessing it. Clearing the judgement here would discard
somebody's work every time a typo was fixed, and carrying a new one in the draft
would mean an author who only wanted to fix the wording had to restate a verdict.

That is [`assess`](../assess/assess.md), which is also why this is the one of the
two that takes a revision.
