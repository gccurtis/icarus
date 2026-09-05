# derived-output

A project-scoped, pull-refreshed answer grounded in the Semantic Overlay.

`createDerivedOutput` stores a prompt and optional `ResourceSet` in `idle`.
`updateDerivedOutput` changes that definition and marks an existing answer
`stale` without erasing it. `readDerivedOutput` compares citation snapshots to
active source revisions and reports effective staleness without writing every
output when one source changes.

`refreshDerivedOutput` is the only synthesis path. It acquires the row's
`generating` state before its first asynchronous provider call, then gives one
bounded agent two tools:

1. `retrieve` calls the Semantic Overlay query and returns opaque handles plus
   provenance, never source text.
2. `read` resolves those handles to exact span text and copies the associated
   citation into application-owned attempt state.

The model cannot author its own evidence. Before publication, cited source
revisions are compared with active source rows. A mismatch discards the entire
attempt and retries from current retrieval; bounded repeated churn records an
error while preserving the previous response. An unrelated overlay generation
does not stale a response whose cited sources are unchanged.
