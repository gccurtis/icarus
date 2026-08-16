# API: `branch`

Continues a conversation from an earlier message into a new thread, and returns
its id.

Registered as `api.capabilities.personaThreads.branch`, built from
`projectMutation`.

## Procedure Tree

```text
branch(ctx, scope, from, title?)
├── requireThread(ctx, scope, from.threadId)       ../shared/require-thread.ts
├── requireBranchPoint(ctx, scope, from)           require-branch-point.ts
├── personaThreadTitle(title)                      ../../types/persona-thread.ts
├── ctx.db.insert("personaThreads", { branchedFrom: from, … })   branch.ts
└── record(ctx, scope, "branched")                 ../../../activity/api/shared/record.ts
```

## This is the answer to "I want to change what I said"

In every conversation in Icarus. Messages are append-only, so there is no editing
a chat and no undoing one — you take a different path from a point you liked, and
both paths remain.

**The original is untouched**, thread row and messages alike. That is not a
courtesy: a branch that rewrote its source would destroy the record it exists to
preserve.

## It copies nothing

What came before is reached through `branchedFrom`. Copying the earlier turns
would put a second version of an append-only log in the database, free to
disagree with the first, and would double a conversation on every branch of a
branch.

## The persona comes from the source thread

Not from the caller. A branch is the same conversation taking another route;
letting it change who is being talked to would make `branchedFrom` name a thread
it has nothing to do with. The title does default to the source's, because a
branch usually is about the same thing.
