# API: `read`

One output whole: its content, what produced it, and where that stood.

Registered as `api.capabilities.derivedOutputs.read`, built from `projectQuery`.

## Procedure Tree

```text
read(ctx, scope, id)
├── requireOutput(ctx, scope, id)        ../shared/require-output.ts
└── effectiveState(ctx, scope, output)   ../shared/staleness.ts
    ├── inputRevisions(ctx, scope, …)    ../shared/staleness.ts   where the inputs are now
    └── movedSince(recorded, current)    ../shared/staleness.ts   the comparison
```

## The state is folded rather than read off the row

The stored state is the lifecycle this capability drives — `idle`, `generating`,
`fresh`, `error`. `stale` is a comparison against the inputs as they stand, so it
is computed on the read that needs it.

Only `fresh` folds. An `error` stays an error however far its inputs have moved:
what is shown survived a failed attempt, and calling it stale would claim the
last generation succeeded.

## It returns the provenance, not just the content

`inputsAt` and `latticeVersion` go back with the block, because they are what
make the output explicable — "why does this say revenue grew" is answerable by
reading the source at the revision the generation actually saw. Without them a
stale output is indistinguishable from a hallucination.
