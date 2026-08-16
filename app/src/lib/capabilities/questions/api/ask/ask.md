# API: `ask`

Writes a question down, and returns its id.

Registered as `api.capabilities.questions.ask`, built from `projectMutation`, so
the caller's token is resolved to a membership before this runs.

## Procedure Tree

```text
ask(ctx, scope, draft)
├── questionText(draft.text)                 ../../types/question.ts
├── resolveParent(ctx, scope, parentId)      ../shared/resolve-parent.ts
├── ctx.db.insert("questions", …)            ask.ts
└── record(ctx, scope, "asked")              ../../../activity/api/shared/record.ts
```

## It starts `open` and nothing else is attached

`open` is where a question waits as well as where it begins, so nothing else
could be the starting value — and a question is complete the moment it is written
down, because hypotheses and findings arrive later as research links rather than
as fields here.

## `resolveParent` runs even though nothing can cycle yet

A new question has no descendants, so the walk cannot refuse anything on that
count. What it does prove is that the parent is a question in the caller's own
project — the same "not found, never forbidden" answer as any other id.
