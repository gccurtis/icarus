# API: `revise`

Restates what the thread is working on.

Registered as `api.capabilities.researchThreads.revise`, built from
`projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, id, revision, draft)
├── requireThread(ctx, scope, id)             ../shared/require-thread.ts
├── researchThreadTitle(draft.title)          ../../types/research-thread.ts
├── researchThreadAnchor(draft.mode, draft)   ../../types/research-thread.ts
├── requireAnchor(ctx, scope, anchor)         ../shared/require-anchor.ts
├── ctx.db.patch(id, { title, mode, … })      revise.ts
└── record(ctx, scope, "revised")             ../../../activity/api/shared/record.ts
```

## Re-anchoring is the discovery workflow

A discover thread that turns up the question it was looking for becomes a
question thread pointed at it, and one whose question dissolved goes back to
discovering. That is the work completing, which is why mode and anchor are part
of the draft rather than fixed at [`start`](../start/start.md).

## An absent anchor means no anchor

The draft is the whole thread, so "unchanged" has nowhere to be said — and
inventing it would leave `mode` and the ids two statements free to disagree about
what the thread is about.

## `revision` is the stale-form check

Two people are in one room and both can have the thread open. Convex's
transactions cover a read and a write inside one mutation; they cover neither of
those forms. Rejection is the whole mechanism — the client is told the thread
moved and decides what to do.
