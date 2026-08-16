# API: `list`

The project's derived outputs, without their content.

Registered as `api.capabilities.derivedOutputs.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
├── ctx.db.query("derivedOutputs").withIndex("by_project")   list.ts
└── effectiveState(ctx, scope, output)                       ../shared/staleness.ts
```

## No block, and a count instead of the inputs

The content is read through the prompt block presenting it, never through a
directory of outputs. What a list is for is "which of these need refreshing",
which is the state and how much each is derived from.

## It folds the state per output, and that is deliberate

The cost is the declared inputs of each output — a handful of indexed reads
apiece, and none of them a body, because
[`head`](../../../revisions/api/shared/head.ts) reads two rows rather than
folding one. A list carrying the stored state would be cheaper and would be wrong
for exactly the outputs the list exists to find.
