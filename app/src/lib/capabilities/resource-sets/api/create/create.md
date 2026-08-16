# API: `create`

Names an expression, and returns the set's id.

Registered as `api.capabilities.resourceSets.create`, built from
`projectMutation`, so the handler receives `ctx.scope` rather than a project it
could have chosen.

## Procedure Tree

```text
create(ctx, scope, draft)
├── resourceSetName(draft.name)          ../../types/resource-set.ts
├── ctx.db.insert("resourceSets", …)     create.ts
└── record(ctx, scope, "created")        ../../../activity/api/shared/record.ts
```

## The expression is stored as written

Not resolved, not normalized, not checked against what currently exists.
Resolving on save would produce a list, and a list is what a set is not.

**A reference to another set is not checked either.** The only complete check is
at resolution: a cycle takes two writes to make — A can reference B before B
references A — and what a set selects depends on rows that change after it is
saved. Half a check here would suggest a guarantee that does not exist, and
[`resolve`](../resolve/resolve.md) has to make the whole one anyway.

## It returns the id and nothing else

The id is the one thing the caller does not already know. Convex re-runs `list`
for every subscriber the moment this commits, so an echoed row would be a second
answer, staler than the one already on its way.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `empty-name` | a set nothing can pick out of a list |
