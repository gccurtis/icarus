# API: `list`

The templates this project may start from: its own, and the ones belonging to no
project.

Registered as `api.capabilities.templates.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── db.query("templates").withIndex("by_project", eq(projectId, scope.projectId))
├── db.query("templates").withIndex("by_project", eq(projectId, undefined))
└── asTemplate(row)                          list.ts
```

## Two ranges of one index, and why that is still scoped

A missing field indexes as `undefined` and sorts before every id, so the globals
are a key range of their own. `eq("projectId", undefined)` is exactly them and
`eq("projectId", mine)` is exactly mine — neither range can reach another
project's rows, which is the property `projectId`-leads-every-index exists for.

The alternative readings are in [`overview.md`](../../overview.md): a sentinel a
`v.id("projects")` cannot hold, or a second table that would make `templateId` a
union of two id types everywhere it appears.

## The bodies stay behind

`target` is on the row precisely so a picker can offer the document templates
without dragging every authored page across the wire. `slots` come along because
a picker showing what a template will ask for is the point of choosing one.
