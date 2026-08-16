# API: `rename`

Gives a workbook a different name.

Registered as `api.capabilities.spreadsheets.rename`, built from
`projectMutation`.

## Procedure Tree

```text
rename(ctx, scope, id, title)
├── requireSpreadsheet(ctx, scope, id)      ../shared/require-spreadsheet.ts
├── spreadsheetTitle(title)                 ../../types/spreadsheet.ts
├── ctx.db.patch(id, title, updatedBy, …)   rename.ts
└── record(ctx, scope, "renamed")           ../../../activity/api/shared/record.ts
```

## The workbook's title, not a sheet's

A sheet is named inside the body, so renaming one is a change set like any other
edit to the grid — and undoable for the same reason. The workbook's title is on
the row because a list, a tab, and a search result all want it without opening
the body.

## The entry carries the new name

The log reads as what happened. Entries written before this one keep the old
name, which is right: they describe the workbook as it was when they were
written.
