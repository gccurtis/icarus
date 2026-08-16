# API: `setStatus`

Says where a question now stands.

Registered as `api.capabilities.questions.setStatus`, built from
`projectMutation`.

## Procedure Tree

```text
setStatus(ctx, scope, id, status)
├── requireQuestion(ctx, scope, id)     ../shared/require-question.ts
├── questionStatus(status)              ../../types/question.ts
├── ctx.db.patch(id, { status })        set-status.ts
└── record(ctx, scope, "marked")        ../../../activity/api/shared/record.ts
```

## It takes no revision, and still moves one

There is no form behind a click in a list, so there is no stale draft to catch.
The `revision` still advances, because the question a form was opened against is
no longer the question on the row — and letting that form save afterwards is
exactly what the counter exists to stop.

## `parked` is refused twice

The door's validator lists three literals, so a fourth never reaches this
function in a deployment. `questionStatus` refuses it again one step in, which
covers a caller inside the deployment and turns what would otherwise be a schema
fault into a stated refusal.

## Nothing is enforced against the children

A question can be answered while its sub-questions are open. Deciding otherwise
would be the model ruling on a decomposition that went somewhere unexpected,
which is the researcher's call.

The entry's verb is `marked` and the status is its `detail`, so the log reads as
what happened rather than as a field that changed.
