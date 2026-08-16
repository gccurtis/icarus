# API: `remove`

Deletes a file and the bytes behind it.

Registered as `api.capabilities.externalFiles.remove`, built from
`projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireFile(ctx, scope, id)              ../shared/require-file.ts
├── ctx.storage.delete(storageId)            remove.ts
├── ctx.db.delete(id)                        remove.ts
└── record(ctx, scope, "deleted")            ../../../activity/api/shared/record.ts
```

## The bytes go with the row

The row is the only thing that names the blob, so a row deleted without it leaves
storage nobody can reach and everybody pays for. Both happen in one transaction,
which is also what stops a failed delete from leaving a file that lists but does
not open.

The name is read before either, because the activity entry has to say which file
was deleted and there is nothing left to ask afterwards.

## A dangling `supersedes` is allowed

Deleting a file that a newer version replaced leaves that newer row's pointer
resolving to nothing. That is correct: the chain is history, not a dependency,
and the current file is whole without its predecessors. Refusing the delete would
make the oldest upload undeletable forever.
