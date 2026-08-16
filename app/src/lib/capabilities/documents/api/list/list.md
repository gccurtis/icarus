# API: `list`

One project's documents.

Registered as `api.capabilities.documents.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("documents")
│   └── withIndex("by_project", scope.projectId)   the scoped range
└── drop projectId from each row                   list.ts
```

## Cheap because the row is small

The body is not here, so listing a project's documents costs the metadata and
nothing else, however much has been written in them. That is the payoff for
keeping the content in a snapshot and a change-set log, paid back on every
sidebar render.

## Unordered beyond the index

`by_project` leads with the project and carries no second field, so rows arrive
in creation order. Title order and recency are both a sort over a list the caller
already holds, and a second index buys nothing until a project's documents stop
fitting in one read.

## Another project's documents are absent, not refused

The index range is one project's, so there is no cross-project case to handle
here and no error to raise — unlike `rename` and `remove`, which are handed an id
and have to answer for it.
