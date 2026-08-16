# API: `remove`

Deletes a deck.

Registered as `api.capabilities.slideDecks.remove`, built from `projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireDeck(ctx, scope, id)             ../shared/require-deck.ts
├── discard(ctx, resource)                  ../../../revisions/api/shared/discard.ts
├── ctx.db.delete(id)                       remove.ts
└── record(ctx, scope, "deleted")           ../../../activity/api/shared/record.ts
```

## The title is read before the row goes

The entry has to name which deck was deleted, and after the delete there is
nothing left to ask. That is the concrete case for activity storing labels rather
than joining for them.

## The body goes too, and not merely to reclaim the storage

[`revisions`](../../../revisions/overview.md) keys a deck's snapshots and change
sets on `("slides", id)` and scopes a read off the leader snapshot and a write
off the head change set. Neither consults this row. So a deck whose body outlived
it is not orphaned storage waiting for a collector — it is a deleted deck that
anyone holding the id can still read and still edit.

`discard` deletes both tables' rows for the pair, in this same transaction.

## A real delete, not archival

Hiding without destroying is `projects.archivedAt`, at the project level. Nothing
here is soft.
