# API: `remove`

Deletes a document.

Registered as `api.capabilities.documents.remove`, built from `projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireDocument(ctx, scope, id)         ../shared/require-document.ts
├── discard(ctx, resource)                  ../../../revisions/api/shared/discard.ts
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

## The body goes too, and not merely to reclaim the storage

[`revisions`](../../../revisions/overview.md) keys a document's snapshots and
change sets on `("document", id)`, and scopes a read off the leader snapshot and
a write off the head change set. Neither consults the `documents` row. So a
document whose body outlived it is not orphaned storage waiting for a collector —
it is a deleted document that anyone holding the id can still read and still
edit, with a head revision and no resource under it.

`discard` deletes both tables' rows for the pair, in this same transaction. One
transaction, so there is nothing to observe halfway; split across several, the
leader and the `recent` sets would have to go first, because the head falls back
from one to the other.

**The change-set log is not pruned anywhere else**, so its length is whatever the
document accumulated. Retention for `historical` sets is unbuilt, and when it
arrives the tail of this delete belongs to it.
