# API: `edit`

Rewrites a remark, and marks it as rewritten.

Registered as `api.capabilities.comments.edit`, built from `projectMutation`.

## Procedure Tree

```text
edit(ctx, scope, commentId, blocks, mentions?)
├── requireComment(ctx, scope, commentId)    require-comment.ts
├── commentBody(blocks)                      ../../types/comment.ts
├── ctx.db.patch(commentId, { editedAt })    edit.ts
├── requireThread(ctx, scope, threadId)      ../shared/require-thread.ts
└── record(ctx, scope, "edited")             ../../../activity/api/shared/record.ts
```

## Only the person who said it may change it

Which puts an agent's remarks beyond editing by anybody, and that is the right
answer rather than a gap. A comment is attributed, and rewriting words under
somebody else's name changes what they are recorded as having said — the fact that
an agent will not object is not a reason to let it happen.

Correcting somebody else is a reply.

## The prior text is not kept

A comment is a turn in a conversation rather than a document, and version history
for one would be storage nobody reads. `editedAt` is the whole of what a reader
needs, which is that this is not what was written.

`mentions` is replaced rather than merged, for the same reason: it is extracted
from the words, and the old words are gone.

## `requireComment` decides access; the thread is read for the log

The comment's own `projectId` is what admits the caller — never the thread's, which
is [the reason that column exists](../../overview.md#a-comment-carries-its-own-projectid).
The thread is read afterwards, and only so the activity entry can say what the
remark is attached to.
