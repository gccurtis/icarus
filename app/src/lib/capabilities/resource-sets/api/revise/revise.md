# API: `revise`

Replaces a set with the version the author has in front of them.

Registered as `api.capabilities.resourceSets.revise`, built from
`projectMutation`.

## Procedure Tree

```text
revise(ctx, scope, setId, revision, draft)
├── requireSet(ctx, scope, setId)        ../shared/require-set.ts
├── revision check                       revise.ts
├── resourceSetName(draft.name)          ../../types/resource-set.ts
├── ctx.db.patch(setId, …)               revise.ts
└── record(ctx, scope, "revised")        ../../../activity/api/shared/record.ts
```

## The whole draft, not a patch

An absent field would have to mean either "unchanged" or "cleared" without being
able to say which, and clearing a description is an ordinary edit.

## The stale check matters more here than for a document

A set is referenced rather than copied, so narrowing one silently narrows every
persona, prompt block, and derived output that names it. Convex's transactions
cover a read and a write inside one mutation; they do not cover the form somebody
left open while someone else edited the same scope.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `not-found` | the set is absent, or in another project — never told apart |
| `stale` | the revision the form was opened at is not the one stored |
| `empty-name` | a set nothing can pick out of a list |
