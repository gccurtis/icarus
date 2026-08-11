# `reference_document.go`

Both directions of the document ↔ reference boundary, plus the trick that lets
two mutually dependent services be constructed in a single pass.

The relationship is genuinely circular. A document reindexes its outgoing links
after every edit, so **document needs reference**. Resolving those links to real
resources — and rendering their current names — reads documents back, so
**reference needs document**. Neither capability may import the other, and
neither can be built first.

This file resolves both problems: two adapters for the two directions, and a
late-bound indexer that is handed to documents empty and pointed at references
once those exist.

## Code breakdown

### `lazyReferenceIndexer` — breaking the construction cycle

A one-field holder over `*reference.References` that satisfies the document
capability's `ReferenceIndexer` port. `Run` creates it *before* documents, passes
it into `document.New`, and back-patches it after `reference.New`:

```go
refIndexer := &lazyReferenceIndexer{}
docs := document.New(store, document.Options{ReferenceIndexer: refIndexer, ...})
// ...
references, err := reference.New(store, documentResolver{docs: docs})
refIndexer.refs = references
```

It is a pointer receiver precisely so that back-patch is visible to the copy
documents is holding.

**The nil case is an error, not a no-op.** During the window between the two
lines above the indexer has no target, and `ReindexDocument` returns
`errors.New("wiring: reference indexer used before it was bound")`. Nothing calls
it in that window today — `Run` finishes wiring before the listener starts — but
returning `nil` would mean that if the boot order ever changed, a document's
links would be silently dropped from the graph with no signal anywhere. A loud
error costs nothing while the invariant holds and is the difference between a
five-minute and a five-day debugging session if it stops holding.

When bound, the method's only real work is a type translation: each
`document.OutgoingLink` becomes a `reference.LinkRef` carrying href and anchor.

### `documentResolver` — reference → document

Serves the reference `Resolver` port over `*document.Documents`, with two
methods.

`Resolve` normalizes an href to a candidate id and confirms it names a real
document via `docs.Summary`. Anything that does not resolve — an external URL,
a dead id, a typo — returns `ok=false`, and the reference graph simply omits
that link. That is the intended behaviour: the graph is a map of connections
that actually exist, so a broken link is an absence rather than a dangling node.

`Name` looks up a document's *current* name for rendering, and rejects any kind
other than `reference.KindDocument`. Names are resolved live rather than stored
in the graph, so renaming a document immediately updates every backlink to it.

Both methods swallow the lookup error and report a bare `false`. The reference
capability has no way to act differently on "no such document" versus "the store
is unavailable" — in both cases the link does not resolve right now.

### `normalizeDocumentHref` — href → candidate id

A pure string reduction, in strict order:

1. **Reject external schemes** (`http://`, `https://`, `mailto:`, `tel:`) up
   front. These can never be in-project, and checking first means the later,
   looser rules cannot misfire on them.
2. **Strip a known internal prefix** — `taurus://document/`, `document://` or
   `document:` — using `strings.CutPrefix`.
3. **Take the tail after the last `/documents/`**, which catches hrefs pasted
   from the address bar. `LastIndex` (not `Index`) so a URL that happens to
   contain the segment twice yields the final, real id.
4. **Otherwise return the trimmed href unchanged**, treating a bare string as a
   candidate id.

Every branch produces a *candidate*, never a verdict. The function deliberately
does not validate id shape — `Resolve` settles that by asking the document
service, so there is exactly one definition of "this href names a document".
