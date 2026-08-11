# sqlite_comment.go

Persistence for anchored document comments and their replies — the storage half
of the `comment` capability. Two tables: `document_comments` holds the top-level
comment (its body, author, resolved state, and the `anchor_id` tying it to a
span of the document) and `comment_replies` holds the flat list of responses on
each thread.

Replies are one level deep — a reply points at a comment, never at another
reply — and are always fetched separately from their parent. This file never
assembles a thread; the capability above it pairs a comment with
`RepliesByComment` when it needs the whole conversation.

## Code breakdown

### File header: one Store, one connection, split by capability

The package clause repeats the note carried by every file in this split: all of
these methods hang off the same `*Store` over a single connection, so the file
boundary is organizational and mirrors `core/capability`.

### `CreateComment` — insert a comment as given

A straight insert of every column. The caller supplies the ID and both
timestamps, so the store makes no decisions of its own. `resolved` is a SQLite
INTEGER, so the bool goes through the package's shared `boolToInt` helper (in
`sqlite.go`) on the way in.

### `CommentByID` — one comment, without its replies

A single-row read delegated to `scanComment`, which is also what turns a missing
row into `comment.ErrNotFound`. The name is literal: replies are a separate
call.

It takes the project id as its first parameter and filters on it in SQL
(`WHERE id = ? AND project_id = ?`), so a comment belonging to another project
is `comment.ErrNotFound` — a project can neither read nor confirm the existence
of another project's threads, and that no longer depends on the caller checking.
This finishes DEF-1 for comments, matching what record 0115 did for the file
store. The capability's `load` still compares `ProjectID` after the read; the two
checks are deliberately redundant and the capability-side one stays. `id` is the
primary key, so the added predicate filters the one row the unique index already
located — no scan.

### `CommentsByDocument` — project- and document-scoped, with a tri-state filter

Always filtered on **both** `project_id` and `document_id`, so a comment can only
ever be read through the project that owns it — a document ID leaked across
projects returns nothing rather than another project's discussion. The resolved
filter is a `*bool`, giving three cases: `nil` for every comment, `false` for the
open ones, `true` for the resolved ones. The predicate and its argument are
appended only when the pointer is non-nil, and results are ordered
`created_at, id` so identical timestamps still produce a stable sequence.

### `UpdateComment` — only the mutable fields

Writes `body`, `resolved`, and `updated_at` and nothing else. The anchor, author,
document, and project are fixed at creation; editing a comment cannot move it to
a different span or reattribute it. It does not check `RowsAffected`, so updating
a comment that no longer exists is a silent no-op.

### `DeleteComment` — the thread goes with it

Runs in an explicit transaction, deleting `comment_replies` first and then the
comment row, with `defer tx.Rollback()` covering the early returns. The schema
declares `comment_replies.comment_id` as a foreign key but SQLite does not
enforce cascades here, so the ordering is load-bearing: without it a failed
second statement would leave replies orphaned against a comment that is gone.

### `AddReply` — append to a thread

Insert only. Replies are immutable and have no `updated_at` and no resolved
state; there is deliberately no `UpdateReply` or `DeleteReply` — the only way a
reply disappears is with its parent comment.

### `RepliesByComment` — a thread's responses in order

Scoped to one `comment_id` and ordered `created_at, id`, matching the tie-break
used for comments.

### `RepliesByComments` — every thread on a page in one query

The batched counterpart. Listing a document's comments used to call
`RepliesByComment` once per comment — an N+1 on the hottest read there is — so
this takes the whole set of comment ids, builds an `IN` clause with the
package's shared `inPlaceholders` helper (`sqlite_knowledge.go`), and groups the
rows by `comment_id` on the way out. An empty id list short-circuits to an empty
map without touching the database, since `IN ()` is not valid SQL.

Two properties the capability depends on: the `ORDER BY created_at, id` is
identical to `RepliesByComment`'s, so grouping preserves per-thread order and
the batched result matches what the single-comment path would have returned; and
a comment with no replies is simply **absent** from the map rather than mapped
to an empty slice, which is what a join-free `IN` query naturally produces.

### `scanReplies` — the shared reply decoder

Drains a reply query into ordered `comment.Reply`s and owns the `rows.Close()`,
so `RepliesByComment` and `RepliesByComments` cannot decode a reply differently.
It returns `rows.Err()` so an iteration cut short by an error is not mistaken
for the end of the result.

### `scanComment` — the shared row decoder

Takes the package's `rowScanner` interface (declared in `sqlite.go`, satisfied by
both `*sql.Row` and `*sql.Rows`) so the single-row and listing paths decode
identically. It owns three conversions on the way out: `sql.ErrNoRows` becomes
`comment.ErrNotFound`, the INTEGER `resolved` becomes a bool via `!= 0`, and the
text timestamps are parsed with `timeLayout`, leaving the zero time if a stored
value is unparseable rather than failing the read.
