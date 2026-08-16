# API: `list`

One project's decks.

Registered as `api.capabilities.slideDecks.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("slideDecks")
│   └── withIndex("by_project", scope.projectId)   the scoped range
└── drop projectId from each row                   list.ts
```

## Cheap because the row is small, and here that is the whole gallery

A deck body carries embedded images and per-element layout — it is the largest of
the three bodies — and none of it is read to list a project's decks. Every row
returned carries `aspectRatio`, which is exactly what a thumbnail needs and the
reason that field is on the row rather than in the theme.

## Unordered beyond the index

`by_project` carries no second field, so rows arrive in creation order. Title
order and recency are both a sort over a list the caller already holds.

## Another project's decks are absent, not refused

The index range is one project's, so there is no cross-project case here and no
error to raise — unlike `rename` and `remove`, which are handed an id and have to
answer for it.
