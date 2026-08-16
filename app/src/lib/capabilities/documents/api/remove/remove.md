# API: `remove`

Deletes a document.

Registered as `api.capabilities.documents.remove`, built from `projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireDocument(ctx, scope, id)         ../shared/require-document.ts
├── ctx.db.delete(id)                       remove.ts
└── record(ctx, scope, "deleted")           ../../../activity/api/shared/record.ts
```

## The title is read before the row goes

The entry has to name which document was deleted, and after the delete there is
nothing left to ask. Reading it first is the whole of it — and it is the concrete
case for activity storing labels rather than joining for them, because here the
subject is gone by the time anyone reads the log.

## A real delete, not archival

Hiding without destroying is `projects.archivedAt`, at the project level. Nothing
here is soft: a deleted document is gone, and what a caller wanted instead is a
different affordance rather than a flag on this one.

## Pass 2 gives this more to delete

There is no body yet. When the leader snapshot and the change-set log arrive,
removal has to take them with it — a document's rows outliving the document would
be storage nothing can reach and nothing will collect.
