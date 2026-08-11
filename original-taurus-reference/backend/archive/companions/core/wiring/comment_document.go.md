# `comment_document.go`

The document → comment adapter: how anchored comments reach the document
anchors they hang off, without the comment capability importing document.

A comment can be anchored to a span of text inside a document. That means the
comment service has to do two things it cannot do alone — confirm an anchor
really belongs to the document it claims, and create a new inline anchor when a
comment is first attached. Both are served here over `*document.Documents`.

The interesting part is not the translation, which is small, but the error
vocabulary: the adapter has to preserve the difference between *"that anchor is
gone"* and *"the store did not answer"*, because the comment capability treats
those very differently.

## Code breakdown

### `commentAnchors` — the adapter

```go
type commentAnchors struct{ docs *document.Documents }
```

Built in `Run` and passed to `comment.New` right after documents exist.

### `AnchorInProject` — validate, and report liveness

Lists the document's anchors and scans for the requested id. A match returns an
`AnchorInfo` carrying the one fact comments care about:

```go
return comment.AnchorInfo{ID: an.ID, Orphaned: an.State == document.AnchorOrphaned}, nil
```

`Orphaned` is the document capability's own verdict, translated rather than
recomputed. A document edit can delete the text a comment was anchored to; the
anchor survives in an orphaned state, and the comment survives with it, shown as
detached rather than silently vanishing. Which anchors are orphaned is the
document capability's business — this adapter only carries the answer across.

**The miss case is the load-bearing one.** A genuinely absent anchor returns
`comment.ErrAnchorNotFound`, a sentinel, while a failed lookup returns the raw
error:

```go
// A genuinely missing anchor is a distinct sentinel (not an infra error), so
// the comment service can tell "orphaned" from "the DB is down".
```

Collapsing both into one error would make the comment service either reject
valid comments during a blip or accept anchors that do not exist. Keeping them
distinct lets it treat a missing anchor as a domain outcome and an infra error
as something to fail loudly on.

Note the linear scan: it lists every anchor in the document to find one. That is
fine at the scale anchors occur in practice, and it comes free with the existing
`ListAnchors` call rather than requiring a new single-anchor read path on the
document service.

### `CreateAnchor` — the field-for-field translation

Maps `comment.AnchorRef` onto `document.DocumentAnchor`:

```go
RowID: ref.RowID, BlockID: ref.BlockID, AtomID: ref.AtomID, Start: ref.Start, End: ref.End
```

The two structs describe the same position — a row, a block, an atom, and a
character range within it — but each capability keeps its own type, which is
exactly what lets them stay independent. This four-line copy is the price of
that independence, and it is why the adapter lives in wiring instead of a shared
package that both would have to import.

Only the created anchor's id is returned. A freshly created anchor is never
orphaned, so the zero `Orphaned` is correct without being set.
