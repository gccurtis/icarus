# API: `list`

One project's vocabulary, in the order it was defined.

Registered as `api.capabilities.nameManager.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("nameVariables").withIndex("by_project_and_order")   list.ts
└── asVariable(row)                                                   ../shared/as-variable.ts
```

## The order comes off the index, not a sort

`by_project_and_order` leads with the project and continues with
`definitionOrder`, so the range is already in the order a reader wants. That is
the whole reason the field is stored: sorting by creation time would leave two
variables defined in the same millisecond free to swap places between reads.

## Both forms of the name are returned

A caller displays `name` and looks up by `nameKey`. Handing back only the
authored casing would make every client re-implement the canonicalization, and
they would not all agree.
