# API: `remove`

Deletes a question.

Registered as `api.capabilities.questions.remove`, built from `projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireQuestion(ctx, scope, id)                  ../shared/require-question.ts
├── ctx.db.query("questions").withIndex("by_parent") remove.ts
├── ctx.db.delete(id)                                remove.ts
└── record(ctx, scope, "deleted")                    ../../../activity/api/shared/record.ts
```

## A real delete, and the model asks for it

There is no status meaning "we are not doing this", so absence is how a question
nobody intends to pursue leaves the list. Everywhere else in the project a thing
is archived or resolved; this is the one place where deleting is the honest
answer.

## Sub-questions are refused, not cascaded

Deleting the subtree throws away work somebody did below the question that was
given up on. Re-parenting the children silently reshapes a decomposition. Both
are decisions for whoever is deleting, so the refusal names how many are in the
way and stops.

The text is read before the row goes, because the entry has to say which question
was deleted and there is nothing left to ask afterwards.
