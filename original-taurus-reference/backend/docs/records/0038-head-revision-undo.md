# 0038 Head-revision undo

This increment makes revision identity executable. Every accepted edit now
retains its server-computed inverse, and an authenticated author can append that
inverse as a new change set while the target is still the document head.

Undo stays inside the existing operation log: it never deletes history, receives
its own durable ID and `Seq`, links to the target with `UndoOf`, and emits the
ordinary bounded `edited` Activity fact. The compensation also gets an inverse,
so undoing it is redo.

The current-head restriction is deliberate. Selective undo would have to
transform an older inverse across every later revision; applying the old inverse
directly could overwrite a collaborator's work. This first working increment
therefore refuses an author mismatch and any non-head target.

## `core/capability/document/changeset.go`

### Compute and retain exact compensation

```go
type ChangeSet struct {
	// ...
	UndoOf     string     `json:"undoOf,omitempty"`
	InverseOps []ChangeOp `json:"-"`
}
```

`applyOpsWithInverse` snapshots each operation's before/after state and builds
the reverse batch in reverse order. It covers all twelve operation types and
rebuilds the original mark order when text shortening, atom deletion, or an
explicit middle-mark removal changes only part of the mark slice.
`InverseOps` is persistence state, not a public recipe.

### Deep-copy change-set payloads

```go
func cloneChangeSet(cs ChangeSet) ChangeSet {
	cs.Ops = cloneChangeOps(cs.Ops)
	cs.InverseOps = cloneChangeOps(cs.InverseOps)
	return cs
}
```

Rows, blocks, marks, typed block data, pointer setters, and mark attribute maps
are cloned so stored inverses never alias request or response values.

## `core/capability/document/changeset.go.md`

### Keep the editing-core companion verbatim

```go
func applyOpsWithInverse(rows []Row, ops []ChangeOp) ([]Row, []ChangeOp, error)
```

The companion reproduces the new metadata, inverse builder, side-effect
restoration, and cloning helpers in source order.

## `core/capability/document/changeset_test.go`

### Prove undo, redo, and exact restoration

```go
redo, err := docs.Undo("p", doc.ID, "u1", undo.ID, "Ada")
```

Tests cover multi-operation undo, redo through the same endpoint, re-base before
undo, Activity linkage, deleted rows/blocks/atoms, sanitized marks, prompt
instruction and resolution state, missing targets, author enforcement, and the
current-head boundary.

## `core/capability/document/document.go`

### Authorize and append a head compensation

```go
if target.AuthorID != authorID {
	return ChangeSet{}, ErrUndoForbidden
}
if target.Seq != doc.Revision {
	return ChangeSet{}, ErrUndoConflict
}
```

`Documents.Undo` resolves a retained change set inside its document, checks
trusted authorship and head position, then feeds its cloned inverse through the
same append machinery as an ordinary edit. A required revision turns any race
into an undo conflict instead of rebasing the compensation onto a newer head.

### Derive inverses at ordinary append time

```go
_, inverse, err := applyOpsWithInverse(resolved, ops)
changeSet.InverseOps = inverse
```

The inverse is computed against the exact resolved state whose revision is used
for compare-and-swap admission.

## `core/capability/document/document.go.md`

### Keep the service companion verbatim

```go
ChangeSetByID(documentID, changeSetID string) (ChangeSet, error)
```

The companion includes the new errors, store lookup, undo method, and shared
append path.

## `core/capability/document/memory.go`

### Retain isolated inverse state and lookup by ID

```go
func (s *MemoryStore) ChangeSetByID(documentID, changeSetID string) (ChangeSet, error)
```

The reference store clones change sets on ingress and egress and provides the
document-scoped lookup undo needs.

## `core/capability/document/memory.go.md`

### Keep the memory-store companion verbatim

```go
return cloneChangeSet(stored), nil
```

The companion now reflects the no-aliasing and lookup contracts.

## `core/handlers/document/document.go`

### Expose trusted-user undo

```go
cs, err := h.documents.Undo(
	ctx.Project.ID, req.Param("documentID"), ctx.User.ID,
	req.Param("changeSetID"), actor(ctx).Name,
)
```

The handler gets authorship only from the authenticated context. It maps a
missing target to 404, another author to 403, and stale/unavailable compensation
to 409.

## `core/handlers/document/document.go.md`

### Keep the handler companion verbatim

```go
case errors.Is(err, doc.ErrUndoForbidden):
```

The companion reproduces the authorization and error mapping in handler order.

## `core/platform/storage/sqlite/sqlite.go`

### Persist the undo relation and private inverse

```sql
undo_of     TEXT NOT NULL DEFAULT '',
inverse_ops TEXT NOT NULL DEFAULT '[]'
```

Additive migrations preserve existing databases; older retained revisions have
an empty inverse and report undo unavailable. A partial unique index allows at
most one direct compensation for a target without affecting ordinary edits.

### Decode retained revisions through one scanner

```go
func (s *Store) ChangeSetByID(documentID, changeSetID string) (document.ChangeSet, error)
```

Both replay and ID lookup restore submitted operations, inverse operations,
metadata, and timestamp through the same decoder.

## `core/platform/storage/sqlite/sqlite.go.md`

### Keep the SQLite companion verbatim

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_doc_undo
```

The companion reproduces the schema, migration ordering, transaction, lookup,
and shared scanner while explaining the persistence invariants.

## `core/platform/storage/sqlite/sqlite_test.go`

### Round-trip inverse metadata

```go
if byID, err := s.ChangeSetByID("d1", "c2"); err != nil || byID.UndoOf != "c1" {
```

The store test verifies both operation lists and `UndoOf` survive SQLite and
that a missing document-scoped target returns the domain sentinel.

## `core/transport/transport.go`

### Register synchronous undo

```go
scoped.POST("/documents/:documentID/changes/:changeSetID/undo",
	s.dispatchScoped("documents.undo", documents.Undo, nil))
```

Undo returns a concrete revision or an immediate authorization/conflict result,
so it is classified alongside synchronous document mutations.

## `core/transport/transport.go.md`

### Keep the transport companion verbatim

```go
"documents.undo": dispatchSync,
```

The operation map and route are reproduced in their source positions.

## `core/transport/transport_test.go`

### Exercise the public contract

```go
if undo.UndoOf != markChange.ID || undo.AuthorID != markChange.AuthorID || undo.Seq != 3 {
```

HTTP tests verify successful compensation, restored content and advanced
revision, a 409 for an older target, and 403 when one collaborator tries to undo
another's head revision.

## `dev-test/changesets/run.sh`

### Verify undo against the running server

```bash
request POST "/documents/$DOC_ID/changes/$DELETE_CHANGE_ID/undo"
expect_body "\"undoOf\":\"$DELETE_CHANGE_ID\""
```

The offline end-to-end suite now checks compensation identity, sequence,
restored content, and the old-head conflict.

## `dev-test/changesets/manual.md`

### Explain the by-hand undo and redo flow

```text
POST /documents/<DOC_ID>/changes/<CHANGE_SET_ID>/undo
```

The manual documents returned metadata, author and head restrictions, private
inverse state, and redo by undoing the compensation.

## `docs/architecture/capabilities/documents/README.md`

### Define append-only head undo

```text
Undo is append-only. It never deletes or rewrites history.
```

The capability guide covers inverse construction, author/head rules, Activity,
redo, re-base and history retention, store contracts, schema, route, and error
mapping.

## `docs/architecture/capabilities/documents/data-model.md`

### Keep revision semantics explicit

```text
Undo also advances Revision: it is a new compensating change set.
```

This distinguishes compensation from decrementing or rolling back the logical
head counter.

## `docs/architecture/persistence.md`

### Record undo storage and atomicity

```sql
UNIQUE INDEX idx_change_sets_doc_undo
  ON change_sets(document_id, undo_of) WHERE undo_of <> ''
```

The persistence guide documents the new columns, additive migration, partial
index, and the fact that compensation and Activity commit together.

## `docs/architecture/transport.md`

### Add undo to dispatch and route catalogs

```go
"documents.undo": dispatchSync,
```

The transport guide now matches the registered operation and public route.

## `docs/backend-guide.md`

### Add the client-facing route contract

```text
POST /documents/:documentID/changes/:changeSetID/undo
```

The route catalog states the author/head restrictions, status codes, `undoOf`
response, and redo behavior.

## `docs/orientation/README.md`

### Orient undo within the revision vocabulary

```text
Undo appends the current author's stored inverse only when that revision is
still the head.
```

The short shared vocabulary now explains why head-only compensation protects
later collaborators and how it relates to re-base.
