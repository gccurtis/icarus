# API: `link`

Draws one edge: this bearer bears on this subject, and here is how.

Registered as `api.capabilities.researchLinks.link`, built from
`projectMutation`.

## Procedure Tree

```text
link(ctx, scope, draft)
├── researchLinkPair(bearerKind, subjectKind)         ../../types/research-link.ts
├── researchLinkBearing(bearerKind, bearing)          ../../types/research-link.ts
├── researchLinkNote(note)                            ../../types/research-link.ts
├── endOf(ctx, scope, kind, id)  × 2                  link.ts
│   └── endpointIn(ctx, scope, kind, id)              ../shared/endpoint.ts
├── ctx.db.query("researchLinks").withIndex("by_bearer_subject")  link.ts
├── ctx.db.insert("researchLinks", { … })             link.ts
└── record(ctx, scope, "linked")                      ../../../activity/api/shared/record.ts
```

## The pair is the edge's identity

A second link between the same two ends is refused whatever bearing or note comes
with it. Direction is canonical, so "the same two ends" is unambiguous — and a
duplicate is not a near-miss to tolerate: it would make "the evidence for this
hypothesis" a list with the same finding in it twice, each row free to disagree
with the other about what the finding says.

**Convex has no unique index, so this is an invariant the mutation maintains.**
The read of `by_bearer_subject` and the insert that follows it are one
serializable transaction, which is the whole mechanism — no retry loop, no
version column, and nothing to reconcile afterwards.

Correcting a bearing is [`unlink`](../unlink/unlink.md) and then this again.

## Both ends are proved before anything is written

`(kind, id)` is a key, not two loose columns: the kind names the table and
`normalizeId` decides whether the id was minted for it. An id from another table,
a row that is gone, and a row in somebody else's project all answer the same way
— **not found, never forbidden** — because telling them apart confirms what
another project holds.

This is also what lets every index lead with `projectId`: an edge cannot cross
projects, so the prefix costs no query.

## What it refuses

| Error code | Cause |
| --- | --- |
| `illegal-pair` | a pairing the model does not have, including any reversed one |
| `bearing-not-evidence` | a bearing on a link whose bearer is not a finding |
| `unknown-bearing` | a bearing outside supports / contradicts / neutral |
| `not-found` | an endpoint absent, in another project, or from another table |
| `duplicate` | the same two ends, already linked |
