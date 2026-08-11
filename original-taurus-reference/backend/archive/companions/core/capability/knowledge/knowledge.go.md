# knowledge.go

`knowledge.go` is the core of the knowledge capability: the vocabulary the
lattice is described in, the two ports it depends on, the service struct, and
its constructor. It deliberately holds no algorithm. The write path lives in
[`build.go`](build.go.md), the read path in [`retrieve.go`](retrieve.go.md), the
pruned lattice walk in [`descent.go`](descent.go.md), and the KLR clustering
itself in [`lattice.go`](lattice.go.md).

The package doc at the top of this file is the conceptual entry point for the
whole capability: a source is registered under an internal local reference id,
its text is split into overlapping windows, each window is embedded, and the
windows are clustered — within the source, then across the project — by the KLR
rule. A source therefore ends as a forest of roots and orphans (its *frontier*),
never a forced single summary. Knowledge is inference-free: it returns grounded,
cited spans and never synthesizes an answer, and it reaches embeddings only
through the narrow `Embedder` port, so it never imports the intelligence service.

## Code breakdown

### Source-type constants naming what may feed the lattice

`SourceTypeDocument`, `SourceTypeConnector` and `SourceTypeAttachment` are the
origin kinds registered today. They are plain strings rather than a closed enum
because other resource types are expected to start feeding the lattice without a
type change here.

`SourceTypeAttachment` was the third to arrive, and it is worth saying why it is a
source type at all rather than a special case somewhere upstream. A file attached
to a chat used to be inlined into the turn's prompt as caller-supplied context.
That put its content in front of the model but left it outside the evidence set,
so nothing in it could be cited — and a grounded answer with no citation is
rejected, which made a question answerable *only* from an attachment fail every
time. Admitting the content here means an upload is retrieved, read and cited by
the same machinery as everything else, and the special case disappears instead of
being handled.

### Composite source ids: `SourceIDSeparator`, `GroupSourceID`, `GroupSourceIDPrefix`

Some sources arrive as a group rather than alone: a connector's files, or the
files of one directory upload. These helpers give that group a shape the lattice
can address — the group's id, a separator, then the member's own id.

**Both halves are ids, and neither is a name.** That is the load-bearing part.
A filename can hold anything a user can type — spaces, quotes, brackets, its own
path separators — and a source id has to survive being handed to a model as
evidence and echoed back byte-exact as a citation. An id survives that; a name
is a liability. The human name is kept beside the id as `Source.Label`, which is
what a listing shows, so nothing is lost by keeping it out of the address.

Because both halves are hex, the separator only has to be something an id cannot
contain, and `/` qualifies. `GroupSourceIDPrefix` stays exact for the same reason
it always was: the group id followed by a character no id can contain matches
every member of that group and nothing else.

It was `\x1f` (ASCII unit separator) until a live run proved that choice wrong.
The reasoning had been that an unprintable byte could never collide with a path
segment — true, and beside the point once ids stopped containing paths at all.
What it did instead was break the citation round trip: `gpt-5.1` was handed an
attachment's id in evidence, returned it with U+FFFD where the `0x1F` had been,
and its correct answer was rejected as citing evidence that was never retrieved.
Every other byte matched. A separator that cannot appear in text is a separator
that does not survive a trip through a model.

The pair is stated here, once, because two capabilities depend on the two halves
agreeing: whoever composes an id and whoever later enumerates by prefix must use
the same separator, and a mismatch would not fail loudly — it would simply return
nothing.

### Calibration constants: windowing, retrieval budget, descent bounds

Two grouped `const` blocks carry every tunable default. The window target is
~1000 tokens approximated as ~4 runes per token, so references, pronouns and
local argument structure resolve *inside* the embedded text; the overlap budget
carries roughly a sentence or two across each cut so a fact straddling a
boundary is never lost. The descent block is deliberately conservative — a beam
of 3 and a 0.35 similarity threshold, plus `maxDescentExpansions` as a hard
backstop on nodes expanded per query — because the KLR starting point is not
trusted wider until the audit says so.

### Options, the calibration surface

Every field is optional; a zero value takes the default above (or the clustering
defaults in `lattice.go`). Every field is **tuning** — caps, limits,
calibration. Retrieval is directed descent, always: there is no
enabled/audit pair any more, because a flag that selects retrieval mechanics
is a comparison harness living in production. The exact scan survives as
`RetrieveExact`, the reference oracle tests hold descent to, and as the
in-production fallback when descent surfaces nothing.

The sparse clustering path has NO policy switch: `MaxClusterPool` is the
crossover, and any pool above it clusters over the k-NN graph
([`neighbors.go`](neighbors.go.md)) — validated live against real embeddings
before the switch was removed. Mechanics do not carry flags here; the tuning
knobs remain. `NeighborsK`, `NeighborsCells` and `NeighborsPCADims` calibrate
the sparse construction; `NeighborsPCADims` reads three ranges — 0 takes the
default (128), negative disables projection — so "score candidates at full
dimension" is something configuration can say deliberately while silence still
gets the default.

`NeighborsRepairMaxFraction` and `NeighborsRepairMaxDrift` bound the
local-repair path ([`repair.go`](repair.go.md)): the changed fraction a stored
level index may absorb, and how far the pinned threshold may stray from the
pool's current percentile, before a rebuild consolidates instead. Both follow
the same three-range convention (0 default, negative disables repair).

The retrieval probe is likewise unflagged: descent enters through the
persisted corpus index whenever one is stored (project the query, score only
the nearest cells' members plus everything the index does not cover), and
scans the full entry frontier when none is — presence of the index is the
decision. The Store port carries the two narrow reads this needs —
`CorpusIndexHeader` (one level's machinery without its artifacts) and
`EntryFrontierProbed` (the entry frontier narrowed by cells, with the
unindexed remainder always included).

Two more are neither tuning nor policy. `MaxClusterPool` bounds how large a pool
one clustering ascent may take — a guard on an *allocation*, since clustering
builds the complete n×n similarity matrix (n²·8 bytes regardless of vector
dimension). `Logger` receives operational narration, today that an ascent
refused its pool; nil becomes a `logging.Nop`, so tests never have to supply one.

`Enqueuer` schedules the corpus rebuild a write defers. Nil means rebuilds are
never scheduled and `RebuildCorpus` must be driven by hand — which is exactly
what a test wanting a deterministic corpus tier does, rather than racing a
worker.

### Source and its provenance types

`Source` is a registered origin under an internal `LocalRefID`, plus the origin's
own public `(SourceType, SourceID)`. The load-bearing field is `Blocks`, a
`[]BlockSpan` mapping byte ranges of the indexed snapshot back to the origin's
components. Without it a retrieved span could only cite offsets into a disposable
flattened string; with it, a span cites real document rows and blocks. `BlockRef`
is the citation-side counterpart — the component identity alone, no offsets.
`AddedAt`, `SyncedAt` and `Revision` separate "when it first entered the lattice"
from "when it last updated it" and "which version of the origin that was".

**It does not carry the snapshot's text.** What is left of it is
`SizeBytes`/`LineCount` — the two numbers a listing reports — and `ContentHash`,
the identity a re-sync compares to decide whether anything changed. The text
itself lives at the origin, and the spans the lattice retrieves live on the
windows; a third copy here could only drift from both, silently, because every
copy looks well-formed.

The hash is also what makes the comparison affordable once ingest streams: a
5MB file can be hashed as it is read, whereas comparing whole strings means
holding both in memory at once. `ContentHash` is never empty, not even for empty
content, which is what lets a stored empty hash mean "not yet backfilled" and
nothing else.

### Window, Node and FrontierEntry — the lattice artifacts

A `Window` is a chunk of a source's text — its own copy of that text, the byte
range it occupied when it was indexed, and that chunk's unit-normalized
embedding. A `Node` is one maximal clique's representative: a centroid (the
normalized sum of its members' vectors), a member count, and `Cohesion` — the
*weakest* pairwise similarity inside the clique. Two properties of `Node` are
easy to miss and shape everything downstream: members may be windows *or* lower
nodes, and because cliques overlap one member may appear under several parents,
so the lattice is a DAG rather than a tree; and roots are not flagged. The
frontier — nodes that are no one's member, plus never-clustered orphan windows —
is *derived*, which is why `FrontierEntry` exists as a computed value carrying
just the id, the vector to cluster by, and whether it is a window.

### Usage, VectorIdentity and Embedded — the embedding contract

`Usage` reports token consumption so a caller (or a live test run) can surface
its provider cost. `VectorIdentity` names the embedding space a set of vectors
belongs to, and it is the reason cross-space comparison cannot happen silently:
a cast is only a semantic alias, and configuration may re-route it to another
model at any time, so the resolved identity is stamped on every source at
ingestion and checked against the query embedding at retrieval. `Embedded`
bundles one embedding call's vectors, usage and identity.

### ErrIdentityMismatch

The sentinel returned when a query embedding and the stored lattice live in
different vector spaces. Refusing is the whole point — comparing across spaces
would return plausible-looking garbage scores instead of an error.

### Result types: AddResult, RetrieveResult

`AddResult` splits window counts into `Reused` and `Embedded` so the reported
`Usage` is legible: on a re-sync, only what actually changed was paid for.

`Skipped` reports that the source was already stored byte-for-byte, so `Add`
returned without rewriting anything. `Windows`, `Nodes` and `Usage` are all zero
in that case, which is why the flag has to exist: it is what separates "there was
nothing to do" from "this produced nothing". (The old `ClusterSkipped` pair is
gone with the refusal path: no pool is ever refused, so there is no refusal to
report.)

`RetrieveResult` carries the regions plus the `Mode` that produced them —
`"descent"`, `"exact-fallback"` when descent found nothing, `"exact"` from the
`RetrieveExact` oracle, or `"scoped"`. There is no audit payload: holding
descent to the exact scan is a test's job, done against `RetrieveExact`.

### The Embedder port

A single method turning texts into vectors, usage and an identity. The
composition root adapts it to the intelligence embedding endpoint under a fixed
cast; the knowledge package knows nothing about providers.

### `CorpusLevelIndex` and its parts — the persisted k-NN index

One level of the corpus ascent's sparse index as the Store port carries it: the
pinned threshold, the candidate machinery (projection basis, IVF centroids),
and per artifact its cell and edges (`CorpusIndexArtifact`, `CorpusIndexEdge` —
edges name neighbours by artifact id and carry the exact similarity). It is
derived state — a rebuild can always recreate it from the frontier — persisted
so the *next* rebuild can treat a small change as a local repair instead of a
global reconstruction. Vectors are deliberately absent: they live with the
windows and nodes, and the index refers to them by id.

`RebuildCorpus` replaces a project's indexes wholesale beside the tier (one
transaction, one frontier); `CorpusIndexes` reads them back. The indexes are
NOT dropped when a write invalidates the tier — the tier is dropped because
descent would follow it into dangling members, but the index's only reader is
the next rebuild, which diffs it against the live frontier by id, and a stale
index is exactly the input a repair wants.

### `SourceWrite` and `AddItem` — the batch's two payload types

`SourceWrite` is one source's complete replacement payload (snapshot, windows,
nodes); a slice of them is what `ReplaceSources` commits together. `AddItem` is
one source's input to `AddBatch` — the same arguments `Add` takes, as a value so
a caller can hand over a whole set at once.

### The Store port

`Store` persists the lattice — SQLite in production, `MemoryStore` in tests. Its
shape encodes two decisions.

The two write methods each take a `rebuildCorpus` callback rather than returning
control to the service between steps:

```go
ReplaceSources(writes []SourceWrite) error
DeleteSource(projectID, sourceType, sourceID string) (bool, error)

CorpusSeq(projectID string) (dirty, built int64, err error)
SourceFrontier(projectID string) ([]FrontierEntry, error)
RebuildCorpus(projectID string, corpus []Node, seq int64, indexes []CorpusLevelIndex) error
CorpusIndexes(projectID string) ([]CorpusLevelIndex, error)
```

The two write methods no longer rebuild. Each writes its rows, **drops the
project's corpus tier and bumps its dirty sequence**, all in one transaction —
and stops there. Rebuilding is a separate operation driven off the write path
(`corpus.go`), because it is O(F²) in the project's whole frontier and holding a
write transaction for its duration serialized every other write in the project.

`ReplaceSources` takes a *slice* for the same reason it always did: batched, a
200-file sync writes once instead of 200 times. All writes must belong to a
single project.

The rebuild trio is deliberately split into read / compute / write so the
expensive middle runs outside any transaction. `RebuildCorpus` takes the sequence
the caller computed against rather than reading "now", which is what keeps a
write landing mid-computation from being silently dropped — see `corpus.go` for
the full argument.

The read methods are kept deliberately narrow so descent loads only what it
walks — `EntryFrontier` for the entry set, `NodesByID`/`WindowsByID` for
batch-fetching members one expansion at a time, `SourcesByRef` for just the
sources the final regions resolve against. Only `ProjectWindows`, used by the
exact scan and the audit oracle, reads every window.

`SourcesByRef` is narrow in a second sense now: it returns origin identity and
metadata, no content. A region has to name its origin to be citable, but its text
comes from the windows — so a query's cost no longer scales with the size of the
files it happened to hit.

### The Knowledge service struct

Every method is project-scoped by argument, so one service instance serves all
projects. The struct holds the two ports, the resolved clustering config, and
the flattened calibration values — plus `log logging.Logger` for operational
narration and `now func() time.Time`, injected so tests can control timestamps.

`log` is stored through `logging.OrNop`, so it is never nil and call sites log
unconditionally. That matters more than it looks: the calls guarded by a nil
check would be exactly the ones on the degraded path the log exists to explain,
which is the worst possible place to discover a missing guard.

### New — resolving Options into the service

The constructor is entirely defaulting logic: each zero or non-positive option
falls back to its constant. Note that `DescentEnabled` and `DescentAudit` are
booleans carried straight through, so their zero value (off) *is* the intended
production default rather than a placeholder.

### ChangedSince and SourcesUnder — thin store delegations

Neither builds nor retrieves, so both sit here with the service definition.
`ChangedSince` is the cheap freshness signal a prompt-block refresh uses to
decide whether re-resolution is warranted — no retrieval, no model call. It is
deliberately project-granular, so an unrelated add also reports true (favouring
freshness over minimal churn), and a source *removal* is not reflected because
the row is simply gone. `SourcesUnder` is the enumeration primitive a connector
uses to expand itself to its files and to prune vanished ones by diffing the
current listing against it.

### Origin — the public addressing of a source

`(SourceType, SourceID)`: what the caller knows, before the lattice's internal
`LocalRefID`. It is shared vocabulary — `SourcesUnder` returns it and scoped
retrieval accepts it as an allow-list.

### coveredBlocks and newID — shared helpers

`coveredBlocks` returns the origin components a byte range touches, in source
order, using a half-open overlap test (`b.Start < end && start < b.End`) so a
span that merely abuts a block does not cite it; region assembly in
`regions.go` uses it to attach citations. `newID` mints a 128-bit hex id for
sources, windows and nodes alike, ignoring the `crypto/rand` error because it
cannot occur on the platforms targeted.

### `Source.Label` and `Origin.Label` — the lattice is the registry

A composite source id names a member by ids alone, so nothing about it says which
file it is. `Label` is the other half of that trade: the path a connector synced
the file from, the name a user uploaded it under.

It is stored beside the id rather than derived, and `SourcesUnder` returns it, and
those two facts together are what make a second table unnecessary. A connector
re-syncing a folder knows its files only by path; it recovers the id it minted
for each one last sync by looking the path up in what the lattice already holds.
A registry that lived anywhere else would be a copy of this one, kept in step by
hand.

Empty is legitimate and common: a document's source id is its document id, which
is already the identity every caller addresses it by.

### A window carries its own text and blocks

`Window` gained `Text` and `Blocks`, and `WindowContent` is the pair on its own for
the region path. `Start`/`End` remain and keep their meaning — the byte range this
text occupied in the source when it was indexed — but they are no longer an
instruction to go and slice something else. They order windows and merge them into
regions; the text travels with them.

That is the whole storage correction in one struct. An artifact is now interpretable
from itself: a citation carries its quotation and the components it came from, and a
window's text and its range cannot drift apart because both are written from the same
snapshot in the same pass (see `addPlan.cluster`).

**The two fields are loaded only where they are needed**, and the comment on the
struct says so because it is a real footgun. `SourceWindows` carries text because the
reuse map is keyed by it; `WindowContent` carries both because a region is assembled
from them. The vector-only reads — descent, the exact scan, the corpus rebuild —
leave them empty deliberately: those handle whole projects and candidate sets, and
loading the corpus's text in order to rank vectors would reintroduce exactly the cost
this change removes.

### `CoveredBlocks` is exported for the migration

`coveredBlocks` stays unexported for internal callers; `CoveredBlocks` wraps it.

The export exists for one reason: the migration that backfills a window's block refs
has to answer the same question — which origin components does this byte range touch
— and two implementations of that rule are two chances to disagree. A disagreement
here is not a crash; it is a citation pointing at the wrong component, which is
exactly the kind of silent wrongness this area cannot afford.

### `SourceReader`, `SourceContent`, `ErrOriginGone` — reads leave by the door content came in

`SourceReader` is the mirror of the writer seam. Content enters the lattice through an
adapter the composition root supplies; whole-source reads leave the same way, so
knowledge still imports no other capability. The composition root dispatches on source
type — a document flattens, a connector file is read through its provider, an
attachment comes from the file store.

Its existence *is* the storage correction. The lattice keeps windows because windows
are the artifacts it retrieves and cites. It does not keep whole sources, because
those already live at their origin and a second copy can only drift from the first. A
caller wanting a whole source is asking the origin a question; this is how the
question travels.

`SourceContent` carries the text and its block spans **together**, deliberately. Block
spans are byte offsets into the text, so pairing current text with a stored block
table would cite the wrong components the moment an origin drifted.

`ErrOriginGone` is distinct because it is a distinct answer. "No such source" and "the
source exists but its content is gone" call for different things from a caller — and
before the lattice stopped keeping a copy of everything, the second case could not
arise at all.

`UseSourceReader` supplies it. Without one, whole-source reads report that the
deployment cannot do it rather than falling back: there is nothing to fall back *to*,
and a lattice quietly serving its own copy is precisely what this replaced.
