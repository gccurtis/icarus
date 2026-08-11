# 0141 — A neighbour graph instead of a matrix

Clustering reads the complete pairwise similarity matrix: n²·8 bytes and n²/2
dot products, independent of vector dimension. Record 0137 measured it — 458 MB
and 7.8 s at a pool of 4,000 — and at the 10k–100k-file target scale (a
frontier of maybe 200,000 artifacts) the same arithmetic says 320 GB and hours.
`max_pool` currently stops that by refusing to cluster at all, which means at
target scale there is permanently no corpus tier.

The escape is that clustering never needed the whole matrix. Clique members
must be pairwise similar, so every edge a clique can use sits near the top of
somebody's neighbour list. A k-nearest-neighbour graph is the matrix pruned to
what the clustering reads: ~100 MB of edges at 200,000 artifacts.

This record is the graph itself — `neighbors.go`, self-contained and tested.
Wiring it into the ascent is the next increment.

## The construction

IVF search over a low-dimensional projection:

1. **Fit** a d-dim orthonormal basis over the pool's dominant directions —
   uncentered PCA, subspace iteration on a sample of at most 1,000 vectors.
   Uncentered because the projection exists to approximate dot products, and it
   is the top singular subspace of the raw vectors, not the mean-centred ones,
   that preserves x·y best.
2. **Project** every vector. Projections are an index, never a stored
   similarity.
3. **k-means** the projections into ~√n cells.
4. **Per vertex**, score the members of its nearest 4 cells in projected space
   and keep the best 3k as a rerank pool.
5. **Rerank** the pool with full-dimension exact dot products; keep the top k.
6. **Symmetrize** by union: an edge survives if either endpoint ranked the
   other.

The invariant that makes this safe to trust: **approximation only decides which
pairs get looked at**. Every similarity in the graph is an exact full-dimension
dot product — the same number `pairwise` would have produced. A missed true
neighbour costs recall (a clique that fails to form); it cannot produce a wrong
similarity or a false edge. Measured on the clustered fixture, the graph
recovers **98.2%** of each vertex's exact top-k (`TestNeighborGraphRecall`).

## Cliques without the matrix

`maximalCliques` takes an n×n adjacency matrix — 40 GB of booleans at the
target scale, so the sparse path needed its own enumeration.
`maximalCliquesSparse` is Bron–Kerbosch with vertex ordering: each vertex seeds
one search over its own neighbourhood, with its earlier neighbours in the
exclusion set, so each clique is found exactly once, from its lowest member.
Work is bounded by neighbourhood size instead of pool size.

The set of maximal cliques of a graph is unique — no algorithmic freedom in the
answer — which makes the right test cheap and merciless:
`TestSparseCliquesMatchDense` requires byte-identical output from both
implementations across random graphs from 5% to 80% density.

The same idea pins the whole level. With projection off, one cell, and k at
least the pool size, *nothing* is approximated — and the threshold sample below
the budget is every pair — so `TestSparseLevelMatchesExactWhenComplete`
requires `buildLevelSparse` to reproduce `buildLevel` exactly: same threshold,
same cliques. Where the paths overlap, there is one semantics.

## The threshold still means the same thing

The exact path draws its per-level threshold from the full off-diagonal
distribution. The sparse path samples that distribution — 200,000 random pairs,
exact dots — rather than drawing from the graph's own edges, which are the top
of the distribution by construction and would bias the percentile upward.
Below the sample budget every pair is used, so the estimate degrades to exact
precisely where exactness is affordable.

## Determinism is load-bearing

Node ids are content-addressed from member sets (record 0140), so a clustering
that is not a pure function of its inputs churns every id on every rebuild —
undoing that record silently. Hence: seeded xorshift generators behind named
constants, stride sampling, deterministic k-means init, empty cells keeping
their centroids, and index tie-breaks on every sort. `TestNeighborGraphDeterministic`
holds two builds byte-identical.

## What k costs

k caps cluster size: a clique is mutual, so no cluster can exceed the degree
its members are allowed. The plan accepts this deliberately — a clique of 500
means 500 artifacts all mutually similar above threshold, which is a
redundancy statement, not a structure retrieval needs at full size. Whether
k=32 costs real recall is a question for the live validation gate, not for
this record.

## Deliberately deferred

- **Persistence** (`knowledge_neighbors` table): nothing reads the graph back
  until incremental insert/remove exists. A table with no reader is not written
  ahead of one.
- **The wired ascent**: `ascend` still refuses over-bound pools. The switch —
  exact below `max_pool`, sparse above, behind `neighbors.enabled: false` —
  lands with the recall harness that justifies flipping it.
