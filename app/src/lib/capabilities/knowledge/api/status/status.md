# API: `status`

What the project's lattice is — what built it, how deep it goes, how much of it
is stale, and whether it can be queried as a coherent index.

Registered as `api.capabilities.knowledge.status`, built from `projectQuery`, so
the caller's token is resolved to a membership before this runs.

## Procedure Tree

```text
status(ctx, scope)
└── readVersion()                       ../shared/version.ts
```

## Nothing is an answer, not a refusal

A project nobody has written in yet has no lattice, and neither does one whose
first ingest has not run. Both are ordinary states, and an error would turn a
readiness badge into an incident.

## The counts are read, never computed

`nodeCount`, `nodesByLevel`, and `staleCount` are maintained on the row because
this renders on every project view. Counting rows to draw a badge would scan the
lattice on every subscription update. They are approximate by nature and
corrected on rebuild — which is the trade this makes on purpose.

`levelCount` of 1 means level 0 exists and nothing is clustered. It is what
ingestion leaves behind every time, and a reader has to know it before choosing
between descending the hierarchy and searching level 0 directly.
