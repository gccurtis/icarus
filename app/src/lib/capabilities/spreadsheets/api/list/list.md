# API: `list`

One project's workbooks.

Registered as `api.capabilities.spreadsheets.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("spreadsheets")
│   └── withIndex("by_project", scope.projectId)   the scoped range
└── drop projectId from each row                   list.ts
```

## Cheap because the row is small

The grid is not here, so listing a project's workbooks costs the metadata and
nothing else, however many cells have been filled in.

## Unordered beyond the index

`by_project` carries no second field, so rows arrive in creation order. Title
order and recency are both a sort over a list the caller already holds.

## Another project's workbooks are absent, not refused

The index range is one project's, so there is no cross-project case here and no
error to raise — unlike `rename` and `remove`, which are handed an id.
