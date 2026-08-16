# Shared Derived Output Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-output.ts`](require-output.ts) | that an output id names one in the caller's project, and that a caller learns nothing from the answer when it does not |
| [`staleness.ts`](staleness.ts) | that where an input stands is read one way, and that staleness is a comparison of revisions rather than of times |
| [`generation.ts`](generation.ts) | that a generation's outcome is recorded whole, and that a failed one leaves the content standing |

## `staleness.ts` holds both halves on purpose

`inputRevisions` is used twice: once by `completeGeneration` to record where the
inputs stood, and once by every read to ask where they stand now. **Two readings
of "what revision is this" that could disagree would make the comparison between
them meaningless**, so there is one function and both callers use it.

`movedSince` is pure over the two lists, which is what makes the case table
testable directly: a revision that grew, a revision that did not, an input that
left the set, and one that joined it.

```text
effectiveState(ctx, scope, output)
├── inputRevisions(ctx, scope, output.inputs)   staleness.ts
│   ├── head(ctx, resource)                     ../../../revisions/api/shared/head.ts
│   ├── ctx.db.get(findingId | fileId)          staleness.ts
│   └── bearers(ctx, scope, question, …)        ../../../research-links/api/bearers/bearers.ts
└── movedSince(recorded, current)               staleness.ts
```

## `generation.ts` is called from outside this capability

Like [`activity`'s `record`](../../../activity/api/shared/shared.md), its callers
are elsewhere: whatever ran the model call that
[`refresh`](../refresh/refresh.md) asked for.

**Both are registered nowhere.** The `api/` set and the deployment door name the
same functions, and neither of these is in either, because a client that could
write a body under an output's id could put anything in somebody's report and
have it dated as generated.

`failGeneration` touches `state`, `error`, and `updatedAt` and nothing else. That
absence is the behaviour: an output that emptied itself on a failed refresh would
turn a transient provider outage into a hole in somebody's report, and one that
moved `refreshedAt` would date content it did not produce.

## Promoted before the second caller exists

`requireOutput` has four callers today. `inputRevisions` has two and
`completeGeneration` one — and it is promoted anyway, because a procedure the
door must not expose has nowhere else to live: an `api/<verb>/` directory for it
would fail the correspondence lint by naming a function nobody registers.
