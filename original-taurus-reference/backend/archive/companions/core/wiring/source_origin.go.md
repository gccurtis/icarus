# source_origin.go

The read half of the knowledge composition seam. `sourceOriginReader` implements
`knowledge.SourceReader` by dispatching on the lattice's source type to whichever
capability actually owns the content — documents, the file store, or a connector's
provider. `FlattenDocument` is the one definition of what a document's text is, shared
by this reader and the handler that admits documents. See repo conventions
(AGENTS.md).

## Why this file exists

Content flows *into* the lattice through the adapters beside this one —
`connectorLatticeWriter`, `attachmentLatticeWriter`. This is the same seam in the
other direction, and it exists because the lattice stopped keeping a second copy of
every source.

The lattice keeps **windows**, because windows are the artifacts it retrieves and
cites, and a citation has to be interpretable from the thing being cited. It does not
keep whole sources: those already live at their origin, and a copy of them could only
ever drift from the real thing — silently, since both look well-formed. So a caller
asking for a whole source is asking the *origin* a question, and this is how the
question travels without knowledge importing anyone.

## Code breakdown

### `sourceOriginReader` — dispatch by source type

Three source types, three origins: `document` → `docs.Get` + flatten, `attachment` →
the file store, `connector` → the provider. An unknown type answers `ErrOriginGone`
rather than erroring, since from a caller's side "the content is not reachable" is the
same answer however it came about.

Every branch degrades to `ErrOriginGone` when its capability is absent, so a
deployment missing one of them refuses that source type cleanly instead of panicking.

### `readDocument` flattens exactly as indexing does

It calls the same `FlattenDocument` the admitting handler uses, which is the point of
the function being shared: a read and a citation must describe the same bytes and the
same components, and two implementations would drift.

`doc.ErrNotFound` becomes `ErrOriginGone` — a deleted document is precisely the case
this error exists to name.

### `readAttachment` resolves the id pairing first

An attachment's lattice source id and the file holding its bytes are two different
ids, minted by the chat capability, so the pairing is resolved through it
(`chatAttachmentFiles`) before the file store is asked. A missing attachment or a
missing file both mean the origin is gone.

Its block span is the whole file, matching what the indexer writes: an attachment has
no internal component structure to cite.

### `readConnectorFile` pays a whole snapshot for one file

It resolves the source id to the provider's key through `connectors.Files` — the
lattice is where the id↔path pairing lives — and then reads that one file.

The read costs a full snapshot of the connector's source, because `Provider` exposes
only `Snapshot()`. That is a deliberate deferral rather than an oversight: adding a
per-file method means changing `cmd/connector-watcher`'s wire protocol, a separate
binary, and Phase 6 of the resilient-ingest design already moves the provider to a
per-file reader for streaming ingest. This becomes a single read for free at that
point.

What makes the deferral acceptable is *where the cost lands*: this serves a read a
person triggers by hand, not the sync path, so one person waits for one answer rather
than the detector paying on every tick.

### `FlattenDocument` — one definition, two callers

Renders a document as the text the lattice indexes, with the byte-range → (row, block)
map that lets retrieved spans cite real document addresses rather than offsets into a
disposable string. Inferred blocks are skipped, so the lattice never indexes its own
output — a prompt block's text is generated *from* the lattice.

It lives here, and is exported, because two composition points need the same answer:
the dev handler that admits a document, and `readDocument` above. A read whose text
disagreed with the text that was indexed would return byte ranges citing the wrong
components, and both sides would look correct while doing it.

It moved out of `core/handlers/knowledge`, which injects it as a `Flattener`. Wiring
may import handlers; the reverse is not allowed, so the shared definition has to sit
on this side of that line.
