# API: `list`

Every persona the caller may work with: their project's, and the ones belonging
to no project.

Registered as `api.capabilities.personas.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── db.query("personas").withIndex("by_project", projectId = mine)       list.ts
├── db.query("personas").withIndex("by_project", projectId = undefined)  list.ts
└── asPersona(row)                                                      as-persona.ts
```

## Two ranges of one index, never a scan

A missing field indexes as `undefined` and sorts before every id, so the globals
are a key range of their own: `eq("projectId", undefined)` is exactly them, and
the project range cannot stray into another project's rows. That is the whole
reason the optional column still leads the index.

## The definition comes with it

Unlike [`templates.list`](../../../templates/api/list/list.md), which leaves the
bodies behind, there is no authored page here to drag across the wire — five
short sections is the whole of a persona, and an editor opened from the list
would otherwise need a second read to show what it is about to change.
