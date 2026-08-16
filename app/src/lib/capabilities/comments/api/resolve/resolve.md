# API: `resolve`

Closes a discussion, keeping every word of it.

Registered as `api.capabilities.comments.resolve`, built from `projectMutation`.

## Procedure Tree

```text
resolve(ctx, scope, threadId)
├── requireThread(ctx, scope, threadId)      ../shared/require-thread.ts
├── ctx.db.patch(threadId, { status, … })    resolve.ts
└── record(ctx, scope, "resolved")           ../../../activity/api/shared/record.ts
```

## Resolved hides; it never deletes

Review discussions are often the only record of why something is the way it is, and
deleting on resolve throws that away at precisely the moment it starts being
useful. Nothing in this capability deletes a thread, so there is no button that
does it by accident.

## The resolver is a user, not an actor

Anything can raise a remark — an agent reviewing a document routinely does — but
deciding a question is settled is a judgement a person makes, and it is recorded
as `Id<"users">` rather than as an `Actor` so that it cannot quietly become
something a process did.

It is built from `ctx.scope`, never accepted: an argument naming the resolver would
let a caller record somebody else's judgement.

## Resolving a resolved thread is refused

The patch would overwrite `resolvedBy` and `resolvedAt`, which is the one fact this
write exists to record. A second click is cheap to refuse and expensive to honour.
