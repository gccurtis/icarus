# 0046 Proven Document semantic rebase

This increment completes roadmap R4. Ordinary stale Document submissions can
now be admitted only when retained revision history and operation preconditions
prove them semantically disjoint from every intervening edit. The existing
append-only ChangeSet model, exact store compare-and-swap, idempotent receipts,
and explicit conflict response remain intact.

## `core/capability/document/rebase.go`

### Prove semantic disjointness from retained revisions

Add read/write footprints over stable hierarchy, property, content, Mark, and
ordering facts. Reconstruct the exact authored base, classify incoming and
intervening operations, and reject any write/write or write/read intersection.
Missing base history, sequence gaps, unknown operations, or failed trial
application all fail closed.

### Transform disjoint UTF-8 splices

Transform byte offsets and expected text digests for disjoint splices on the
same Atom. Overlapping ranges and ambiguous insertion boundaries conflict;
splices on different Atoms commute. Normal splice application still performs
the final digest, range, UTF-8, and Mark-anchor validation.

## `core/capability/document/rebase.go.md`

### Document the proof engine verbatim

The new companion reproduces every source byte in logical sections and explains
footprint overlap, retained-history proof, hierarchy expansion, and the narrow
text transform.

## `core/capability/document/document.go`

### Admit proven stale work and retry CAS races

Refactor shared submission admission into a bounded retry loop. Current-head
edits resolve directly; ordinary stale submissions call the proof engine.
After a compare-and-swap race, the service reloads and recomputes proof against
the new head instead of reusing stale validation. Undo and redo stay
current-head-only.

### Compute compensation at the actual admission head

Preserve assigned IDs across retry, store the original authored revision, and
derive inverse operations from the actual head that accepted the transformed
operations.

## `core/capability/document/document.go.md`

### Keep service admission documentation exact

Synchronize the verbatim service source and explain idempotency-first lookup,
semantic proof, authored/admitted revision identity, bounded CAS retry, and the
unchanged undo/redo boundary.

## `core/capability/document/submission.go`

### Define the authored revision as immutable request identity

Clarify that `ExpectedRevision` is the head the client observed. It remains in
the idempotency fingerprint even when semantic proof admits the operation batch
at a newer head.

## `core/capability/document/submission.go.md`

### Synchronize the submission companion

Reproduce the updated contract verbatim and explain why later admission does
not rewrite request identity.

## `core/capability/document/changeset.go`

### Separate authored and admitted revisions

Add public `AuthoredRevision` to `ChangeSet`. `PriorRevision` continues to mean
the actual head at admission and therefore remains `Seq-1`; the two values
differ only after a proven stale rebase.

## `core/capability/document/changeset.go.md`

### Synchronize ChangeSet metadata documentation

Keep the source blocks byte-exact and document how authored revision,
admission revision, sequence, receipt identity, and inverse state differ.

## `core/capability/document/history.go`

### Preserve authored revision in History

Add `AuthoredRevision` to bounded History entries and copy it from the accepted
ChangeSet so list clients can distinguish where an edit was authored from where
it was admitted.

## `core/capability/document/history.go.md`

### Synchronize History metadata documentation

Keep History source blocks exact and explain the two revision identities in the
immutable projection.

## `core/capability/document/changeset_test.go`

### Prove convergence and fail-closed boundaries

Force concurrent writers through the same initial compare-and-swap. Verify
disjoint text ranges and independent alignment axes converge, while overlapping
text, destructive structure, same-property style, and same-container ordering
conflict. Exercise unequal text deltas with Mark transformation and reject
stale proof after the authored base has been folded away.

## `core/platform/storage/sqlite/sqlite.go`

### Persist authored revision without changing Store opacity

Add `authored_revision` to detailed ChangeSets and immutable History, including
all inserts, scans, and backfill paths. Legacy additive migration uses `-1` as a
sentinel before copying `prior_revision`, because zero is a legitimate authored
revision for newly rebased work. Operation payloads remain opaque JSON.

## `core/platform/storage/sqlite/sqlite.go.md`

### Keep persistence implementation documentation exact

Synchronize every changed schema, migration, append, and scan block and explain
the legacy sentinel and authored/admitted revision distinction.

## `core/platform/storage/sqlite/sqlite_test.go`

### Round-trip rebased revision metadata

Persist and read a ChangeSet authored at revision zero but admitted after
revision two, then verify detailed, receipt, and History projections preserve
the two values.

## `core/transport/transport_test.go`

### Exercise semantic rebase through HTTP

Submit one current splice, admit a stale disjoint splice with transformed
coordinates and digest, inspect the resolved content and History metadata, and
confirm an overlapping stale splice returns the bounded revision conflict.

## `dev-test/changesets/run.sh`

### Drive safe and conflicting stale submissions

Extend the executable service walkthrough with a disjoint same-Atom splice
rebase, authored/prior revision assertions, final content verification, and an
overlap conflict.

## `dev-test/changesets/manual.md`

### Explain the client-visible proof contract

Document authored versus admitted revision, the supported splice transform,
conservative conflict categories, missing-history behavior, and the unchanged
current-head undo/redo rule.

## `docs/architecture/capabilities/documents/README.md`

### Define current semantic admission behavior

Replace the R4-deferred exact-head description with the implemented footprint
proof, text transformation, fail-closed cases, CAS retry flow, History metadata,
and SQLite columns.

## `docs/architecture/persistence.md`

### Record authored/admitted metadata and atomic retry boundaries

Add both revision columns to the schema description and clarify that the store
still performs one exact admission-head compare-and-swap; proof and retry remain
Document domain logic.

## `docs/architecture/transport.md`

### Surface the R4 wire contract

Describe stale semantic admission, the two response revision fields, and the
structured conflict returned for failed proof or exhausted write races.

## `docs/backend-guide.md`

### Update the Document change endpoint summary

Expose proven stale admission and same-Atom splice transformation in the client
endpoint table.

## `docs/orientation/README.md`

### Orient contributors to proven collaboration

Add semantic footprint proof, transformed disjoint splices, fail-closed
overlap, and authored/admitted revision vocabulary.

## `docs/support/document-backend-alignment-gaps.md`

### Close the collaboration protocol gap through R4

Extend the R1 closure with retained-history proof, conservative conflict
categories, CAS retry, and the authored/admitted revision distinction.

## `docs/support/document-backend-roadmap.md`

### Complete R4 and advance to semantic styles

Link this record from R4 and set R5 as the next implementation target.

## `docs/support/checklists/document-backend.md`

### Close every R4 checklist item

Mark classification, safe stale admission, insufficient-proof conflicts, and
concurrent convergence/rejection coverage complete; move the live focus to R5.
