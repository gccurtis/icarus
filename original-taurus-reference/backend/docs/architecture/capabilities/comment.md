# COMMENT — anchored document discussion

COMMENT owns **discussion pinned to a place in a document**: a `Comment` bound to
a document anchor, carrying an ordered thread of `Reply` messages and a
`resolved` flag. It is the review layer over the [document](documents/README.md)
capability — margin notes, questions on a paragraph, "done" checkmarks — kept as
its own capability so a thread's lifetime is independent of the block tree it
points into.

The anchor itself is document state, not comment state. COMMENT reaches it only
through an injected `AnchorReader` port and **never imports document**: it stores
an `AnchorID` string and asks the port whether that anchor still exists and
whether its target is still live.

- **Domain and persistence contract** —
  [`core/capability/comment/comment.go`](../../../core/capability/comment/comment.go).
  The `Comments` service, its value types, the `Store` and `AnchorReader` ports.
  Its in-memory `Store` lives in
  [`core/capability/comment/memory.go`](../../../core/capability/comment/memory.go).
- **Application handlers** —
  [`core/handlers/comment/comment.go`](../../../core/handlers/comment/comment.go).
  Thin endpoints, plus the per-document access check described below.

## The model

```go
type Comment struct {
	ID, ProjectID, DocumentID, AnchorID string
	AuthorID, AuthorName                string
	Body                                string
	Resolved                            bool      // stored
	AnchorOrphaned                      bool      // resolved at read time, never stored
	CreatedAt, UpdatedAt                time.Time
	Replies                             []Reply   // hydrated on read
}

type Reply struct {
	ID, CommentID, ProjectID     string
	AuthorID, AuthorName, Body   string
	CreatedAt                    time.Time
}
```

`AnchorOrphaned` is the one derived field: `hydrate` asks the `AnchorReader` for
the anchor on every read, and sets the flag only when the reader returns the
distinct `ErrAnchorNotFound` sentinel. Any *other* error is propagated rather
than swallowed — flagging a live thread as orphaned because the database is down
would be worse than failing the read.

A new comment names its target with an `AnchorSelector`: either an existing
`AnchorID`, or an inline `AnchorRef{RowID, BlockID, AtomID, Start, End}` (UTF-8
byte offsets into the atom's text; both zero pins the whole block) that the
service materializes into a real anchor through the port. Neither → `ErrAnchorMissing`.

## Ports and who satisfies them

| Port | Satisfied by |
|---|---|
| `Store` | the one `*sqlite.Store`; `MemoryStore` for tests |
| `AnchorReader` | `commentAnchors` in [`core/wiring/wiring.go`](../../../core/wiring/wiring.go) |

`commentAnchors` wraps `*document.Documents`: `AnchorInProject` lists the
document's anchors, returns `AnchorInfo{ID, Orphaned: state == AnchorOrphaned}`
on a hit, and returns `comment.ErrAnchorNotFound` on a miss — the sentinel the
port contract requires so the service can tell "the anchor is gone" from "the
store failed". `CreateAnchor` translates an `AnchorRef` into a
`document.DocumentAnchor`. Neither capability imports the other.

## Scoping — enforced in two places

**In the capability.** `load` is the single gate for every by-id operation
(`Get`, `Patch`, `Delete`, `Reply`): it fetches the comment and, if
`comment.ProjectID != scope.ProjectID`, returns `ErrNotFound` — *not* a distinct
"wrong project" error. A comment in another project therefore reads as
non-existent, so a caller cannot even confirm that another project's thread ids
exist. `List` and `Create` are already document-scoped and filter by
`(projectID, documentID)` directly.

**In the handler.** The list/create routes carry a `:documentID` the transport
guard can see and check. The by-id routes (`PATCH`, `DELETE`, `POST …/replies`)
do not — so `Handlers.authorizeComment` closes that hole: it loads the comment,
reads its `DocumentID`, and runs the injected `canAccess(callerID, projectID,
documentID)` check before proceeding, returning `403` when denied. Transport
injects the same `resource.CanAccessResource` resolver the document routes use,
so the handler stays free of the [resource](resources/README.md) capability. A
document restricted *within* a project is therefore not commentable by an
excluded member, even by comment id. (The reply path originally skipped this;
fixed in record 0111 — see [issues-and-gaps](../issues-and-gaps.md) `PRIV-2`.)

## Operations

`Comments` is stateless over its two ports.

| Method & path | Service call | Purpose |
|---|---|---|
| `GET /documents/:documentID/comments` | `List` | The document's comments, each hydrated with replies and its orphan flag; `?resolved=true\|false` filters. |
| `POST /documents/:documentID/comments` | `Create` | Open a thread against an existing anchor (`anchorId`) or an inline target (`anchor{…}`). Write role. → `201`. |
| `PATCH /comments/:commentID` | `Patch` | Set body and/or `resolved`; nil fields unchanged, a no-op still returns the current comment. Write role. |
| `DELETE /comments/:commentID` | `Delete` | Remove the comment; the store cascades its replies. Write role. |
| `POST /comments/:commentID/replies` | `Reply` | Append to the thread. Write role. → `201`. |

Error mapping: `ErrNotFound` → `404`; `ErrInvalid` / `ErrInvalidScope` /
`ErrAnchorMissing` → `400`; a denied document scope → `403`. A create that names
a non-existent anchor is deliberately `404` (`ErrNotFound`), not `400` — the
client anchored to something that is not there.

## Persistence

Two tables in the one SQLite [store](../persistence.md): `document_comments`
(indexed by `(project_id, document_id)`) and `comment_replies` (foreign key to
the comment, indexed by `comment_id`). Note that `List` hydrates per comment,
firing `RepliesByComment` + `AnchorInProject` for each — the N+1 tracked as
`PERF-2` in [issues-and-gaps](../issues-and-gaps.md).

## Related

- [Documents](documents/README.md) — owns the anchors this capability points at.
- [Resources](resources/README.md) — supplies the per-document access check.
- [Access](access.md) — establishes the project scope and the write role.
