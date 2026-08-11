# memory.go

The in-memory file `Store` for tests and single-process runs: each file's
metadata, a copy of its bytes, and the insertion order, all under one mutex.

It is not just a test double — it is the reference for what the port promises,
so it enforces the same project scoping the SQL store does. If this
implementation were laxer, a test could pass against behavior the real store
would refuse.

## Code breakdown

### `MemoryStore` and `NewMemoryStore`

Three fields behind a `sync.Mutex`: `meta` (id → `File`), `content` (id →
bytes), and `order`, the ids in insertion order. `order` exists because Go map
iteration is randomized and listings need a stable tiebreak.

### `Put` — record metadata and copy the bytes

Appends to `order` only for an id not already present, so re-putting an existing
file updates in place rather than duplicating it in the listing. The content is
copied on the way in, matching a real store's write semantics: the caller's
buffer is not aliased.

### `Meta` and `Content` — scoped by project, not by id alone

Both take the project id and treat a file owned by another project exactly as a
missing one — `ErrNotFound`, no partial answer. `Content` checks the label on
the *metadata* before returning bytes, because the bytes themselves carry
nothing to check. That mirrors the SQL store's `WHERE id = ? AND project_id = ?`
so both implementations of the port refuse a foreign read the same way.
`Content` returns a copy, so a caller cannot mutate stored bytes.

### `ByProject` — a project's files, newest first

Walks `order` (insertion order), keeps the matching project's files, then does a
**stable** sort by `CreatedAt` descending — stable so files sharing a timestamp
fall back to insertion order instead of shuffling between calls.
