# API: `reply`

Adds a remark to a discussion, and returns its id.

Registered as `api.capabilities.comments.reply`, built from `projectMutation`.

## Procedure Tree

```text
reply(ctx, scope, threadId, blocks, mentions?)
├── requireThread(ctx, scope, threadId)      ../shared/require-thread.ts
├── commentBody(blocks)                      ../../types/comment.ts
├── ctx.db.insert("comments", …)             reply.ts
├── ctx.db.patch(threadId, { updatedAt })    reply.ts
└── record(ctx, scope, "replied")            ../../../activity/api/shared/record.ts
```

## A reply does not reopen a resolved thread

A resolved discussion is still a discussion, and adding to it — a correction, a
link, a note for whoever reads this next year — is an ordinary thing to do.
Deciding the question is open again is a different judgement, and it has
[its own function](../reopen/reopen.md).

## The anchor is not re-resolved

It was resolved when the thread was opened and it names an id, so the block it
points at is the same block however much has been written since. Re-resolving on
every reply would read the resource's whole change-set window to confirm something
that cannot have changed.

## `updatedAt` moves and nothing else does

It is what a "recently active" list reads. The anchor, the status, and the
attribution are all facts about when the thread was opened, and a reply is not
evidence about any of them.
