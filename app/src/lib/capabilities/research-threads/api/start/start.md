# API: `start`

Opens a research thread, and returns its id.

Registered as `api.capabilities.researchThreads.start`, built from
`projectMutation`.

## Procedure Tree

```text
start(ctx, scope, draft)
├── researchThreadTitle(draft.title)               ../../types/research-thread.ts
├── researchThreadAnchor(draft.mode, draft)        ../../types/research-thread.ts
├── requireAnchor(ctx, scope, anchor)              ../shared/require-anchor.ts
├── ctx.db.insert("researchThreads", { mode, … })  start.ts
└── record(ctx, scope, "started")                  ../../../activity/api/shared/record.ts
```

## It creates one row, and that row is the thread

Nothing is created beside it. The first turn is
[`messages.post`](../../../messages/api/post/post.md) naming this id, so a thread
that nobody has spoken in yet is a thread with no messages rather than an empty
conversation object.

## A `discover` thread starts anchored to nothing

That is the mode rather than an incomplete thread. Discovery is driven by its
prompt, and it is how questions get found in the first place — so requiring an
anchor here would make the most common way research begins the one thing this
function refuses.

## The anchor is proved before the row is written

[`requireAnchor`](../shared/require-anchor.ts) answers "not found" for a question
in another project, exactly as it would for one that never existed. A thread that
pointed out of its project would put someone else's question on a context panel.
