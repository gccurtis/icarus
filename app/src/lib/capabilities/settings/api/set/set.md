# API: `set`

Writes one setting, creating it if this project has not set it before.

Registered as `api.capabilities.settings.set`. **Reachable by an untrusted browser, and it
trusts the `projectId` it is given** — see [`overview.md`](../../overview.md).

## Procedure Tree

```text
set(ctx, projectId, key, value)
├── canonicalKey(key)                                 ../../types/settings.ts
├── reject an empty key                               set.ts
├── ctx.db.query("settings")
│   └── withIndex("by_project_and_key", project, key) .unique()
├── ctx.db.patch  when the row exists                 set.ts
└── ctx.db.insert otherwise                           set.ts
```

## Read-then-write is safe without a unique index

Convex has none. What makes this correct instead is that a mutation is one serializable
transaction: the index range read above is part of its read set, so a concurrent write of the
same key forces this mutation to re-run, and the re-run finds the row and patches it. Two
callers setting one key cannot both insert.

That is the whole reason there is no compare-and-swap here. Under a store without
transactions this needed a revision column and a conditional update; the transaction replaces
both.

## The key is canonicalized before the lookup

Not after. Canonicalizing afterwards would let `Editor.Theme` miss an existing `editor.theme`
and insert a second row, which is the exact defect the canonical form exists to prevent.
