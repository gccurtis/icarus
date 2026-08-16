# API: `unlink`

Withdraws one edge.

Registered as `api.capabilities.researchLinks.unlink`, built from
`projectMutation`.

## Procedure Tree

```text
unlink(ctx, scope, id)
├── ctx.db.get(id)                            unlink.ts
├── endpointIn(ctx, scope, kind, id)  × 2     ../shared/endpoint.ts
├── ctx.db.delete(id)                         unlink.ts
└── record(ctx, scope, "unlinked")            ../../../activity/api/shared/record.ts
```

## A real delete, and it says nothing about either end

An edge is an assertion about two objects rather than an object with a history,
so withdrawing one leaves no state behind and touches neither end. A finding that
turns out not to bear on a hypothesis after all is not evidence of anything about
the finding.

Because [`link`](../link/link.md) refuses a duplicate, this is also how a bearing
drawn wrongly is corrected: withdraw the edge, draw it again.

## A missing end does not stop it

Both labels are read for the log before the row goes, and each falls back to its
kind when the object is already gone. An edge pointing at a deleted question is
the one most worth removing, so failing on a label it cannot read would block the
cleanup this exists for.

## What it refuses

| Error code | Cause |
| --- | --- |
| `not-found` | a link that never existed, or one in another project |
