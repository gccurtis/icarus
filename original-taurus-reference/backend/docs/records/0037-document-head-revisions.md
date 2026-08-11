# 0037 Document head revisions

Undo needs a stable answer to “which exact authored effect is being
compensated?” Change sets already carry the right identity—durable `ID`,
trusted `AuthorID`, and per-document `Seq`—and their Activity facts already use
that ID as the source. This increment makes `Seq` an explicit Document
`Revision` and closes the stale-validation race before adding `undoOf`.

A document begins at revision zero. An append validated at revision `N` can only
be stored by atomically advancing the document to `N+1`; the stored change set
receives that same number as its sequence. A losing writer reloads and
revalidates, allowing non-overlapping concurrent edits while rejecting an edit
whose target the winner removed. Re-base advances only the internal `BaseSeq`,
not the logical revision.

No undo-only fields are added yet. The next executable increment can persist
inverse effects and point a compensating change set at the original change-set
ID while enforcing `AuthorID`.

## `core/capability/document/document.go`

### Add the logical head and compare-and-swap append contract

```go
Revision int64 `json:"revision"`
```

`Revision` exposes the latest accepted content sequence independently of the
internal folded `BaseSeq`. `Store.AppendChangeSet` now accepts an expected
revision, and `AppendChanges` reloads and revalidates a bounded number of times
when a concurrent writer wins the storage compare-and-swap. Each attempt is
stamped only after validation and strictly after the current visible time, so a
retry cannot move `UpdatedAt` backward.

## `core/capability/document/document.go.md`

### Keep the Document companion verbatim

```go
const maxAppendAttempts = 4
```

The companion reproduces the new field, error, store contract, retry bound, and
append loop in source order.

## `core/capability/document/memory.go`

### Mirror revision admission under one lock

```go
if doc.Revision != expectedRevision {
	return ChangeSet{}, ErrRevisionConflict
}
cs.Seq = expectedRevision + 1
```

The test store checks and advances the head in the same critical section that
stores the authored change set and Activity fact.

## `core/capability/document/memory.go.md`

### Keep the memory-store companion verbatim

```go
doc.Revision = cs.Seq
```

The companion now reflects the in-memory compare-and-swap implementation.

## `core/capability/document/changeset_test.go`

### Force stale validation races

```go
type appendGateStore struct {
	*document.MemoryStore
	calls   atomic.Int32
	arrived chan struct{}
	release chan struct{}
}
```

Two service calls are held after validation so both first attempt the same
revision. Non-overlapping edits reload and both survive at revisions one and
two with monotonic timestamps; two deletes of the same atom produce one success
and one clean conflict, and the stored history remains resolvable.

## `core/capability/document/document_test.go`

### Prove Activity points to its authored revision

```go
if facts[2].Actor != actor || facts[2].SourceKind != "document.change_set" || facts[2].SourceID != cs.ID {
	t.Fatalf("edit fact is not linked to its authored revision: %+v, change set %+v", facts[2], cs)
}
```

This captures the existing division of responsibility: the change set owns
detailed operations and trusted authorship, while Activity is the bounded feed
projection linked by source ID.

## `core/handlers/document/document.go`

### Surface exhausted revision contention as conflict

```go
case errors.Is(err, doc.ErrRevisionConflict):
	return errResp(http.StatusConflict, "document changed while applying changes; retry")
```

Most races resolve inside the service; sustained contention still receives a
retryable 409 rather than a generic server error.

## `core/handlers/document/document.go.md`

### Keep the handler companion verbatim

```go
case errors.Is(err, doc.ErrRevisionConflict):
```

The companion includes the new error translation in handler order.

## `core/platform/storage/sqlite/sqlite.go`

### Persist and atomically advance revisions

```go
res, err := tx.Exec(
	`UPDATE documents SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?`,
	cs.Seq, sortableTime(cs.CreatedAt), cs.DocumentID, expectedRevision)
```

SQLite stores `documents.revision`, enforces unique `(document_id, seq)` values,
and turns append into a compare-and-swap transaction. Existing databases
recover the head from the greater of `base_seq` and the newest retained change
set, which remains correct after re-base and pruning.

## `core/platform/storage/sqlite/sqlite.go.md`

### Keep the SQLite companion verbatim and explain the new invariant

```go
`CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_revision ON change_sets(document_id, seq)`,
```

The companion reproduces the schema, migration, queries, append transaction,
and scanner changes while explaining why sequence uniqueness is now a database
invariant.

## `core/platform/storage/sqlite/sqlite_test.go`

### Cover stale heads, backfill, and concurrent retry

```go
if errors.Is(err, document.ErrRevisionConflict) {
	continue
}
```

Store tests reject a stale expected revision without advancing the document,
reconstruct a reset revision through migration, and have concurrent writers
retry until all receive unique contiguous sequences.

## `core/transport/transport_test.go`

### Exercise public revision and revision identity

```go
if err := json.Unmarshal(rec.Body.Bytes(), &firstChange); err != nil ||
	firstChange.ID == "" || firstChange.AuthorID == "" || firstChange.Seq != 1 {
```

The HTTP test proves creation returns revision zero, appends return a durable ID,
trusted author, and sequence, and reads expose revisions one and two as edits
land.

## `dev-test/changesets/run.sh`

### Assert the revision lifecycle through the running service

```bash
expect_body '"revision":0'
```

The offline end-to-end suite now checks revision zero at creation and revision
advancement after the first two accepted change sets.

## `dev-test/changesets/manual.md`

### Explain identity, authorship, Activity, and head admission

```text
The document's public revision is that latest accepted sequence.
```

The manual connects the returned change-set ID and author to Activity's source,
and explains that re-base changes representation without changing logical
revision.

## `docs/architecture/capabilities/documents/README.md`

### Define the revisioned operation-log model

```go
AppendChangeSet(cs ChangeSet, expectedRevision int64, fact ActivityFact) (ChangeSet, error)
```

The capability guide now describes the public head, trusted revision identity,
Activity linkage, compare-and-swap retry loop, re-base semantics, and the future
author-scoped undo seam.

## `docs/architecture/capabilities/documents/data-model.md`

### Separate logical revision from folded watermark

```text
Revision is the logical head clients see; BaseSeq is how far storage has folded
that history into Base.
```

The data model adds `Revision` to the diagram and field catalog and explains why
re-base advances only `BaseSeq`.

## `docs/architecture/persistence.md`

### Document revision storage and migration

```sql
UNIQUE INDEX idx_change_sets_doc_revision ON change_sets(document_id, seq)
```

The persistence guide replaces the former `MAX(seq)+1` description with
compare-and-swap admission and records how existing document heads are rebuilt.

## `docs/backend-guide.md`

### Surface revision fields at the HTTP boundary

```text
returns its durable id, trusted authorId, and assigned seq
```

The route catalog now tells clients that document reads include `revision` and
that a successful append's sequence is the new head.

## `docs/orientation/README.md`

### Orient change sets as authored revisions

```text
Appends compare-and-swap that head before admission.
```

The shared vocabulary now distinguishes logical revision from asynchronous
re-base representation work.
