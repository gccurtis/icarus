# 0109 — Rebase watermark guard (BUG-1) & documents project index (PERF-1)

The first two code fixes from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). Both are small,
both were driven test-first.

## Why

**BUG-1.** Every write to a document head is gated by the revision compare-and-swap
in `AppendChangeSet` — except `RebaseDocument`, which did a blind
`UPDATE ... WHERE id = ?`. Rebase runs on the job pool (two workers) and
`SubmitChanges` enqueues one per document with no dedup, so two rebases for the
same document can run at once. Because a rebase writes `base` + `base_seq`
unconditionally, a stale or duplicate rebase (one that folded an older view) could
wind `base_seq` backward and overwrite a newer base. Racing `PruneChangeSets` —
which deletes change sets at or below `base_seq` — that could drop change sets the
correct (shorter) base still needs, losing content. This is the one place the
head-write discipline was missing.

**PERF-1.** `documents` was queried by `project_id` on hot read paths
(`DocumentsByProject`, used by list, revision-hints, and duplicate-name) with no
supporting index — a full-table scan that grows with project size.

## `core/platform/storage/sqlite/sqlite.go`

### Guard the rebase watermark

```go
	// Guard the watermark: only apply a rebase that advances base_seq. Rebase is
	// the one write to the head that isn't gated by the revision CAS, and it can
	// run on either job worker without dedup, so a stale or duplicate rebase must
	// not wind base_seq backward and clobber a newer base (which, racing a prune,
	// can drop change sets the folded base still needs).
	_, err = s.db.Exec(
		`UPDATE documents SET base = ?, base_seq = ? WHERE id = ? AND base_seq < ?`,
		string(b), baseSeq, documentID, baseSeq,
	)
```

Adds `AND base_seq < ?` so the update only applies when it advances the watermark.
A stale/duplicate rebase (`baseSeq <= base_seq`) affects zero rows and is a safe
no-op. A correct rebase always folds pending change sets whose seq exceeds the
current `base_seq`, so its `baseSeq` is strictly greater and it still applies — the
existing round-trip and prune tests are unaffected.

### Index `documents(project_id)`

```go
		`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`,
```

Added to the declarative `migrate` schema (idempotent, additive — consistent with
the no-migration-framework approach). Turns the by-project document scans into
index lookups.

## `core/capability/document/memory.go`

### Match the guard in the in-memory store

```go
	// Only advance the watermark; a stale or duplicate rebase is a no-op, matching
	// the SQLite store's guarded update.
	if baseSeq <= doc.BaseSeq {
		return nil
	}
```

The `MemoryStore` is the test/dev double for the `Store` port; it must honor the
same contract as SQLite so behavior does not diverge between unit tests and
production.

## `core/capability/document/model.go`

### State the monotonic contract on the port

The `RebaseDocument` doc comment now records that the watermark only moves forward
and that a non-advancing rebase is a no-op — making the invariant part of the port
contract rather than an implementation detail of one store.

## `core/platform/storage/sqlite/sqlite_test.go`

### Two tests, written first (both failed before the fix)

- `TestRebaseDocumentIgnoresStaleWatermark` — after a rebase to watermark 3, a
  stale rebase at watermark 2 (and a duplicate at 3) must not change `base_seq` or
  the base; a genuine rebase to 4 still applies. Failed with "wound base_seq back
  to 2" before the guard.
- `TestDocumentsProjectIndexExists` — asserts `idx_documents_project` is present.
  Failed ("missing, found 0") before the index.
