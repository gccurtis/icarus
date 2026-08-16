# API: `reopen`

Says a discussion is not settled after all.

Registered as `api.capabilities.comments.reopen`, built from `projectMutation`.

## Procedure Tree

```text
reopen(ctx, scope, threadId)
├── requireThread(ctx, scope, threadId)      ../shared/require-thread.ts
├── ctx.db.patch(threadId, { status, … })    reopen.ts
└── record(ctx, scope, "reopened")           ../../../activity/api/shared/record.ts
```

## It exists because resolution has to be reversible

"[Resolved rather than deleted](../resolve/resolve.md)" only means anything if a
thread closed by mistake can come back — otherwise it is unreachable in every
surface that hides resolved threads, which is the same outcome as deletion reached
by a different route.

## The resolver is cleared rather than kept

Who closed it is only interesting while it is closed. A name left beside an open
thread reads as a claim that somebody settled it, which is exactly what reopening
says is not true. The activity log is where the history of both lives.
