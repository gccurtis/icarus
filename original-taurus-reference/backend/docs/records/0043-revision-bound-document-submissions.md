# 0043 Revision-bound Document submissions

This increment closes roadmap R1. Document edits now declare the exact revision
they were authored against and carry an idempotency key. The backend accepts one
matching effect, returns the original ChangeSet for an identical retry, rejects
mismatched key reuse, and returns a bounded resync conflict for a stale distinct
submission. It no longer silently reapplies stale whole-object operations at a
newer head.

## `core/capability/document/submission.go`

### Define the admission contract

`ChangeSubmission` carries `SubmissionID`, `ExpectedRevision`, and typed
operations. Submission IDs are bounded opaque values. `AdmissionConflict`
provides stable revision/submission conflict codes plus expected, current, and
resync revisions.

### Fingerprint the client request before normalization

The service hashes expected revision and unnormalized operations before filling
missing content IDs. An identical retry can therefore present the same original
request and receive the first ChangeSet with its first server-assigned IDs.

## `core/capability/document/changeset.go`

### Attach submission identity to the accepted revision

ChangeSets now expose `SubmissionID` and `PriorRevision`. The private
`SubmissionHash` travels with persistence state alongside the existing inverse
operations.

## `core/capability/document/document.go`

### Admit edits only at their declared revision

`SubmitChanges` validates and fingerprints the envelope, checks an earlier
receipt before revision admission, requires the exact head, assigns IDs on a
clone, dry-runs the operations, computes their inverse, and asks the store to
repeat admission atomically. There is no transparent retry at a newer revision.

### Preserve the compensation path

Current-head author-scoped undo still submits the retained inverse at the
target's exact sequence. A race maps back to the existing undo conflict rather
than relocating compensation.

## `core/capability/document/memory.go`

### Deduplicate under the store lock

The reference store keeps immutable submission receipts separately from the
prunable ChangeSet history. Under one lock it returns an identical receipt,
rejects a mismatched hash, or advances the exact revision and commits the
ChangeSet, receipt, visible timestamp, and Activity fact.

## `core/platform/storage/sqlite/sqlite.go`

### Persist admission metadata and immutable receipts

Additive migration columns retain submission identity/hash and prior revision
on each ChangeSet. `document_submissions` stores the accepted receipt under the
unique `(document_id, author_id, submission_id)` key.

### Make retry and acceptance one transaction

`AppendChangeSet` checks the receipt before revision CAS, inserts the ChangeSet
and receipt together, and commits Activity in the same transaction. History
pruning can remove old detailed ChangeSet rows without losing retry safety;
deleting the owning Document removes its receipts.

## `core/handlers/document/document.go`

### Bind the exact submission envelope

The append route now requires `{submissionId, expectedRevision, operations}` and
derives authorship from the authenticated context. Bounded admission conflicts
return stable codes and revision fields in a 409 response.

## `core/capability/document/prompt.go`

### Protect authored work from stale inference

Prompt resolution captures the Document revision before model work and
incorporates its system-authored result through `SubmitChanges`. A Document edit
accepted while inference runs causes the stale result to conflict instead of
overwriting current content.

## Tests

### Prove exact admission and retry behavior

Document tests cover invalid envelopes, retries with server-generated content
IDs, mismatched key reuse, stale revisions, simultaneous distinct submissions,
simultaneous identical retries, Activity exactly-once behavior, and receipt
survival after MemoryStore pruning.

SQLite tests round-trip all metadata, deduplicate atomically, reject mismatched
hashes, and return a receipt after its detailed ChangeSet is pruned. Transport
tests exercise the wire envelope and both structured conflict codes. Prompt
tests hold inference open while an authored edit wins and verify that the stale
result is rejected.

## Current documentation and executable walkthrough

### Replace the former transparent-retry model

The Document architecture, persistence and transport guides, Prompt Block
guide, orientation, change-set manual, and executable dev-test now describe and
exercise strict revision admission, identical retry, bounded conflicts, trusted
attribution, and prior revision.

The alignment assessment marks gap 1 closed, the roadmap advances to R2, and
the live checklist records every R1 completion criterion.

## Paired Go companions

### Keep changed production sources verbatim

The companions for `submission.go`, `changeset.go`, `document.go`, `memory.go`,
`prompt.go`, the Document handler, and SQLite reproduce their corresponding Go
sources exactly and explain the new admission blocks in source order.
