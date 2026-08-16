# API: `remove`

Deletes a workbook.

Registered as `api.capabilities.spreadsheets.remove`, built from
`projectMutation`.

## Procedure Tree

```text
remove(ctx, scope, id)
├── requireSpreadsheet(ctx, scope, id)      ../shared/require-spreadsheet.ts
├── discard(ctx, resource)                  ../../../revisions/api/shared/discard.ts
├── ctx.db.delete(id)                       remove.ts
└── record(ctx, scope, "deleted")           ../../../activity/api/shared/record.ts
```

## The title is read before the row goes

The entry has to name which workbook was deleted, and after the delete there is
nothing left to ask.

## The body goes too, and not merely to reclaim the storage

[`revisions`](../../../revisions/overview.md) keys a workbook's snapshots and
change sets on `("spreadsheet", id)` and scopes a read off the leader snapshot
and a write off the head change set. Neither consults this row. So a workbook
whose body outlived it is a deleted workbook that anyone holding the id can still
read and still edit.

`discard` deletes both tables' rows for the pair, in this same transaction.

## A real delete, not archival

Hiding without destroying is `projects.archivedAt`, at the project level.
