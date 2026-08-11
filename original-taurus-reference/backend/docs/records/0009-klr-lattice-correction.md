# 0009 — KLR correction: clique lattice replaces the k-means tree

Record [0008](0008-knowledge-lattice-and-dev-convention.md) built the first
knowledge slice with a **k-means tree**: fixed branching (4), every window forced
into its least-bad cluster, every document collapsed to a single root. A design
review against the KLR specification found that to be a materially different
data structure from the intended lattice, on five critical points:

| Area | k-means tree (0008) | KLR |
| --- | --- | --- |
| Cluster formation | every artifact assigned to one of k buckets | only genuinely cohesive groups cluster |
| Cohesion | nearest-centroid assignment | **every pair** in a cluster clears a threshold |
| Membership | exactly one parent per level | clusters **overlap**; multiple parents (a DAG) |
| Outliers | absorbed into a least-bad bucket | stay **orphans**, carry upward unchanged |
| Topology | balanced tree ending in one root | **forest** of roots and orphans |

The distinction matters because the two answer different questions. K-means
answers *"given that everything must belong to one of k buckets, which is least
bad?"* KLR answers *"does a sufficiently cohesive semantic grouping actually
exist here?"* A document about three unrelated subjects should not acquire an
artificial vector claiming they form one theme — and a unique concept should
survive to the top as itself, not be averaged into noise.

This record replaces the construction. It was landed as a sequence of
increments — the clustering core and DAG storage first, then windowing, vector
identity, directed descent with a permanent exact-scan audit, grounded region
output, and lazy loading — each a self-contained commit (see the completion
boundary at the end).

## Scope decisions (with the review, plus owner calls)

- Only **add** and **retrieve** exist for now — incremental update/remove and any
  generation build/verify/promote machinery are out of scope; the lattice is
  retrieval + storage only.
- **Wholesale corpus recomputation stays**: rebuilding the cross-source tier on
  every add is the KLR default (the corpus pool stays small), not a defect.
- The exhaustive **exact scan is not deleted when descent lands** — it remains
  the production path until descent is calibrated, and the permanent recall
  audit after that.
- Multi-collaborator correctness: an add must be fully visible before the next
  lattice mutation (see the transaction note below).

## The clustering core — `core/capability/knowledge/lattice.go`

`buildLattice` (k-means) is gone. A level is now built from the **full pairwise
cosine matrix** of the current pool:

1. A **relative threshold** is drawn from the level's off-diagonal similarity
   distribution (default: 75th percentile, floored at 0.30). Level-relative
   beats a flat constant because within-document similarities run higher than
   cross-document ones.
2. Pairs clearing the threshold form a graph; the clusters are its **maximal
   cliques** (Bron–Kerbosch with pivoting, minimum size 2). Every pair inside a
   cluster qualifies — a chain A~B~C with A≁C is *two* clusters {A,B} and
   {B,C}, never one (that would be single linkage). Cliques may **overlap**, so
   one artifact can join several clusters.
3. A **level guard** bounds clique explosion: if a level yields more cliques
   than pool artifacts, the threshold is raised (percentile pushed toward 1)
   and the level re-run; if the guard never satisfies, the level yields no
   clusters, which terminates safely.
4. Each clique becomes a **representative node**: centroid = normalized sum of
   members, plus `Count` and `Cohesion` (the *weakest* pairwise similarity —
   the strictest tightness summary).
5. Representatives **and every orphan, unchanged,** promote to the next pool.
6. The ascent stops when **no clique forms** — not when one node remains — so a
   source ends as a **forest** of roots and orphans: its **frontier**.

A **progress guard** also stops the ascent if the pool fails to shrink
(overlapping pair-cliques can reproduce a same-size pool forever, e.g. a 4-cycle
threshold graph), and a depth backstop (32 levels) guards the pathological.
Everything is deterministic: fixed iteration order in Bron–Kerbosch, sorted
clique output, no randomness anywhere — the same input always builds the same
lattice.

## Model and storage — DAG, forest, memberships

`Node` now carries `Level`, `Count`, `Cohesion` and `MemberIDs`; `Root` and
`ChildIDs` are gone. Because cliques overlap, a member may appear under several
parents — the lattice is a **DAG**, persisted as a many-to-many
`knowledge_memberships(parent_id, member_id, ordinal)` table beside slimmed
`knowledge_nodes` (level, member_count, cohesion, centroid). The **frontier is
derived, not stored**: source-tier nodes that are no source-tier node's member,
plus windows that are no source-tier node's member.

The single-window special case died with the tree: a lone window is simply an
orphan on the frontier, no wrapper node.

An old-shape `knowledge_nodes` table (with `root`/`child_ids`) is **dropped**,
not migrated — the lattice is rebuildable projection state; sources and windows
are kept and the lattice rebuilds on the next add.

## The corpus tier is built from complete frontiers

`rebuildTop` fed the old corpus tier **one forced root per document** — exactly
the information KLR preserves inside a document was lost at the seam. The corpus
pool is now the **union of every source's complete frontier**: all roots *and*
all never-clustered orphan windows. An orphan that found no peers inside its own
document can find them in another. The corpus tier is clustered by the same
ascent (scoped by an empty `LocalRefID`), never mutates the source lattices, and
is itself a forest; if nothing clusters across sources there simply is no corpus
tier.

## One transaction per add — multi-collaborator safety

The old `Add` made two separate store calls (replace source, then rebuild top),
leaving a window where a concurrent add could read a stale frontier. The store
port is now narrower and atomic: `ReplaceSource(source, windows, nodes,
rebuildCorpus)` runs **one write transaction** that replaces the source's data,
computes every source's frontier *inside the transaction*, calls the (pure)
`rebuildCorpus` callback, and swaps the corpus tier. SQLite serializes writers
(immediate transactions), so concurrent adds queue, each corpus rebuild sees
every previously committed add, and — the collaborative requirement — one user's
add is fully visible before the next lattice mutation. No reader ever observes
the half-updated state between the two steps. `ReplaceTopNodes` and
`SourceRoots` disappeared from the port; clustering stays in the capability, the
store only orchestrates atomicity.

## Retrieval, for now

`Retrieve` is the **exact scan**, openly: embed the query, rank every window,
return top-k cited spans. The previous "beam descent" was exhaustive in effect
anyway (beam 8 over fan-out 4 pruned nothing); the honest baseline replaces the
disguised one. Directed best-first descent arrives in a later increment behind
configuration, with this exact scan kept alongside as the permanent recall
audit.

## Windowing: sentence-aware, ~1000-token windows, block addresses

The 400-rune mechanical windows were far below the KLR starting point (~1000
tokens) and cut mid-sentence, so an embedding could represent an incomplete
assertion. Windows now target **~4000 runes** (≈1000 tokens at ~4 runes/token —
no tokenizer dependency) and **cut on sentence boundaries**: a deterministic
splitter ends a sentence at terminator-plus-whitespace or at a newline (flatten
emits one block per line, so a newline is always a component boundary), windows
accumulate whole sentences up to the target, and each next window re-opens with
the previous window's trailing sentences within a ~400-rune overlap budget. A
pathological sentence longer than the target is hard-split on rune boundaries as
a fallback. Every cut still lands on a rune boundary, so spans always slice back
out of the snapshot.

Provenance deepened at the same time: `flatten` now returns a byte-range →
`(rowID, blockID)` map alongside the text, stored on the source
(`knowledge_sources.blocks`), and every retrieval hit carries the **origin
components its span touches** — real document addresses, not just offsets into a
disposable flattened string.

The calibration knobs went public as `knowledge.Options` (window target/overlap,
clustering percentile/floor), zero values taking the defaults; the composition
root passes defaults.

## Vector identity: embeddings carry the space they live in

A cast (`general/medium/medium/medium`) is a semantic alias, not a stable vector
identity — configuration can re-route it to another model at any time, after
which old source vectors and new query vectors would be silently compared across
incompatible spaces. Now:

- `intelligence.EmbedResult` reports the **provider and model** the cast
  resolved to;
- the knowledge `Embedder` port returns an `Embedded{Vectors, Usage, Identity}`
  where `VectorIdentity{Provider, Model, Dims}` names the space;
- every source is **stamped** with the identity it was embedded under
  (`knowledge_sources.identity`);
- `Retrieve` compares the query's identity against every source and **refuses
  with `ErrIdentityMismatch`** (HTTP 409, "re-add them to rebuild the lattice")
  rather than return garbage scores. A zero identity predates stamping and is
  grandfathered; re-adding a source re-stamps it and unblocks retrieval.

## Directed descent, behind configuration — with the exact scan as auditor

Retrieval gained the real lattice-descent path, off by default
(`knowledge.descent` in the manifest):

- **Entry frontier, derived**: descent starts from every artifact — either
  tier — that is no node's member: corpus roots, corpus-unabsorbed source
  roots, and never-clustered orphan windows.
- **Global best-first**: one priority queue over the whole descent (not
  per-node top-N), popping the most promising node anywhere in the lattice. A
  narrow beam (default 3) bounds how many node-children each expansion pushes,
  a high similarity threshold (default 0.35) gates both following and
  collecting, a visited set keeps the DAG's overlapping parents from
  re-expanding shared members, and a hard expansion backstop bounds the walk.
- **Fallback, not silence**: if the thresholds prune every path, retrieval
  falls back to the exact scan (`"mode":"exact-fallback"`) rather than return
  an empty answer the exact scan would have filled.
- **The audit is the point**: with `descent.audit` on, every retrieval also
  runs the exact scan and reports `{recall, candidates, windows}` — the
  fraction of the exact top-k descent recovered. Descent quality is measured
  on every query, never assumed; the exact scan is permanent, as production
  default and as auditor.

Every result now names its path (`"mode":"exact" | "descent" |
"exact-fallback"`). One audit nuance the live suite encodes: recall@k punishes
*correct* pruning when k exceeds the number of relevant windows (exact pads its
top-k with irrelevant hits descent rightly refused), so the strict `recall = 1`
assertion runs at `topK=1`.

## Grounded regions replace raw top-k windows

Raw window hits duplicated overlap (adjacent windows share trailing sentences)
and fragmented context. The output pipeline now continues past window ranking
(`regions.go`):

1. **Dedup** windows reached through multiple parents.
2. **Merge**, per source, every overlapping or touching retrieved span into one
   verbatim **region** — an exact contiguous slice of the snapshot.
3. **Density**: each region counts how many retrieved windows converged on it;
   **relevance** is its best covering window's score.
4. **Rank** by relevance, density breaking ties.
5. **Character budget** (`knowledge.retrieval.char_budget`, default 4000):
   regions admit in rank order under the budget, dense regions may overrun by a
   controlled quarter, and the top region is always admitted so a large best
   answer never yields an empty result.
6. Regions keep full provenance: source, byte range, and the (row, block)
   addresses the span touches.

`RetrieveResult.Hits` became `RetrieveResult.Regions`; the audit still compares
at the window level, before merging, so recall measures descent, not the merge.

## Lazy loading: descent reads only what it walks

`LoadProject` pulled the entire lattice — every node, every window, every
source's full text — into memory before descent, so retrieval stayed linear in
stored size no matter how narrow the walk. The store port is now a set of narrow
reads, and descent uses them incrementally:

- `Identities` — each source's vector identity, no text — for the mismatch check.
- `EntryFrontier` — the artifacts (either tier) that are no node's member.
- `NodesByID` / `WindowsByID` — batch fetches; descent expands one node at a
  time, loading that node's window members and node members in two reads per
  expansion, caching nodes as it goes. It never loads a branch it prunes.
- `SourcesByRef` — only the sources the final regions resolve against get their
  text loaded.
- `ProjectWindows` — every window, read **only** by the exact scan (production
  default, fallback, and audit oracle).

So descent-only retrieval now touches the frontier, the walked members, and a
handful of sources — not the whole project. The exact scan is still a full
window read by design; making *it* sublinear is a vector-index concern beyond
this slice. `RetrieveResult` is unchanged; the reorganization is entirely behind
the `Store` port (both the SQLite and in-memory stores implement the new
methods; `LoadProject` is gone).

## Tests

The clustering core is covered by unit tests pinning the KLR semantics: the
**chain-rejection** case (A~B~C without A~C must not merge — the clique/
single-linkage distinction), overlapping membership, orphan pass-through,
forest termination (no forced super-root over orthogonal groups), convergence on
cohesive input, the progress guard (4-cycle graph), determinism, and the
centroid being the normalized sum. Store tests cover the membership round-trip
and that the in-transaction frontier the rebuild callback sees is exactly the
roots plus orphans. Windowing tests pin the sentence splitter (full byte
coverage, newline boundaries, ellipsis runs), sentence-aligned window cuts with
progressing overlap, the oversized-sentence fallback, and rune-boundary safety;
a retrieval test proves hits carry the (row, block) addresses their spans touch.
Descent tests cover recall-vs-exact on a cohesive corpus and the exact-fallback
when thresholds prune everything; region tests cover overlap-merge with density
and character-budget admission; an identity test covers the mismatch refusal and
re-add recovery. The live `dev-test/knowledge` suite runs the whole path against
real embeddings with descent + audit on.

## Calibration

The live suite shrinks the window geometry (`target_runes: 200`) so its short
documents form several windows that cluster into real nodes — otherwise each
document is a single window and descent has nothing to walk. Under that setup,
with the **default** knobs (cluster percentile 0.75 / floor 0.30, descent beam 3
/ threshold 0.35), each document builds a 2–3 node forest, the cross-source
corpus tier forms, both topical queries land on the correct source, and
**descent recovers the exact scan's top hit (audited recall 1 at topK=1)**. The
defaults hold against `text-embedding-3-small`; the audit is wired to catch it
the moment a corpus or model makes them stop holding. One measurement nuance the
suite encodes: recall@k penalizes *correct* pruning when k exceeds the number of
truly relevant windows, so the strict assertion is at topK=1.

## Completion boundary

Delivered as increments (each its own commit, build/vet/test + verbatim + live
green): KLR clique clustering with the DAG store and atomic corpus rebuild;
sentence-aware ~1000-token windows with block addresses; vector identity;
directed descent with the permanent exact-scan audit; grounded region output;
and lazy loading. Deliberately out of scope, per the owner: incremental
update/remove of sources (only add + retrieve today), any generation
build/verify/promote machinery (the lattice is for retrieval and storage only),
a separate pure-vector subpackage, and an actual vector index that would make
the exact scan itself sublinear.
