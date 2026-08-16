# API: `revise`

Replaces a question with the version the author has in front of them.

Registered as `api.capabilities.questions.revise`, built from `projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, draft)
├── requireQuestion(ctx, scope, id)              ../shared/require-question.ts
├── questionText(draft.text)                     ../../types/question.ts
├── resolveParent(ctx, scope, parentId, id)      ../shared/resolve-parent.ts
├── ctx.db.patch(id, { text, notes, parentId })  revise.ts
└── record(ctx, scope, "revised")                ../../../activity/api/shared/record.ts
```

## `revision` is the stale-form check

Convex's transactions cover a read and a write inside one mutation. They do not
cover a form opened before lunch, and `notes` are exactly what somebody spends
that long on.

**Rejection is the whole mechanism.** The client is told the question moved and
decides what to do — no merging, no field-level reconciliation. That is the
difference between a question and a
[general resource](../../../revisions/overview.md), where concurrent editing is
the point and merging is worth its machinery.

## An absent `parentId` moves the question to the root

The draft is the whole question, so "unchanged" has nowhere to be said. Inventing
it would mean a question could never leave a parent, which is the one move a
decomposition that went wrong needs.

## Status is not part of the draft

It is one click from a list rather than a field in a form, which is also why
[`setStatus`](../set-status/set-status.md) takes no revision.
