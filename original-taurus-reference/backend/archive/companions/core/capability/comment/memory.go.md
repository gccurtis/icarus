# memory.go

The in-memory comment `Store` for tests and single-process runs: comments keyed
by id with a separate creation-order list, and replies bucketed per comment, all
under one mutex.

Like the SQL store it stands in for, it is the reference for what the port
promises — including that the batched and single-comment reply loads return the
same threads in the same order.

## Code breakdown

### `MemoryStore` and `NewMemoryStore`

`comments` (id → `Comment`), `order` (ids in creation order, since map iteration
is randomized), and `replies` (comment id → replies in creation order).

### `CreateComment`, `CommentByID`, `UpdateComment`

Straight map writes and reads. `CommentByID` takes a project id and returns
`ErrNotFound` both for an unknown id and for a comment belonging to another
project — mirroring the SQLite store's `WHERE id = ? AND project_id = ?` so the
in-memory store cannot be the lax one that hides a scoping bug from tests. The
two cases are indistinguishable on purpose. `UpdateComment` refuses to create a
comment, so an update to a deleted one is an error rather than a resurrection.

### `CommentsByDocument` — filtered in creation order

Walks `order` and keeps comments matching both project and document, applying
the tri-state `resolved` filter (nil for all, false for open, true for
resolved). Walking `order` rather than the map is what makes the result stable
between calls.

### `DeleteComment` — the thread goes with it

Drops the comment and its reply bucket, then rebuilds `order` without the id
using a zero-capacity reslice (`s.order[:0:0]`) so the filtered copy never
writes over the slice it is reading.

### `AddReply` — append to the bucket

Appends in call order; the reply's own `CreatedAt` is what the readers sort on.

### `RepliesByComment`, `RepliesByComments`, `threadLocked`

Both public forms delegate to `threadLocked`, so the batched path used by
comment listing cannot drift from the single-comment one. The batched form
returns a map keyed by comment id and **omits** comments with no replies,
matching what an SQL `IN` query naturally produces — callers treat a missing key
as an empty thread. `threadLocked` copies the bucket (callers cannot mutate
stored replies) and sorts it **stably** by `CreatedAt`, so replies added in the
same instant keep insertion order.
