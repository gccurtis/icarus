# API: `start`

Opens a discussion, and returns the thread's id.

Registered as `api.capabilities.comments.start`, built from `projectMutation`, so
the caller's token is resolved to a membership before this runs and the handler
receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
start(ctx, scope, input)
├── commentBody(input.blocks)                     ../../types/comment.ts
├── commentAnchor(input.anchor)                   ../../types/anchor.ts
├── resolveAnchor(ctx, scope, anchor, base)       resolve-anchor.ts
│   ├── current(ctx, scope, resource)             ../../../revisions/api/shared/current.ts
│   ├── applyOps(body, ops)                       ../../../revisions/api/shared/apply/apply.ts
│   ├── displaySpan(body, op)                     ../../../revisions/api/shared/apply/apply.ts
│   └── shift(offset, span, closing)              ../../../revisions/api/shared/apply/shift.ts
├── ctx.db.insert("commentThreads", …)            start.ts
├── ctx.db.insert("comments", …)                  start.ts
└── record(ctx, scope, "commented")               ../../../activity/api/shared/record.ts
```

## The thread and its first comment are written together

A thread with no remark on it is an anchor with nothing attached: it renders as a
marker in a document that nobody can act on and nobody can tell was a mistake.
Committing one without the other would produce exactly that.

## The anchor is resolved before it is stored

A selection is made against the revision the author was looking at, and edits land
while they are typing. Storing the range as sent would leave it pointing at text
that has moved — so `resolveAnchor` carries it forward and checks that what the
anchor names is still in the resource.

**The id half needs no carrying.** `#b7x2` is that block whatever is inserted above
it, which is the whole reason the anchor stores an id and not a position. What
moves is a text range's offsets, and they move op by op: each accepted edit's span
is computed against the body it applied to, because an op's `at` indexes its own
atom while the offsets index the block's whole display string.

**A bound the edit ran through collapses rather than refusing.** By the time an
edit has been accepted there is nobody to reject to — the same reason a mark
collapses instead of conflicting — and `quote` is what makes the result
recognizable as drifted rather than as a remark about whatever now sits there.

`quote` is taken from the body the author was looking at, not from the argument and
not from the body now: it is a record of what was selected, and a copy of the
current text would be no evidence of anything.

## A target with no body passes through

An external file has no interior this system can address, and `questions`,
`hypotheses`, and `findings` arrive in pass 4. An anchor is a kind string and an
id, so it never needed those tables to exist — only the three general resources
are resolved here, because only they have a body to resolve against.

## `baseRevision` is optional and means "now" when absent

Absent is the ordinary case of somebody commenting on what is in front of them
with nothing in flight. A revision below the leader snapshot is refused as
`anchor-stale`: the sets needed to carry the range forward have left the window,
which is the same boundary [`revisions.submit`](../../../revisions/api/submit/submit.md)
refuses a change at.
