# build.go

`build.go` is the ingest half of the lattice — the only write path into the
store. It covers registering or re-syncing a source (snapshot, windowing,
embedding, KLR ascent into that source's own forest), removing one, and
rebuilding the corpus tier from every source's frontier after either operation.
The vocabulary it works in (`Source`, `Window`, `Node`, `FrontierEntry`, the
`Store` and `Embedder` ports) is defined in [`knowledge.go`](knowledge.go.md);
the windowing and clustering primitives it calls — `windowSpans`, `ascend`,
`normalize` — live in [`lattice.go`](lattice.go.md).

Two ideas dominate the file. The first is **incremental embedding**: a re-sync
re-embeds only the windows whose text actually changed, so appending to a
document costs the new tail and nothing else. The second is **transactional
corpus rebuild**: both write operations hand the store a callback instead of
doing the rebuild themselves, so the source change and the corpus rebuild land
in a single write transaction.

## Code breakdown

### `AddBatch` is the implementation; `Add` is one item

`Add` calls `AddBatch` with a single item and returns `results[0]`. One code
path, so the single and batched forms cannot drift.

Batching exists because both costs behind an add are **per call, not per
source**:

- **One embedding request.** Every pending source's changed windows are collected
  into a single `Embed`. Per-source, a connector's first sync over N files made N
  provider requests back to back — the shape a per-minute rate limit exists to
  stop. (`intelligence.Embed` chunks internally, so "one call" means one per
  `max_batch_inputs` windows, not one enormous request.)
- **One corpus rebuild.** The rebuild is O(F²) in the project's whole frontier,
  so per-source a 200-file sync paid for 200 project-scale rebuilds to arrive at a
  single final state.

The method runs in phases, and the phases are why `addPlan` exists at all: every
source must be windowed before any is embedded, and every source embedded before
any is clustered. A single-source `Add` could keep that state in locals; a batch
has to carry it per item.

1. **Plan.** Per item: read what is stored, drop the no-ops, window the text,
   build the reuse map, record which texts still need vectors.
2. **Embed.** One call for the whole batch (`embedPending`).
3. **Cluster.** Per item, mint window ids and ascend (`addPlan.cluster`).
4. **Commit.** One `ReplaceSources`, one corpus rebuild.

Results come back in item order, with skipped items filled in during phase 1 and
never written at all.

Ordering across phases 2 and 3 is the risk a batch introduces. Vectors are
scattered back by each plan's recorded positions, and a slip would attach
plausible vectors to the wrong source — a failure nothing downstream can detect,
because every vector is individually valid. The tests encode each source's
identity into its retrievable content for exactly this reason.

### `Add` — snapshot, window, embed, cluster, rebuild

The pipeline a single source moves through. It first looks up the origin: if it
already exists, the new snapshot inherits its `LocalRefID` and its original
`AddedAt`, so a re-sync updates in place rather than creating a second lattice
for the same document.

### The early-out — the pipeline that should not run at all

Before any of it, `Add` asks `unchangedFrom` whether re-adding would reproduce
what is already stored, and returns `AddResult{Source: prev, Skipped: true}` if
so.

This matters far more than it looks, because of who calls it. A connector's
`applySync` loops **every** file in its snapshot whenever *any* one of them
changes — there is no per-file fingerprint. Without the early-out, editing one
file in a 200-file connector re-windowed, re-minted every window id, re-ascended
and rebuilt the corpus tier 200 times, 199 of them producing exactly what was
already there.

It was also easy to miss, because the expensive part was already free: the reuse
map meant an unchanged source made no provider call and spent no tokens. The
embedding was spared and everything downstream of it was redone anyway.

`unchangedFrom` compares **content, not revision**. A connector passes its sync
sequence as the revision and bumps it every sync, so a revision comparison would
never match and the check would never fire for the caller it exists to serve.
Blocks are compared too: a document can be restructured into different blocks
that flatten to byte-identical text, and skipping that would leave stored spans
resolving against the previous structure — a citation pointing at the wrong place
is worse than one that cost a re-cluster.

The content comparison is by **hash**, against the source's stored
`ContentHash`, because the lattice no longer keeps the text to compare against —
and would not want to hold both copies in memory if it did. `ContentHash` is
sha256 rather than something cheaper for one reason: a collision here skips a
real change in silence, and at that width the case does not arise.

A source stored before the column existed carries an empty hash and so never
matches, which is the safe direction — it re-windows and re-clusters once,
spending no provider tokens because the reuse map keys on window text. The
migration backfills the hash from the old stored copy anyway, so the case does
not arise in practice; `ContentHash` and `CountLines` are exported precisely so
that backfill computes them the way ingest does.

`SyncedAt` is deliberately **not** advanced on a skip. Nothing changed, so
`ProjectChangedSince` should not report a change and dependent prompt blocks
should not re-resolve; leaving it alone fixes a spurious cascade rather than
causing one.

The text is split into overlapping window spans, each span's text is embedded
(via `planAdd`/`embedPending`, which reuse what they can), and the resulting
vectors are clustered by `ascend` into the source's own forest of nodes. The
empty-source case falls through cleanly: with no spans there is no embed call at
all, and the source is stored with zero windows and zero nodes.

The write is the interesting part:

```go
if err := k.store.ReplaceSources(writes); err != nil {
	return nil, err
}
k.queueCorpusRebuild(projectID)
```

The write no longer rebuilds the corpus tier. `ReplaceSources` drops it and marks
the project dirty; `queueCorpusRebuild` schedules the rebuild as a background job
(see `corpus.go`). An add therefore never waits on a project-scale clustering,
which is what previously made a slow rebuild freeze every other write in the
project.

There is no `SourceClusterSkipped` any more. A source with more windows than
the `max_pool` crossover clusters sparsely instead of being refused, so the
outcome the flag existed to report — a forest that silently was not built —
cannot happen.

### `planAdd` — reuse what did not change

This is the smart-update path, now the planning half of it. It builds two maps
from the previous source's windows, keyed on the text each window carries. Any
new window whose text hits them keeps its old vector — and its old **id** — for
free; the misses are recorded in `needIdx`/`needTexts` as this source's
contribution to the batch.

It also fills in the source record's `SizeBytes`, `LineCount` and `ContentHash`
from the incoming snapshot. This is the only place they are computed on the write
path, which is what keeps the number a listing reports and the identity the
early-out compares in agreement with the bytes that were actually windowed.

**Two maps, because the two things being reused have different rules.** A vector
is a pure function of its text and the model, so any number of new windows may
share one — `reuse` is a plain map. An id is a primary key, so each prior one may
be claimed at most once — `priorIDs` is a *queue* per text, popped as windows
claim it.

That distinction is what makes duplicate window text safe. Three identical
windows before and four now means three keep their ids and the fourth gets a
fresh one, while all four share the single embedding. Reusing ids by text alone
would hand the same id to all four, which is a primary-key collision and a
silently lost window.

### `embedPending` — one call, then scatter

Every pending plan's `needTexts` are concatenated into a single `Embed`, and the
vectors are scattered back by each plan's recorded positions. `normalize` is
applied on the way in, which is what lets similarity be a plain dot product
everywhere downstream.

The subtle case is an embedding-space change under a re-sync. If a plan reused
vectors and the call comes back stamped with a different identity, those reused
vectors are stale — they belong to the old space and are not comparable to the new
ones. Mixing the two does not fail loudly; it silently retrieves nothing, which is
the worst way for this to go wrong.

Those plans are collected into `restale` and re-embedded in full — again as one
batch, not one call each — under the new identity, with `reused` reset to 0 so
the reported counts stay an honest account of what was paid for.

### `shareUsage` — an attribution, not a measurement

The provider bills the *batch*, so no per-source token figure is a measurement
any more. `shareUsage` splits a batch's usage by each source's share of the
inputs.

It is an approximation and worth naming as one. The alternative considered —
charging the whole batch to every source — would make a sync's reported cost
scale with the number of files rather than the tokens actually spent, which is
worse than an even split by a wide margin given `AGENTS.md` requires the price of
a run to be reported in full.

### RemoveResult and Remove — deletion with the same atomicity

`Remove` deletes a source and rebuilds the corpus tier from the remaining
frontier, using the identical callback shape as `Add` so the delete and the
rebuild share one transaction. Removing an origin that was never added is a
no-op reporting `Removed: false` — the caller maps that to a 404 rather than
having the service invent an error.

A removal invalidates the tier exactly as an add does — the frontier it was built
from is gone — so it drops it and schedules a rebuild the same way. Removing an
origin that was never there schedules nothing.

### The corpus tier moved out

The corpus tier is clustered by `buildCorpusIndexed`
([`repair.go`](repair.go.md)): the union of every source's frontier — all
roots plus all never-clustered orphan windows — ascended by the same KLR rule,
with persisted level indexes wherever a level runs sparse. An orphan that
found no peers inside its own source may find them there, in another source.
Corpus nodes carry an empty `LocalRefID`, which is how the tier is
distinguished from source-scoped nodes everywhere else. This file keeps only
the pointer comment; the fewer-than-two-entries guard travelled with the
code.

### sourceFrontier — deriving the frontier from nodes and windows

The frontier is never stored as a flag; it is computed. This helper collects the
member ids of every *source-tier* node, then returns the source-tier nodes that
appear in no member set, plus the windows that appear in no member set.

Corpus-tier membership is skipped deliberately (`if n.LocalRefID == "" { continue }`).
The frontier is intrinsic to the source lattices and the corpus tier is built
*from* it, so counting corpus membership would make the rebuild input depend on
the previous rebuild's output. `MemoryStore` calls this directly to produce the
`[]FrontierEntry` it hands to the `rebuildCorpus` callback; the SQLite store
computes the same thing inside its write transaction (`sourceFrontierTx`).

### Vector-count guards in `embedPending`

Both embedding paths check that the embedder returned one vector per text
before indexing by position. `intelligence.Embed` already enforces this at the
provider boundary, so these are defence in depth — but they are not
theoretical: a provider returned an empty vector list during a live run and
`normalize(emb.Vectors[j])` read off the end, panicking inside a connector
sync and surfacing to the caller as `500 Internal Server Error` with no clue
what happened. A provider hiccup must never crash the lattice, so the port's
contract is checked rather than trusted.

### `Add` carries the source's label

`Add` takes a `label` beside the `sourceID` and stores it on the `Source`. It is
the human name — a connector file's relative path, an attachment's filename —
and it exists because a composite source id is minted ids only and says nothing
recognisable.

Storing it here rather than deriving it later is what lets `SourcesUnder` answer
"which id did I mint for this path last time", which is how a connector re-sync
keeps a file's id stable instead of minting a new one and re-embedding every
window. Empty is normal for a document, whose id is already its caller-facing
identity.

### `cluster` writes each window's text and covered blocks

Alongside the id and the vector, every window is now written with its own text
(`p.texts[i]`, the exact slice the span was embedded from) and the block refs that
span covers.

Both come from the snapshot being written, in the same pass that produced the spans.
That is not incidental — it is what guarantees a window's text and its range can never
disagree, which is the invariant region stitching depends on.

### The reuse map is keyed on the window's own text

`planAdd` previously rebuilt each prior window's text by slicing the source's stored
copy, guarded by `w.End <= len(prev.Text)`. It now reads `w.Text` directly.

The guard is what the old shape cost: the reuse map depended on the range and the
stored copy agreeing, and any window whose range no longer fit was silently dropped
from it — which means its embedding was silently re-paid for. Reading the window's own
text removes both the guard and the failure mode.

The `prev.Text != ""` precondition also went, because it was asking the wrong
question: what matters is whether there are prior windows to reuse, not whether the
second copy of the source survived.

The two-map split is unchanged and still load-bearing: an id may be claimed once (it
is a primary key), a vector may be reused freely (it is a pure function of its text).

### `ContentHash` — the identity that replaced the second copy

Hex sha256 of a source's bytes. Exported for the same reason `CoveredBlocks` is:
the migration that fills the `content_hash` column in from the old stored text
has to produce the byte-identical answer this does. Two definitions would mean
every migrated source comparing as changed on its first sync and re-clustering
for nothing — a cost with no error attached to it.

Hex rather than raw bytes so it is safe to compare, log and store as text. Never
the empty string, so a stored empty hash unambiguously means "not yet
backfilled".
