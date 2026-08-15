# API: `list`

Every setting in one project, in key order.

Registered as `api.capabilities.settings.list`. **Reachable by an untrusted browser, and it
trusts the `projectId` it is given** — see [`overview.md`](../../overview.md).

## Procedure Tree

```text
list(ctx, projectId)
├── ctx.db.query("settings")
│   └── withIndex("by_project_and_key", projectId)   scoped read; the index supplies the order
└── JSON.parse each stored value                     list.ts
```

## Ordering is the index, not a sort

`by_project_and_key` is ordered, so a range scan over one project's keys arrives sorted.
Nothing sorts afterwards, and nothing can disagree about what "key order" means.

## Unpaged

A project holds tens of settings. Pagination would be a contract every caller has to satisfy
in exchange for nothing today, and `.paginate()` replaces `.collect()` without changing the
shape of anything above it when that stops being true.
