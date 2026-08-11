# sqlite_knowledge.go

`sqlite_knowledge.go` is the durable half of the knowledge lattice: the SQLite
persistence behind `knowledge.Store`. It holds ingested source snapshots, their
embedded windows, the cluster nodes built over those windows, and the membership
edges that make the whole thing a lattice — and it answers the reads that
retrieval descends through. Every method is a method on the one shared `*Store`;
this file is a slice of an organizational package split mirroring
`core/capability`, not a separate connection or lifetime.

Four tables carry the structure: `knowledge_sources` (one row per ingested
source — origin, verbatim text, block map, vector identity, revision,
timestamps), `knowledge_windows` (a source's embedded spans), `knowledge_nodes`
(cluster nodes in two tiers, distinguished by `local_ref_id` — a source-tier node
names the source it clusters, a corpus-tier node stores the empty string), and
`knowledge_memberships` (ordinal-ordered parent→member edges). Vectors and
structured fields are stored as JSON text and marshalled at this boundary.

Two ideas recur. Every write that changes a source is one transaction ending in a
rebuild of the project's corpus tier, so no reader observes a half-updated
lattice and concurrent adds cannot lose each other's work. Every read is shaped
for the retrieval descent: a frontier query supplies entry points, and batch
by-id fetches walk down from them.

## Code breakdown

### Package doc and imports

States the split's rationale — one `*Store`, one connection, organizational
boundaries only. Imports the `knowledge` capability for its `Source`, `Window`,
`Node` and `FrontierEntry` types, plus `database/sql`, `encoding/json` for the
vector and block columns, and `errors`/`time`.

### SourceByOrigin: one source snapshot, looked up by its origin

Fetches the full row for a `(projectID, sourceType, sourceID)` origin. A missing
row returns `found = false` with a nil error, so a caller can tell "never
ingested" from "the read failed". The JSON and timestamp decodes discard their
errors: a corrupt `blocks` or `identity` column yields a zero value rather than
failing an otherwise good read.

### SourcesUnder: case-sensitive prefix enumeration of a connector's sub-keys

The lattice enumeration primitive — every origin of a given type whose
`SourceID` starts with a prefix, scoped to the project. The prefix compare is
deliberately *not* SQL `LIKE`:

```sql
WHERE project_id=? AND source_type=? AND substr(source_id, 1, ?) = ?
```

`source_id` carries no `COLLATE NOCASE`, so `LIKE`'s default case-insensitive
matching would diverge from `MemoryStore`'s case-sensitive `strings.HasPrefix`,
and a `%` or `_` in the prefix would need escaping. `substr` is a plain BINARY
compare of the first N characters — case-sensitive and metacharacter-free — so
both stores agree. N is passed as a *rune* count (`len([]rune(prefix))`) so
multi-byte prefixes still compare character-for-character.

### ReplaceSources: swap a batch of sources, drop the corpus tier, commit

The main ingest write. For each source in the batch it deletes that source's old
lattice (`deleteSourceLatticeTx`) and writes the new snapshot, windows and nodes
(`writeSourceTx`); then `invalidateCorpusTx` — all in one transaction with a
deferred rollback.

Taking a batch is what makes a bulk sync affordable: a 200-file connector sync is
one transaction rather than 200. The project is read off `writes[0]` because
`AddBatch` is project-scoped, so a batch is by construction one project's.

`deleteSourceLatticeTx` exists because the replace and delete paths need exactly
the same four statements in exactly the same order — they were previously written
out twice, verbatim, in two places that had no way to stay in step.

**It no longer rebuilds.** The rebuild used to run here, inside this transaction,
via a callback the capability supplied. That was the reason a slow rebuild froze
every other write in the project: SQLite serializes writers, and the clustering is
O(F²) in the whole frontier — 7.8 s at 4,000 artifacts. It now happens off the
write path.

### The corpus tier's freshness: `invalidateCorpusTx`, `CorpusSeq`, `RebuildCorpus`

`invalidateCorpusTx` is the write path's whole interaction with the corpus tier:
`deleteCorpusTx` drops the tier's nodes and edges, and `dirty_seq` is bumped by
one. Dropping rather than leaving it stale matters because this same transaction
may have deleted ids the old tier points at — descent would follow a corpus root
into dangling members and quietly return less.

`RebuildCorpus` writes a tier that was computed **outside** any transaction, so
the write itself is short. The subtlety is in what it records:

```go
ON CONFLICT(project_id) DO UPDATE SET built_seq = ?   // the caller's seq, not "now"
```

Setting `built_seq` to the sequence the caller *read before computing* is what
makes the whole scheme safe. A write landing during the computation has already
pushed `dirty_seq` higher, so claiming it would silently swallow that change.
Recorded this way, the tier is stored and the project simply still reads as
stale, and the next rebuild picks it up.

The same transaction now also replaces the project's persisted level indexes
wholesale (`knowledge_corpus_index` + `knowledge_corpus_edges`; nil clears
them). Tier and index are computed from one frontier, and splitting the writes
could leave them describing different ones. The per-artifact edge rows go
through one prepared statement — there can be hundreds of thousands in one
rebuild.

### `CorpusIndexes`, `encodeEdges`, `decodeEdges`: the persisted k-NN index

`CorpusIndexes` reads the indexes back — levels ascending, artifacts ascending
by id — as two plain queries with no transaction, like the other derived reads:
the one consumer is the next rebuild, which diffs the result against the live
frontier anyway. An edge row whose level row is missing describes nothing and
is skipped.

The edge blob is `[count u32]` then, per edge, the neighbour's id as 16 raw
bytes plus a little-endian float32 similarity. Lattice ids are 32 hexadecimal
characters — 16 bytes — and `encodeEdges` rejects an id that is not, so
corruption fails the write loudly instead of surfacing later as a mangled
read. Matrices (the projection basis, the IVF centroids) use `encodeMatrix`
from `vector.go`.

### `CorpusIndexHeader` and `EntryFrontierProbed` — the retrieval probe's reads

`CorpusIndexHeader` is one level's machinery — threshold, k, basis, centroids
— without its artifact rows: the probe places a query among the cells on
every request and must not drag the edge set along to do it.
`EntryFrontierProbed` is `EntryFrontier` with one added clause per table: an
entry artifact survives if its id is in the probed cells' rows **or** in no
index row at all — the probe may narrow the indexed mass, never hide the
unindexed remainder (corpus roots above the level, anything written since).
`intPlaceholders` renders an empty cell list as a single `NULL` placeholder,
so probing zero cells returns exactly the uncovered remainder rather than
tripping on `IN ()`.

### Vectors are read and written as BLOBs

Every query touching `embedding` or `centroid` now also selects its `_v2` BLOB
sibling and decodes through `decodeStoredVector`, which prefers the BLOB and
falls back to the legacy JSON. Writes (`insertWindows`, `insertNodes`) store the
BLOB and leave the JSON column empty.

The legacy columns are deliberately **not** dual-written. Keeping both in step
would double every write to serve a read path that exists only for rows written
before the BLOB column did — and those are converted once, at startup, by
`backfillVectorBlobs`. See `vector.go` for the format and the measurements.

### SourceFrontier: a plain read, not a transaction step

Derives every source's frontier — the source-tier nodes that are no source-tier
node's member, plus the windows that are no source-tier node's member.
Corpus-tier membership is ignored, because the frontier is intrinsic to the
source lattices and the corpus tier is built *from* it.

It is a plain read rather than a step inside a write transaction precisely
because its consumer clusters outside one. The `(dirty, built)` pair, not a lock,
is what makes that safe.

### DeleteSource: remove a source by origin and rebuild from what remains

The mirror of `ReplaceSources` without the insert half. It resolves the origin to
a `local_ref_id` inside the transaction, runs the same four deletes, and rebuilds
the corpus. An unknown origin returns `false` with nothing committed, so deletion
is idempotent.

### rebuildCorpusTx: recompute the corpus tier inside a transaction

Shared tail of both writers: compute the frontier, hand it to `rebuildCorpus`,
delete the old corpus nodes (`local_ref_id = ''`) and their edges, insert the
returned ones. Because both callers route through it, the corpus tier is always a
pure function of the committed source lattices.

### sourceFrontierTx: the frontier intrinsic to the source lattices

Computes what the corpus tier is built over: source-tier nodes that no
*source-tier* node claims as a member, then windows no source-tier node claims.
The `local_ref_id != ''` qualifier on the parent is the key detail — corpus
membership is ignored, so the frontier does not depend on the corpus existing,
which is exactly what lets the corpus be discarded and recomputed. Both halves
are ordered by id for a deterministic rebuild input.

### insertWindows and insertNodes: the two row writers

`insertWindows` writes each window with its embedding JSON-encoded.
`insertNodes` writes each node (centroid encoded the same way) plus one
membership edge per member, using the slice index as the edge's `ordinal` so
member order survives the round trip. Every lattice write goes through these.

### Identities: each source's vector identity, without its text

A cheap project-wide read returning `local_ref_id → VectorIdentity`, for callers
that need identity vectors but not the (potentially large) source text.

### EntryFrontier: the retrieval entry points across both tiers

Every node and window in the project that is no node's member at *all* — corpus
roots, source roots the corpus tier did not absorb, and never-clustered orphan
windows. Dropping the `local_ref_id != ''` qualifier is what distinguishes it
from `sourceFrontierTx`: here corpus membership does hide a node, because a
caller entering at a corpus root reaches it by descending.

### inPlaceholders: the IN-clause placeholder builder

Builds `"?, ?, ..."` and the matching `[]any` args, so batch ids are always bound
as parameters rather than interpolated. Used by the three batch reads below.

### NodesByID: batch node fetch with ordered members

Two queries: the node rows, then their membership edges ordered by `parent_id,
ordinal`. An index built during the first pass maps node id to slice position so
the second pass appends members in stored order. Unknown ids are skipped rather
than treated as errors — a descent may hold stale ids.

### WindowsByID, ProjectWindows, SourceWindows and scanWindows: the window reads

Three shapes over one scan helper: by id (the descent's batch fetch), the
project's whole set (the exact-scan path, joined through `knowledge_sources` for
project scoping), and one source's windows (embedding reuse on re-ingest).
`scanWindows` decodes the shared column list, including the embedding JSON.

### ProjectChangedSince: staleness check performed in Go, not SQL

Reports whether any source was synced after `t`. The comparison cannot be pushed
into SQL: `synced_at` is stored as `time.RFC3339Nano`, which trims trailing
fractional zeros, so its lexical order is not chronological. Each value is parsed
and compared in Go instead, returning early on the first match.

### SourcesByRef: source text and blocks for a set of local refs

The materialization step after retrieval has chosen windows — batch-fetches full
snapshots keyed by `local_ref_id`, so region text can be sliced verbatim out of
the stored source. An empty input returns an empty (non-nil) map.

### The `label` column

`knowledge_sources` carries a `label` beside `source_id`, written on insert and
returned by both `SourceByOrigin` and `SourcesUnder`.

Returning it from `SourcesUnder` in particular is what makes this table the
registry: a connector re-syncing a folder knows its files only by path, and
recovers the id it minted for each one by matching that path against the labels
already stored here. Without it a second table would have to hold the same
mapping and be kept in step with this one.

### The window reads are deliberately split by what they load

Three shapes now, and the split is a cost decision rather than tidiness:

- `WindowsByID` and `ProjectWindows` load **vectors only**, through `scanWindows`.
  They serve ranking, descent and the exact scan — paths that handle a whole project
  or a whole candidate set. Loading text there would mean pulling the corpus's prose
  into memory in order to compare numbers.
- `SourceWindows` loads **text as well**, because the reuse map is keyed by it: a
  window's stored embedding is reusable exactly when its text is unchanged. It reads
  one source, so the cost is bounded by that source.
- `WindowContent` loads **text and blocks**, for a specific set of ids — the windows
  that reached an answer. It is the narrow read that replaced loading whole sources to
  slice regions out of them.

`insertWindows` writes both new columns; the legacy JSON embedding column is still
left empty rather than dual-written, for the reason it always was.
