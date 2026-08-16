# API: `create`

Starts a workbook, and returns its id.

Registered as `api.capabilities.spreadsheets.create`, built from
`projectMutation`.

## Procedure Tree

```text
create(ctx, scope, title, templateId?, body?)
├── spreadsheetTitle(title)                 ../../types/spreadsheet.ts
├── ctx.db.insert("spreadsheets", …)        create.ts
├── emptySpreadsheetBody()                  ../../types/body.ts
├── start(ctx, scope, resource, body)       ../../../revisions/api/shared/start.ts
└── record(ctx, scope, "created")           ../../../activity/api/shared/record.ts
```

`body` is the one a template supplies, and the empty one otherwise — see
[`templates.instantiate`](../../../templates/api/instantiate/instantiate.md). It
is stored as given and never read, which is what makes a workbook from a template
a complete copy that owes it nothing.

## The row and the body are written together

A workbook with no leader snapshot is a row that opens to a refusal. Both are
written in this one transaction, and what an empty body looks like is decided
here rather than in `revisions`, which has never inspected one.

## An empty workbook has no sheets

Named styles, and nothing else. A sheet carries an id, and minting one here would
put a server-chosen identity into the workbook's id space before any client had
authored anything — the same reason a new document has no rows. The client's
first change set adds the first sheet.
