# derived-output

A project-scoped, pull-refreshed answer grounded in the Semantic Overlay.

`createDerivedOutput` stores a prompt and optional `ResourceSet` in `idle`.
`updateDerivedOutput` changes that definition and marks an existing answer
`stale` without erasing it. It may also replace `lastResponse` with a user edit:
the edit advances the response revision, clears citations that can no longer be
claimed for the edited prose, and becomes continuity context for the next
refresh. `readDerivedOutput` compares citation snapshots to active source
revisions and reports effective staleness without writing every output when one
source changes.

`refreshDerivedOutput` is the only synthesis path. It acquires the row's
`generating` state before its first asynchronous provider call, then gives one
bounded agent a single `retrieve` tool. Retrieval returns exact source spans and
application-issued, attempt-local evidence IDs.

The final provider turn must match a strict structured-output schema containing
an `answered`/`insufficient` status, response text, and selected evidence IDs
with use annotations. Application code rejects duplicate or unissued IDs. An
answered result without valid selected evidence publishes only the fixed
insufficiency response, never the model prose.

Selected hits are copied into stored-by-value citations, then their source
revisions are compared with active source rows. A mismatch discards the entire
attempt and retries from current retrieval; bounded repeated churn records an
error while preserving the previous response. An unrelated overlay generation
does not stale a response whose cited sources are unchanged.
