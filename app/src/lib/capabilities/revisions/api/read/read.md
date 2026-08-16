# API: `read`

A general resource's current body, and the revision to author against.

Registered as `api.capabilities.revisions.read`, built from `projectQuery`, so
the caller's token is resolved to a membership before this runs and the handler
receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
read(ctx, scope, resource)
├── current(ctx, scope, resource)     ../shared/current.ts   leader + the sets past it
└── applyOps(leader.body, ops)        ../shared/apply/apply.ts
```

## The cost is a constant, and that is the whole design

| | Rows read |
| --- | --- |
| Leader snapshot | 1 |
| Recent change sets | ≤ `consolidateAfter` |

Bounded at **`consolidateAfter + 1`** here, 102 counting the resource row a
caller already had. And bounded **independently** of how many documents the
project has, how many change sets exist in total, how long this resource has been
edited, and how many people are editing it right now. None of those appear in the
cost.

That is what [`resourceSnapshots`](../../schema.ts) exists for. A leader is not an
optimization added to a log — it *is* the change sets already folded, materialized
once so nobody folds them twice. Without one, opening a document replays every
edit it ever had, and the cost grows fastest for the documents people use most.

Interleaving does not enter into it. A Convex index is a B-tree sorted by its
field tuple, not by insertion time, so three equalities and a range on the fourth
field is one contiguous scan over exactly the matching rows — other resources'
sets are never reached rather than scanned and discarded.

## `revision` is returned because nothing stores it

The resource row has no revision and neither does the leader's caller; it is the
last recent set's, read from the same range this already collected. A client
cannot author a change without it, and asking for it separately would be a second
read of rows this one already holds.

## Reading never writes

The fold is onto a copy. Folding onto `leader.body` would corrupt the anchor for
every read after it, and consolidation is the only thing that may move the leader
— which it does in a mutation, deliberately, with the sets it folded re-tiered in
the same transaction.

## Not found, never forbidden

The leader is the row that says whose the resource is: every index here leads with
the resource pair rather than `projectId`, so nothing about ranging over them is
scoped by the gate. A resource in another project answers exactly as one that was
never created, because telling them apart confirms it exists.
