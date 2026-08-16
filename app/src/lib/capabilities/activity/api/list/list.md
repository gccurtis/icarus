# API: `list`

One project's log, newest first.

Registered as `api.capabilities.activity.list`, built from `projectQuery`, so the
caller's project token is resolved to a membership before this runs and the
handler receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("activity")
│   ├── withIndex("by_project", scope.projectId)   the scoped range
│   └── order("desc")                              newest first
└── drop projectId and ids from each row           list.ts
```

## Newest first, and unpaged for now

A feed means newest first, and ordering here rather than in a caller is what
makes the eventual `.paginate()` a drop-in: the page a reader wants is already at
the head of the range.

Unpaged is a real deadline rather than a shrug. `settings.list` is unpaged
because a project holds tens of settings and always will; activity is append-only
and grows without bound. What buys the delay is that a young project's log is
short, not that it stays short.

## Another project's entries are absent, not refused

There is no cross-project case to handle and no error to raise: the index range
is one project's, so an entry belonging to someone else is simply not in it.
Refusing would be worse — it would confirm the entry exists.
