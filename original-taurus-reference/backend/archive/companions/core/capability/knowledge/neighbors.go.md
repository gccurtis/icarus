# neighbors.go

`neighbors.go` is the sparse half of the clustering machinery: it builds, for
each artifact in a pool, the k most similar peers — with **exact**
similarities — without ever materializing the complete pairwise matrix that
[`lattice.go`](lattice.go.md)'s `pairwise` builds. The KLR rule itself
(threshold, maximal cliques, orphans carry upward) is untouched; this file only
changes *which pairs get looked at*.

The complete matrix is the scaling wall. It costs n²·8 bytes and n²/2 dot
products regardless of vector dimension — measured at 458 MB and 7.8 s for a
pool of 4,000 (record 0137), which extrapolates to 320 GB and hours at the
200,000-artifact target scale. The k-NN graph is the same information pruned to
what clustering actually reads: clique members must be pairwise similar, so
every edge a clique needs sits near the top of somebody's neighbour list. At
200,000 artifacts the graph is ~100 MB of edges.

**The one invariant to hold onto:** approximation only ever decides *which*
candidates get considered. Every similarity that survives into the graph is an
exact full-dimension dot product — the same number `pairwise` would have
produced for that pair. A missed true neighbour costs recall (a clique that
fails to form); it can never produce a wrong similarity or a false edge.

The whole file is deterministic — fixed seeds, stride sampling, total-order
tie-breaks, no clock, no global rand. This is load-bearing, not hygiene: node
ids are content-addressed from member sets (record 0140), so a clustering that
is not a pure function of its inputs would churn every id on every rebuild.

## Code breakdown

### `knnConfig` — the sparse path's knobs

Carried on `clusterConfig`. There is no on/off switch: any pool over the
`maxPool` crossover clusters sparsely, and comparisons between constructions
live in tests or across git history, not in configuration. `k` is
neighbours kept per artifact, and doubles as the cluster-size cap: a clique is
mutual, so no cluster can exceed the degree its members are allowed. That trade
is accepted deliberately — hundreds of artifacts all pairwise-similar above
threshold is a redundancy statement, not a structure retrieval needs at full
size. `cells` is the IVF cell count (0 derives √n); `pcaDims` the projection
dimension for candidate generation (0 disables projection).
`repairMaxFraction` and `repairMaxDrift` bound the local-repair path — the
changed fraction a stored index may absorb, and how far the pinned threshold
may stray before a consolidation is forced; the decision itself lives in
[`repair.go`](repair.go.md).

### `xorshift` — determinism as a type

A tiny xorshift64 generator. It exists so that nothing in this file can reach
for global rand: every random draw is from a seeded generator whose seed is a
named constant, so two builds over the same pool are byte-identical.

### `fitProjection` / `orthonormalize` / `project` — the candidate lens

Uncentered PCA by subspace iteration on a stride sample (at most
`projectionSampleMax` vectors, `projectionIterations` rounds). Uncentered is a
choice, not an omission: the projection exists to approximate **dot products**,
and it is the top singular subspace of the raw vectors — not of the
mean-centred ones — that preserves x·y best.

The iteration computes z_j = Σᵢ xᵢ·(xᵢ·q_j), which applies XᵀX without forming
it (sample·dim·d work instead of sample·dim²), then re-orthonormalizes by
modified Gram–Schmidt. A row that collapses to zero norm — the sample had less
rank than the dimensions asked for — is re-seeded from the generator and
re-orthogonalized, so the basis always comes back full and still
deterministic.

`fitProjection` returns nil when the pool's dimension is already at or below
`d`, and nil consistently means "no projection" downstream.

### `kmeansCells` — the IVF coarse quantizer

Plain Lloyd's over the projected vectors, bounded by `kmeansIterations` with
early exit once no assignment moves. Initialization is a deterministic stride
over the pool; an empty cell keeps its previous centroid rather than being
re-seeded, which keeps the run reproducible. Quantization quality only shifts
which candidates are found — a mediocre clustering here costs recall, never
correctness.

### `buildNeighborGraph` — candidates, exact rerank, symmetrize

The orchestration. Fit and project, quantize into cells, then per vertex:

1. rank cells by centroid distance and take the nearest `probeCells` (own cell
   included by construction — its centroid is nearest or nearly so);
2. score every member of those cells **in projected space**;
3. keep a rerank pool of the best `3·k` — wide enough that projection error
   rarely evicts a true neighbour before exact scoring can save it, narrow
   enough that full-dimension work stays a rounding error;
4. re-score the pool with **full-dimension exact** dot products and keep the
   top k.

Ties everywhere break by index, so the build is a total order rather than a
coin flip. When there is no basis (`pcaDims: 0`) the candidate scores already
are exact and the rerank pass is skipped.

Symmetrization is by **union**: an edge survives if either endpoint ranked the
other in its top k. A miss by one endpoint's candidate search should not need a
second miss to be forgiven. The union also means `k` bounds *outbound* degree,
not total degree — a vertex many others point at carries their edges too.
Implementation-wise, both directions collapse onto (low, high) pairs, are
deduped after a sort, and each surviving edge is scattered to both endpoints,
so the two directions of an edge always carry the identical similarity.

### `sampledSims` — the threshold distribution without the matrix

The exact path draws its per-level threshold from the full off-diagonal
similarity distribution (`sortedOffDiagonal`). The sparse path samples that
distribution instead: `thresholdSampleBudget` random pairs, exact dots,
sorted. A pool with no more pairs than the budget contributes *every* pair —
so small pools read the very distribution the exact path uses, which is what
lets a test pin the two paths to identical output. Above the budget the
percentile is an estimate, and at 200,000 samples a tight one.

### `thresholdNeighbors` — the sparse threshold graph

Prunes the graph to edges clearing the threshold, as sorted adjacency lists —
the sparse analogue of `thresholdGraph`. Both directions of an edge carry the
identical similarity, so they pass or fail together and the pruned graph stays
symmetric.

### `maximalCliquesSparse` — the dense enumeration, without the matrix

Same contract, same canonical output, same abort cap as `maximalCliques`; the
difference is representation. The outer loop is Bron–Kerbosch with vertex
ordering: each vertex v seeds one search over its own neighbourhood, with v's
earlier neighbours in the exclusion set, so every clique is found exactly once
— from its lowest-indexed member. Inside a neighbourhood the recursion is the
same pivoting search the dense version runs, over sorted-slice intersections
instead of matrix rows.

The ordering matters for cost, not correctness: the dense version's own outer
recursion rebuilds near-pool-length candidate sets pool-many times, which is
quadratic in the pool even when the graph is sparse. Seeding per vertex bounds
all work by neighbourhood size.

`TestSparseCliquesMatchDense` holds the two implementations to identical
output across random graphs of varying density — the set of maximal cliques is
unique, so any disagreement is a bug in one of them.

### `levelIndex` — the level's k-NN structure as a value

Everything a repair needs to treat a later write as a **local event** instead
of a global rebuild: the edges, the pinned threshold, and the machinery that
placed them (the projection basis and the IVF cells). The vectors themselves
are deliberately not part of it — they belong to the pool, and every method
that needs them takes them alongside, aligned by position.

Positions are append-only: an insert appends, a removal tombstones (`live`
false, edges emptied). Consolidation — a fresh `buildLevelIndex` — is what
compacts. `buildIndexCore` is the full construction keeping every
intermediate; `buildNeighborGraph` is now a thin wrapper over it returning
just the edges.

The **threshold is pinned**: drawn from the pool's pair distribution at build
time and deliberately not redrawn on repair, because a redraw is a global
event. Bounded drift is the price of locality, and `drift()` measures it — a
repair re-samples the current distribution (~0.15s) and reports how far the
pin has strayed, which is what decides when a consolidation is due.

### `insert`, `remove` — the local events

`insert` assigns the new artifact a cell through the stored basis and
centroids (cell selection via `nearestCells`, the same helper the retrieval
probe uses to place a query), scores it **exactly** against the live members
of its nearest cells, keeps the top k, and stitches edges both ways. There is no projected
pre-score and no rerank pool on this path: the pre-score exists in the full
build to cheapen an n×candidates term, and one insert's candidates are a
couple of million multiplies — skipping the approximation also removes a whole
class of divergence from the fresh-build result.

`remove` tombstones the vertex and strips its edges from both directions.
Neighbours do *not* backfill the lost edge with their next-best candidate —
bounded degradation, healed by the next consolidation.

`TestRepairedIndexMatchesRebuilt` is the gate for both: an index maintained
through a re-sync-shaped batch (50 removals, 100 inserts against a 700-pool)
must match a full rebuild over the same final pool. In the target regime the
agreement is total — thresholded edge-set Jaccard 1.0, identical clusters,
deterministic across re-runs. Below-threshold spare slots are excluded from
the comparison: clustering never reads them, and the two constructions
legitimately fill them differently.

### `buildLevelSparse` — one clustering pass, sparse

The sparse analogue of `buildLevel`, with one deliberate difference: **no
percentile-raising retry ladder**. The ladder exists in `buildLevel` because
the dense path has no other answer to a graph whose cliques explode — raising
the threshold was the only lever. But the regime that explodes a k-NN graph is
a natural cluster *larger than k*, whose subgraph is near-complete with holes,
and there the ladder is actively harmful: similarities inside such a cluster
are tightly packed, so a raised threshold prunes its edges nearly at random
and the accepted result is confetti — tiny cliques, mass orphans — that looks
identical at the next level and never converges
(`TestOverKClustersReassembleUpTheLattice` measured best-node F1 of 0.077
under the ladder).

So the sparse path makes one attempt at the base threshold — the regime where
its semantics match the exact path bit for bit — and when that explodes it
switches *construction* instead of threshold.

### `greedyNeighborhoodClusters` — the dense-regime construction

The answer to "the cluster is bigger than k". A raw top-k neighbourhood is
star-shaped — everything similar to the seed, not necessarily to each other —
so the construction verifies as it grows: vertices are processed in ascending
order, each unclaimed vertex grows a cluster through its strongest neighbours,
and a member is admitted only if it clears the threshold against **every**
member already admitted (exact dots; a neighbourhood is at most degree-sized,
so this is k² work). An emitted cluster therefore carries the same guarantee a
clique does — all pairs mutually similar above threshold — and what is given
up is maximality and overlap, which is exactly the part that explodes.

The k-cap fragmentation this produces heals one level up: a cluster of 100
shatters into a handful of degree-sized fragments whose centroids are
near-identical, so the next level cliques them straight back together. The
reassembly test holds that to a number — groups of 100 under k=16 come back as
one node per group, F1 1.000.

### `cohesionVecs` — cohesion from vectors

`cohesion` reads the materialized matrix; the sparse path has none. Cliques
are small — bounded by the graph's degree — so re-computing the handful of dot
products directly from the vectors costs less than the matrix ever could.

## What is deliberately not here

**Persistence.** The `levelIndex` is a pure value; the tables that store it
and the repair-aware rebuild that reads it back live with the corpus machinery
(the "local events + consolidations" plan), not here. This file owns the
constructions; the store owns their durability.
