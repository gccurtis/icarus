# API: `list`

The project's saved sets, as expressions.

Registered as `api.capabilities.resourceSets.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
└── ctx.db.query("resourceSets").withIndex("by_project", …)   list.ts
```

## It resolves nothing

A list that also answered "and here is what each of these currently holds" would
walk every table once per row, and would hand a reader a snapshot to mistake for
the set. That question is [`resolve`](../resolve/resolve.md), asked once, about
one expression, when something needs the answer.

So this stays one key range however much the project holds — the same property
`documents.list` has for the same reason.
