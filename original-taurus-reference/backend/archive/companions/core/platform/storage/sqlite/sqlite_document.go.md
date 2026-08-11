# sqlite_document.go

Document persistence for the single SQLite `Store`: document records and their
lifecycle, the append-only change-set log, the summary history table, re-base,
pruning, and anchors. This is not a separate store — every file in the package
shares one `*Store` and one connection. The split is organizational: it mirrors
the capability boundaries in `core/capability` so each domain's storage is
legible on its own.

**The concurrency model.** A stored document is three things: a `base` (a folded
JSON snapshot of the content), a `base_seq` watermark saying how far that
snapshot has folded, and a `revision` — the sequence number of the head. Edits
are never applied to `base` in place. They land as rows in the append-only
`change_sets` table, each carrying its own `seq`, and a reader materializes the
document by folding every change set with `seq > base_seq` over `base` in `seq`
order. Base-plus-tail is always the truth, so no write can lose detail.

`AppendChangeSet` is the single admission gate onto that log, and runs as one
transaction — immediate, because `pragmaDSN` sets `_txlock=immediate`, so `BEGIN`
takes the write lock up front and the read-then-write inside cannot race on a
stale read. Inside it: an idempotency probe, a **compare-and-swap** on the head
revision, then the inserts. The CAS is what makes concurrent editing safe without
holding a lock across the request — zero rows affected means someone else moved
the head first, and the caller gets `ErrRevisionConflict` rather than a silently
lost edit. Behind the head, `RebaseDocument` folds the tail into a new `base` and
`PruneChangeSets` deletes detail safely below the watermark; both run on job
workers with no dedup, so both are written to be safe when replayed or reordered.

## Code breakdown

### File header and imports

The package comment states the shared-`*Store` invariant so this file is not
mistaken for an independent store. Imports are `database/sql`, `encoding/json`,
`errors`, `time`, and the `document` capability that owns the types and sentinels.

### CreateDocument — insert the record and its activity fact atomically

Marshals `d.Base`, inserts the row (including the caller's initial `base_seq` and
`revision`), then writes the activity fact through `insertDocumentActivity` in the
same transaction, so a document never exists without the event announcing it.

### DocumentByID and DocumentsByProject — the two whole-document reads

Both select the same column list and hand each row to `scanDocument`. The
project-scoped listing filters `lifecycle = 'active'`, so trashed documents drop
out of the normal view without being deleted.

`DocumentByID` takes the project id as its first parameter and filters on it —
`WHERE id = ? AND project_id = ?` — so a document owned by another project reads
as `document.ErrNotFound` here rather than being handed back for the caller to
inspect. This is the DEF-1 finish for documents, following what record 0115 did
for `file.Meta`/`file.Content`: the project boundary is the product's core
privacy property and should not rest solely on every caller remembering to
compare `ProjectID`. The document service still performs that comparison after
loading. The redundancy is deliberate — two independent layers, neither
load-bearing alone — and the service check must not be removed as "now
unnecessary": it is what still guards a store implementation that does not scope.

The extra predicate costs nothing. `id` is the table's primary key, so SQLite
still resolves the read through that unique index and the `project_id` test is a
filter applied to the single row it found — no scan, and the added parameter
does not change the plan.

### DocumentSummaries — keyset-paginated listing of the cheap fields

Builds the query incrementally, ordered `updated_at DESC, id ASC`. The optional
`before` boundary is a keyset cursor, not an offset: it compares `(updated_at, id)`
as a pair, so documents sharing a timestamp still paginate without repeats or
gaps. `SkipEqualTime` degrades it to a plain `updated_at < ?` for callers skipping
a whole timestamp bucket. `sortableTime` makes the string comparison chronological.

### RenameDocument, DeleteDocument, SetLifecycle — the metadata writes

Each opens a transaction, performs its update, treats zero rows affected as
`document.ErrNotFound`, appends the activity fact, and commits. `DeleteDocument`
is the hard delete: it removes submission receipts, history rows, and change sets
before the document row, so nothing is orphaned. `SetLifecycle` is the soft one —
it moves a document between `active` and `trashed` and stamps `trashed_at`,
leaving all content in place.

### TrashedDocumentsOlderThan — the purge sweep's input

Returns documents trashed before a cutoff, for the job that turns expiry into a
real `DeleteDocument`.

### AppendChangeSet — the admission gate

Marshals ops, inverse ops, and summary, then does everything else in one
immediate transaction:

1. **Idempotency probe.** If the change set carries a `SubmissionID`, look up the
   receipt for `(document_id, author_id, submission_id)`. A hit with a matching
   `SubmissionHash` returns the stored change set unchanged, so a retried request
   re-reads its own result instead of double-applying. A hit with a *different*
   hash means one submission id was reused for different content —
   `document.ErrSubmissionConflict`.
2. **Compare-and-swap on the head.** The new `seq` is `expectedRevision + 1`, and
   the head only moves if it is still where the caller last saw it:

   ```go
   `UPDATE documents SET revision = ?, updated_at = ? WHERE id = ? AND revision = ?`
   ```

   Zero rows affected is ambiguous, so a `COUNT(*)` separates the causes: no such
   document is `ErrNotFound`, an existing one is `ErrRevisionConflict`. Because
   this CAS is the only thing that advances `revision`, a `seq` is never handed
   out twice.
3. **The inserts.** The change set itself; the matching `document_history` row
   from `document.HistoryEntryForChangeSet` (immutable summary metadata, prunable
   independently of the detail); the submission receipt when there is a
   submission id; and the activity fact.

All of it commits together, so a visible revision bump always has its change set,
its history row, and its receipt.

### ChangeSetsSince, ChangeSetByID, ChangeSetBySubmission — reading the log

`ChangeSetsSince` is the fold input: everything with `seq > afterSeq`, ordered by
`seq`. Callers pass the document's `base_seq` to get exactly the unfolded tail.
The other two are point lookups — by change-set id, and by submission triple via
the stored receipt.

### scanSubmissionReceipt — rehydrate a change set from its stored receipt

Unmarshals the receipt, reattaches hash and inverse ops, and backfills what older
receipts may lack: an empty `AuthorName` falls back to the author id, and a
zero-valued summary is recomputed from the ops. Missing row ⇒ `ErrChangeSetNotFound`.

### ListChangeSetHistory — the browsable revision list

Reads `document_history` newest-first, `LEFT JOIN`ing `change_sets` so each entry
reports two capability flags without loading any ops: `DetailAvailable` (the
change set survives, i.e. was not pruned) and `HasInverse` (its inverse ops are
non-empty, so the revision can be undone). The `(? = 0 OR h.seq < ?)` predicate
lets one query serve both the first page and a `beforeRevision` cursor.

### scanChangeSet — one scan routine for both row shapes

Takes a `rowScanner`, serving the point lookups and the `ChangeSetsSince` loop
alike. Unmarshals the three JSON columns, applies the same author-name fallback
as the receipt path, and maps `sql.ErrNoRows` to `ErrChangeSetNotFound`.

### RebaseDocument — advance the fold watermark, monotonically

Writes the newly folded base and its watermark, guarded so it can only move
forward:

```go
`UPDATE documents SET base = ?, base_seq = ? WHERE id = ? AND base_seq < ?`
```

Rebase is the one write to the document head *not* gated by the revision CAS, and
it can run on either job worker with no dedup. Without the `base_seq < ?` guard a
stale or duplicated rebase could wind the watermark backward and install an older
base — and a prune racing that regression would delete change sets the folded base
still needs. With it, a late or repeated rebase is simply a no-op: zero rows
affected, no error.

### documentActivityExecer and insertDocumentActivity — shared activity write

A one-method interface satisfied by both `*sql.Tx` and `*sql.DB`, so every
document write emits its activity fact inside its own transaction. The helper
validates the action against the known document actions first — an unrecognized
action is a programming error and fails the write rather than storing an event
nobody can render.

### PruneChangeSets — bound the log without breaking reconstruction

Two deletes in one transaction. The first drops change-set detail that is both
folded (`seq <= base_seq`) and not the head (`seq < revision`): folded rows are
already represented in `base`, and keeping the head recipe means the current
revision can always still be described. Anything above the watermark is a pending
reconstruction and is untouched. The second bounds `document_history` to the
newest `keep` entries — those rows are summaries only, so trimming them costs
detail nobody can fold, not content.

### scanDocument — one scan routine for every document read

Shared by the point lookup and both listing loops. Unmarshals `base`, parses the
timestamps, leaves `TrashedAt` zero when the column is empty, and maps
`sql.ErrNoRows` to `document.ErrNotFound`.

### CreateAnchor, ListAnchors, DeleteAnchor, UpdateAnchor — anchor CRUD

Single-statement writes and one ordered read over `document_anchors`. Anchors are
positions (row, block, optional atom, offset range) carrying a validity `state`,
so comments and other overlays can point into a document that keeps changing
underneath them. `atom_id` is nullable, so the read scans it through a
`sql.NullString`; `ListAnchors` returns an empty slice rather than nil so it
encodes as `[]`.
