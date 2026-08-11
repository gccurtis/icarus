# 0008 — knowledge lattice (first slice) + the /dev endpoint convention

The first slice of the **knowledge** capability: a per-project retrieval
**lattice** built over source text, plus grounded retrieval against it. Alongside
it, a naming convention — endpoints that aren't part of the production client
surface now live under a **`/dev`** prefix — and a testing practice: features
whose *quality* only real models can prove are verified against a live provider,
with their token cost surfaced.

This is deliberately simple. It builds the lattice, the per-source and
cross-source clustering, and the add + retrieve endpoints, so we can see real
documents cluster and retrieve end to end. Ingestion driven automatically by
resource changes, deletion/GC, and richer descent are left for later.

## New capability: `core/capability/knowledge`

### The lattice model

A **Source** is a registered origin. Its own identity is `(SourceType,
SourceID)` — for now `("document", <documentID>)`, but `SourceID` is explicitly
*not* assumed to be a document id; other resource types will feed the lattice
later. Internally each source gets a `LocalRefID`, which is the handle windows and
nodes hang off. Time is tracked as two fields:

```go
type Source struct {
	LocalRefID string    `json:"localRefId"`
	SourceType string    `json:"sourceType"`
	SourceID   string    `json:"sourceId"`
	ProjectID  string    `json:"projectId"`
	Text       string    `json:"text"`
	AddedAt    time.Time `json:"addedAt"`
	SyncedAt   time.Time `json:"syncedAt"`
}
```

`AddedAt` is when the source first entered the lattice; `SyncedAt` is the last
time it updated the lattice. (This replaced an earlier "created at" framing —
the meaningful times are *added to the lattice* and *last synced from the file*,
not when the underlying resource was created.)

A **Window** is a byte range into `Source.Text` plus that chunk's unit-normalized
embedding. A **Node** is a cluster artifact — a centroid over its children
(windows at level 1, lower nodes above). A node scoped to one source carries that
source's `LocalRefID`; a node with an empty `LocalRefID` is a cross-source
(project-top) node. `Root` marks the top of a subtree.

### The pipeline: window → embed → cluster → per-source root → cross-source top

`Add` snapshots the text, windows it (~400 runes, 80 overlap, on rune
boundaries), embeds the windows, clusters them into a per-source subtree, and
rebuilds the cross-source top from every source's root:

```go
spans := windowSpans(text, windowRunes, overlapRunes)
...
nodes, _, _ = buildLattice(projectID, localRef, winIDs, winVecs, branchFactor, now)
...
if err := k.store.ReplaceSource(source, windows, nodes); err != nil {
	return AddResult{}, err
}
if err := k.rebuildTop(projectID, now); err != nil {
	return AddResult{}, err
}
```

Clustering is hierarchical k-means with `branchFactor` (4) children per node,
made fully **deterministic** — evenly-spaced initial centroids and a fixed
iteration count, no randomness — so the same inputs always produce the same
lattice (`lattice.go`). `rebuildTop` clusters the source roots into the
cross-source top; with one source (or none) there is no top layer and retrieval
enters at the source roots directly.

Re-adding an existing origin **replaces** its windows and nodes in place, keeping
the original `AddedAt` and `LocalRefID` and advancing `SyncedAt`.

### Retrieval: descend to grounded, cited spans

`Retrieve` embeds the query, enters at the cross-source top (or the source roots
if there is no top), and descends — following the best `descentBeam` (8)
node-children by centroid score at each level while collecting all window
children as candidates — then ranks candidates by query·window and returns up to
`topK` hits. Each hit resolves back to exact source text and carries provenance:

```go
type Hit struct {
	SourceType string  `json:"sourceType"`
	SourceID   string  `json:"sourceId"`
	Start      int     `json:"start"`
	End        int     `json:"end"`
	Score      float64 `json:"score"`
	Text       string  `json:"text"`
}
```

Knowledge is **inference-free**: it returns grounded spans, it never synthesizes
an answer.

### Ports: Embedder and Store

Knowledge depends on two narrow ports, so it never imports the intelligence
service or a database. `Embedder` turns text into vectors *and reports token
usage*, so a caller (or a test run) can surface cost:

```go
type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float64, Usage, error)
}
```

`Add` and `Retrieve` return that usage (`AddResult.Usage`,
`RetrieveResult.Usage`). `Store` persists the lattice; `MemoryStore` (flat slices)
backs unit tests, and the SQLite store backs the running service.

## SQLite: three knowledge tables — `core/platform/storage/sqlite`

The durable store gained `knowledge_sources`, `knowledge_windows`, and
`knowledge_nodes` (window bounds are stored as `win_start` / `win_end` — `end` is
a SQLite keyword), and implements the `knowledge.Store` methods:
`SourceByOrigin`, `ReplaceSource` (atomic per-source replace of snapshot +
windows + nodes), `ReplaceTopNodes`, `SourceRoots`, and `LoadProject`.

## The `/dev` endpoint convention

Endpoints that are **not part of the production client surface** — driven
normally by internal flows, not called directly by a client — are now grouped
under a **`/dev`** prefix, so the surface makes the distinction obvious. Two
consequences in this change:

- The document **re-base** trigger moved from `/documents/:id/rebase` to
  `/dev/documents/:documentID/rebase` (it exists to trigger/observe a job on
  demand; the real trigger is the automatic threshold). The jobs dev-test and
  manual were updated to the new path.
- The new knowledge endpoints are registered under `/dev/knowledge/*`.

## Dev handlers — `core/handlers/knowledge`

Two project-scoped, gated, owner/editor-only handlers:

- `POST /dev/knowledge/documents/:documentID` — loads the document, flattens its
  rows/blocks to text, and adds (or re-syncs) it as a source.
- `POST /dev/knowledge/retrieve` — embeds the query and returns grounded spans.

An unconfigured embedding provider surfaces as `503`, matching the intelligence
endpoints.

## Wiring — `core/wiring`

The composition root builds the knowledge service and adapts the intelligence
embedding endpoint to the `Embedder` port under one fixed cast
(`general / medium / medium / medium`), threading usage through so cost is
observable:

```go
know := knowledge.New(store, knowledgeEmbedder{
	intel: intel,
	cast:  intelligence.Cast{Purpose: "general", Strength: "medium", Speed: "medium", Cost: "medium"},
})
```

The `/dev/knowledge/*` routes are registered only when the service is present.

## Testing against real providers, and surfacing cost

Plumbing (windowing, storage, re-add semantics, retrieval descent) is covered by
unit tests with a **fake** embedder. But whether the lattice *clusters and
retrieves well* — whether a topical query lands on the right source — is
meaningless without real embeddings. So retrieval **quality** is verified live in
a new `dev-test/knowledge` suite that makes real embedding calls: it adds two
topically distinct documents and asserts that a query about each retrieves a hit
whose top source is the matching document. Without a key the suite **skips**
(exit 0), keeping CI green without secrets.

A run that spends real money must say so. `dev-test/lib.sh` gained `track_usage`
and `usage_summary`, which sum the `usage` tokens across a run and print the
total plus an estimated dollar cost. This practice is now written into
[AGENTS.md](../../AGENTS.md) ("Testing with real providers" / "Surface the
cost"), and a top-level [CLAUDE.md](../../CLAUDE.md) points Claude at AGENTS.md.

## Verification

`go build/vet/test ./...` clean; the knowledge unit tests pass with the fake
embedder; the live `dev-test/knowledge` suite passes against OpenRouter
(`text-embedding-3-small`) — both topical queries land on the correct source —
and reports its token cost. The paired-doc verbatim check passes for the new and
updated `.go.md` companions.
