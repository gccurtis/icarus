# comment.go

The comment capability: project-scoped, anchor-bound discussion on documents. A
`Comment` is pinned to a document anchor and carries an ordered thread of
`Reply`s. Anchors live in the document capability, so this package reaches them
only through an injected `AnchorReader` port and never imports `document` —
the dependency runs one way, through the composition root.

Reading a comment is a three-part assembly: the row itself, its replies, and a
live check of whether its anchor still points at anything. The listing path does
that assembly for a whole document at once, so it batches the reply load rather
than repeating it per comment.

## Code breakdown

### Package doc, `Scope`, and the sentinel errors

`Scope` is trusted application context — a project id set after `access` has
selected a project. The errors distinguish the failure modes; the subtle one is
`ErrAnchorNotFound`, which an `AnchorReader` must return when the anchor simply
does not exist, as opposed to when the anchor lookup itself failed. That
distinction is what lets a read flag a thread as orphaned instead of erroring,
and lets a create reject the request.

### `Reply` and `Comment`

`Reply` is one flat message in a thread — replies point at comments, never at
each other. `Comment` carries its body, author, resolved flag, and two fields
that are *not* stored: `Replies`, loaded on demand, and `AnchorOrphaned`,
resolved at read time from the `AnchorReader` so a client can flag stranded
threads.

### `AnchorRef`, `AnchorSelector`, `AnchorInfo`, `AnchorReader`

A new comment either names an existing anchor or supplies an inline target
(`AnchorRef`: row, block, atom, and a UTF-8 byte range — both offsets zero pins
the whole block) that the service materializes into one. `AnchorReader` is the
two-method port over the document capability that makes this possible without an
import.

### `Store` — the persistence port

Comments, their replies, and a cascade on delete.

`CommentByID` takes the project id as its first parameter: the store is expected
to filter on it, so a comment owned by another project is `ErrNotFound` at the
store rather than a row `load` is trusted to vet. That finishes DEF-1 for
comments, extending the in-SQL scoping record 0115 introduced for the file store.
`load` still compares `comment.ProjectID` against the scope afterwards — the two
checks are **deliberately redundant** and the capability-side one stays: one
layer covers a store that does not scope, the other covers a caller that forgets
to compare.

Reply loading has two shapes:

```go
RepliesByComment(commentID string) ([]Reply, error)
RepliesByComments(commentIDs []string) (map[string][]Reply, error)
```

The batched form exists for the listing path — a thread page would otherwise
fire one reply query per comment, the classic N+1. Comments with no replies may
be absent from the map, so callers must treat a missing key as an empty thread
rather than as an error.

### `Comments` and `New`

The service holds the store, the anchor port, and an injectable `now`. `New`
requires both dependencies.

### `Create` — resolve an anchor, then write

Validates scope, document, body, and author; resolves the anchor; stamps one
`now` into both `CreatedAt` and `UpdatedAt`; defaults a blank author name to the
author id. The returned comment gets an empty (non-nil) `Replies` slice so the
JSON shape matches a read.

### `resolveAnchor` — existing, inline, or nothing

For a named anchor, a missing one becomes `ErrNotFound` (the client anchored to
something that does not exist) while an infrastructure error is surfaced as
itself rather than masked as a 404. An inline `AnchorRef` is created through the
port. Neither given is `ErrAnchorMissing`.

### `List` — one batched reply load for the page

Fetches the document's comments (optionally filtered to open or resolved),
returns early when there are none, then collects their ids and makes a **single**
`RepliesByComments` call. Each comment is finished with `hydrateWith` using its
slice of that result. The anchor check is still per comment, since it crosses the
`AnchorReader` port; the reply load — the part that hit the same table N times —
is now one query.

### `Get`, `Patch`, `Delete`, `Reply`

All go through `load` first, so every one of them is project-scoped. `Patch`
treats nil fields as unchanged and only writes (and bumps `UpdatedAt`) when
something actually changed, but still re-hydrates so a no-op returns the same
shape as a real edit. `Delete` cascades the thread in the store. `Reply` stamps
the parent's project onto the reply, so a reply can never end up in a different
project from its comment.

### `load` — the scope gate

Fetches by id and reports a comment in another project as `ErrNotFound`, so a
project can neither read nor confirm the existence of another project's threads.
It now passes the scope's project id into `CommentByID`, so the store refuses a
foreign comment before `load` ever sees it; `load`'s own `ProjectID` comparison
is kept behind that as the independent second layer.

### `hydrate` and `hydrateWith` — one comment vs. a page

`hydrate` loads a single comment's replies and hands off to `hydrateWith`;
`hydrateWith` takes an already-loaded thread and resolves the anchor flag.
Splitting them is what lets `List` supply threads from its batch while both
paths finish a comment identically. A nil thread is normalized to an empty
slice, and an infrastructure error is returned rather than silently producing
wrong data — an empty thread, or a live anchor flagged orphaned. Only a genuine
`ErrAnchorNotFound` sets `AnchorOrphaned`.

### `newID`

16 random bytes, hex-encoded, shared by comments and replies.
