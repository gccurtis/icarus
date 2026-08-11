# 0002 — Document change sets (collaborative editing)

Documents were create/read/delete only — there was no way to edit content. This
adds **change sets**: a document's content is a `base` plus a list of change sets
that are resolved onto it. A **change set** is a batch of row/block **ops** from
one author; it gets a server-assigned per-document **`seq`**, and resolution
replays ops in `seq` order (so it's deterministic, and `set_block` is
last-writer-wins). Reads return the resolved document. Once enough change sets are
pending, the backend **re-bases** (folds them into a new base) so reads stay fast
— but the change sets are **kept** in the database, for history and long redo.

The core op set is `{insert_row, delete_row, insert_block, delete_block,
set_block}`; everything is addressed **by id**. Moves are deferred.

## core/document/changeset.go (new)

### The op types and the ChangeOp / ChangeSet structs

```go
type ChangeOp struct {
	Op OpType `json:"op"`

	// Anchors / targets, all by id.
	AfterRow   string `json:"afterRow,omitempty"`   // InsertRow anchor
	RowID      string `json:"rowId,omitempty"`      // DeleteRow target; InsertBlock's row
	AfterBlock string `json:"afterBlock,omitempty"` // InsertBlock anchor
	BlockID    string `json:"blockId,omitempty"`    // DeleteBlock / SetBlock target

	// Payloads.
	Row   *Row   `json:"row,omitempty"`   // InsertRow
	Block *Block `json:"block,omitempty"` // InsertBlock

	// SetBlock fields — a nil pointer means "leave this field unchanged".
	SetType *string `json:"setType,omitempty"`
	SetText *string `json:"setText,omitempty"`
}
```

`ChangeOp` is one atomic change; a `ChangeSet` groups ops from one author and
carries the server-assigned `Seq`. **Why by id:** addressing rows/blocks by id
(never by position) is what lets ops be replayed in a canonical order and still
land on the right target.

### applyChangeSets / applyOp — resolve a base by replaying ops

```go
func applyChangeSets(base Base, sets []ChangeSet) Base {
	rows := cloneRows(base.Rows)
	for _, cs := range sets {
		for _, op := range cs.Ops {
			rows = applyOp(rows, op)
		}
	}
	return Base{Rows: rows}
}
```

`applyOp` handles each op type against the row/block ids. **What/goal:** this is
resolution — turning `base + change sets` into the current document. It replays in
`seq` order, so `set_block` is last-writer-wins and the result is deterministic.
**Why the `cloneRows`:** applying must not mutate its input base, which may be
shared (the in-memory store hands out rows that alias its stored copy) — an early
bug where repeated reads corrupted the stored base. `validateOps` and
`assignOpIDs` round out the file: rejecting empty/malformed change sets, and
giving new rows/blocks stable ids when the caller omits them.

## core/document/document.go

### Document gains a base_seq watermark; the Store gains change-set methods

```go
	// BaseSeq is the highest change-set Seq already folded into Base. It is an
	// internal watermark, not part of the API representation.
	BaseSeq int64 `json:"-"`
```

```go
	// AppendChangeSet assigns cs the next per-document Seq and stores it,
	// returning the stored change set.
	AppendChangeSet(cs ChangeSet) (ChangeSet, error)
	// ChangeSetsSince returns a document's change sets with Seq greater than
	// afterSeq, ordered by Seq.
	ChangeSetsSince(documentID string, afterSeq int64) ([]ChangeSet, error)
	// RebaseDocument replaces a document's base and advances its base-seq
	// watermark. The change sets themselves are kept, so history is preserved.
	RebaseDocument(documentID string, base Base, baseSeq int64) error
```

**What/why:** `BaseSeq` records how far the stored base has been resolved, so a
read only replays the change sets *after* it. The three store methods are the
persistence seam for change sets and re-basing.

### New takes a re-base threshold; Get resolves; AppendChanges records + re-bases

```go
func (d *Documents) AppendChanges(projectID, id, authorID string, ops []ChangeOp) (ChangeSet, error) {
	doc, err := d.store.DocumentByID(id)
	if err != nil {
		return ChangeSet{}, err
	}
	if doc.ProjectID != projectID {
		return ChangeSet{}, ErrNotFound
	}
	if err := validateOps(ops); err != nil {
		return ChangeSet{}, err
	}
	assignOpIDs(ops)

	cs, err := d.store.AppendChangeSet(ChangeSet{
		ID:         newID(),
		DocumentID: id,
		AuthorID:   authorID,
		CreatedAt:  d.now().UTC(),
		Ops:        ops,
	})
	if err != nil {
		return ChangeSet{}, err
	}

	// Re-base once enough change sets are pending. The change set is already
	// safely recorded, so re-basing is best effort — a failure here just leaves
	// more work for the next read to resolve.
	if pending, err := d.store.ChangeSetsSince(id, doc.BaseSeq); err == nil && len(pending) >= d.rebaseThreshold {
		newBase := applyChangeSets(doc.Base, pending)
		_ = d.store.RebaseDocument(id, newBase, pending[len(pending)-1].Seq)
	}
	return cs, nil
}
```

`Get` now returns the **resolved** document (`applyChangeSets(base, pending)`), and
`New(store, rebaseThreshold)` takes the threshold (`DefaultRebaseThreshold = 50`).
**Goal:** editing without ever rewriting the whole document, while reads always
see current content. **Why best-effort re-base:** the change set is durably
recorded first, so a failed re-base only means the next read does a bit more work
— never lost edits. `AuthorID` is recorded on every change set, as required.

## core/document/memory.go

### In-memory change-set store (Seq assignment, since-query, re-base)

```go
func (s *MemoryStore) AppendChangeSet(cs ChangeSet) (ChangeSet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var max int64
	for _, e := range s.changesets[cs.DocumentID] {
		if e.Seq > max {
			max = e.Seq
		}
	}
	cs.Seq = max + 1
	s.changesets[cs.DocumentID] = append(s.changesets[cs.DocumentID], cs)
	return cs, nil
}
```

The test store keeps change sets in a per-document slice and mirrors the SQLite
semantics: Seq = max+1, `ChangeSetsSince` filters by Seq, `RebaseDocument` updates
the stored doc's base/base_seq without deleting change sets.

## core/storage/sqlite/sqlite.go

### documents.base_seq column, a change_sets table, and its methods

```go
		`CREATE TABLE IF NOT EXISTS change_sets (
			id          TEXT PRIMARY KEY,
			document_id TEXT NOT NULL REFERENCES documents(id),
			author_id   TEXT NOT NULL REFERENCES users(id),
			seq         INTEGER NOT NULL,
			created_at  TEXT NOT NULL,
			ops         TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_change_sets_doc_seq ON change_sets(document_id, seq)`,
```

`AppendChangeSet` assigns `seq = MAX(seq)+1` for the document and inserts, in a
transaction (safe under our single writer); `ChangeSetsSince` selects `seq >
afterSeq` ordered by seq (ops stored/loaded as JSON); `RebaseDocument` rewrites
`base` + `base_seq`. The `documents` table gained a `base_seq` column (with an
idempotent `ALTER TABLE` for existing databases). **Why:** durable change sets,
kept even after re-base, indexed for the per-document seq query.

## core/application/document/document.go

### AppendChanges handler — the edit endpoint

```go
func (h Handlers) AppendChanges(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !canWrite(ctx.Role) {
		return errResp(http.StatusForbidden, "read access cannot edit documents")
	}

	var in struct {
		Ops []doc.ChangeOp `json:"ops"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	cs, err := h.documents.AppendChanges(ctx.Project.ID, req.Param("documentID"), ctx.User.ID, in.Ops)
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrInvalidChangeSet):
		return errResp(http.StatusBadRequest, "change set is empty or invalid")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not apply changes")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: cs}
}
```

**What/goal:** the endpoint that edits a document. The author is `ctx.User.ID`;
write access (owner/edit) is required; the resolved document is read back via the
existing `GET /documents/:id`.

## core/transport/transport.go

### Route the edit endpoint

```go
	scoped.POST("/documents/:documentID/changes", s.adaptScoped(documents.AppendChanges))
```

Registered in the project-scoped group alongside the other document routes.

## core/composition/composition.go

### Build Documents with the default re-base threshold

```go
	docs := document.New(store, document.DefaultRebaseThreshold)
```

`document.New` now takes the re-base threshold; the composition root passes the
default (50).

## Follow-up: collaborative-editing test

### core/transport/transport_test.go — two users converge on one document

Added `TestCollaborativeEditing` (and a `newTestServerWithStore` helper that
returns the access store so the test can seed state no endpoint yet exposes). Two
users register and log in with separate sessions; user 2 is granted **edit**
access to user 1's project by seeding a membership directly (standing in for a
future invite flow). Both select the project, then both edit the same document —
user 1 changes a block, user 2 inserts a row — and both read it back.

```go
	v1 := do(t, e, http.MethodGet, "/documents/"+docn.ID, "", c1).Body.String()
	v2 := do(t, e, http.MethodGet, "/documents/"+docn.ID, "", c2).Body.String()
	if v1 != v2 {
		t.Fatalf("the two users' views diverge:\n  user1: %s\n  user2: %s", v1, v2)
	}
```

**What/why:** proves the core promise of the model — two independent sessions
editing the same document **converge** on a byte-identical resolved view that
contains both edits, each change set attributed to the right author. Convergence
holds because there is one shared backend and a single server-assigned order; no
per-user document state exists to diverge (which is also why removing the cell was
safe).

## Follow-up: intent preservation — reject conflicting changes

Apply used to be lenient: an op whose anchor was gone was appended at the end, and
an op targeting a missing id was silently dropped — relocating or discarding the
author's intent. Now an op that references a missing id (anchor or target), or an
insert that would duplicate an id, is **rejected**.

### core/document/changeset.go — strict apply (`ErrConflict`)

`applyOp` now returns an error, with a new `ErrConflict` sentinel; `applyChangeSets`
and the new `applyOps` propagate it.

```go
	case OpSetBlock:
		for ri := range rows {
			for bi := range rows[ri].Blocks {
				if rows[ri].Blocks[bi].ID == op.BlockID {
					if op.SetType != nil {
						rows[ri].Blocks[bi].Type = *op.SetType
					}
					if op.SetText != nil {
						rows[ri].Blocks[bi].Text = *op.SetText
					}
					return rows, nil
				}
			}
		}
		return nil, ErrConflict
```

**Why:** if the row or block you're editing no longer exists, the edit is
meaningless — reject it so the frontend can surface a conflict, rather than guess
where it should go.

### core/document/document.go — validate the change set before it is stored

`AppendChanges` resolves the current document and strictly applies the incoming ops
to it *before* storing anything; any conflict returns `ErrConflict` and records
nothing. Because appends are serialized, this pre-check matches the seq order the
ops will replay in.

```go
	resolved, err := applyChangeSets(doc.Base, pending)
	if err != nil {
		return ChangeSet{}, err
	}
	if _, err := applyOps(resolved.Rows, ops); err != nil {
		return ChangeSet{}, err
	}
```

**Why here:** the append is the admission point — rejecting before a change set
gets a seq keeps the stored log free of changes that never made sense against the
document.

### core/application/document/document.go — map ErrConflict to 409

```go
	case errors.Is(err, doc.ErrConflict):
		return errResp(http.StatusConflict, "change references content that no longer exists")
```

409 Conflict is the right signal — the request conflicts with the current document
state. New tests cover every rejection case (missing/duplicate ids) at the service,
transport, and dev-test levels.

**Deferred to the jobs system (next increment):** making re-base asynchronous and
the *pruning* that enforces the history limit. Re-base still runs best-effort in
the request path for now.

## Follow-up: document tuning moves into config

`rebase_threshold` was a code constant, and there was no history limit at all. Both
are document-resource tuning that operators should be able to set, so they now live
in a `documents` config section.

### core/config/config.go — a `documents` section

```go
// Documents holds document-resource tuning.
type Documents struct {
	// RebaseThreshold is how many pending change sets trigger a re-base — folding
	// them into a new base so reads stay fast.
	RebaseThreshold int `yaml:"rebase_threshold"`
	// HistoryLimit is the maximum number of change sets kept per document; older
	// ones (already folded into the base) are pruned beyond it. 0 keeps all.
	// Pruning is carried out by the jobs system.
	HistoryLimit int `yaml:"history_limit"`
}
```

`Default()` sets `RebaseThreshold: 50` (matching the old constant) and
`HistoryLimit: 0` (keep all — the current behavior). The composition root now
passes `cfg.Documents.RebaseThreshold` to `document.New` instead of the constant.

**Why now, half-wired:** the *setting* is the part that belongs in config, and it's
cheap and safe to add ahead of the consumer. `history_limit` is read from the
manifest and defaulted, but nothing prunes yet — the jobs system enforces it next
increment. `rebase_threshold` is live immediately. `document.DefaultRebaseThreshold`
stays as the fallback `document.New` uses when the value is unset (0).
