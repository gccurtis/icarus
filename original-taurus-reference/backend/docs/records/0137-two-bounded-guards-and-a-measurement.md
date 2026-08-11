# 0137 — Two bounded guards, and a measurement

Two fixes inside the clustering ascent, both behaviour-preserving, plus the
benchmark that turns the pool bound from a guess into a number.

These came out of an audit that started with six candidates. Two did not survive
checking and are recorded below so nobody re-proposes them.

## The explosion guard fired too late

`buildLevel` rejects a level whose clique count exceeds the pool size, then
raises the percentile and retries — up to eight times.

The check happened *after* `maximalCliques` returned. Bron–Kerbosch is worst-case
exponential, so a dense graph could enumerate for an unbounded time producing
cliques that were about to be discarded, and do it eight times over. Nothing in
the path had a time bound.

`maximalCliques` now takes a `limit` and abandons the search once it exceeds it,
with `buildLevel` passing `n`. The abort is checked on entry to each recursive
frame so the unwind is prompt rather than finishing each candidate loop.

**It cannot change an accepted answer.** `buildLevel` accepts only a count `<= n`,
so an accepted enumeration is by definition one that never reached the cap; only
rejected attempts short-circuit. The test uses a cocktail-party graph (every
vertex adjacent to all but its partner), which has exactly 2^(n/2) maximal
cliques — 1024 at n=20 — and checks both that the cap aborts and that the
aborted result still exceeds `n`, so `buildLevel` reaches the same verdict the
full enumeration would have.

## The threshold distribution was rebuilt eight times

`relativeThreshold` collected every off-diagonal similarity into a fresh slice,
sorted it, and read one value out. `buildLevel` called it once per attempt
against an **unchanged** matrix, and the percentile only ever rises — so all
eight attempts were reading different indices of an identical sorted slice.

Split into `sortedOffDiagonal` (built once, preallocated to `n(n-1)/2`) and
`percentileOf` (an index). `relativeThreshold` remains as their composition, so
its existing test still applies.

The slice is ~64MB at the 4,000 pool bound, built by unpreallocated `append` on
top of the 128MB matrix it copies from. Seven of the eight copies were waste, at
exactly the point where memory is the binding constraint.

Sorting once and indexing beats a quickselect per query here — quickselect would
win only if the distribution were consulted once.

## The measurement

`BenchmarkAscend` / `BenchmarkBuildLevel` / `BenchmarkPairwise`, at 1536
dimensions:

| pool | ascend | allocated |
|---|---|---|
| 100 | 3.7 ms | 0.5 MB |
| 500 | 96 ms | 7 MB |
| 2,000 | 1.73 s | 110 MB |
| 4,000 | 7.80 s | 458 MB |

Two things this settles.

**`max_pool: 4000` costs ~8 seconds and ~458MB per rebuild.** The memory is what
the bound exists for, but the time is spent holding a write transaction, which
serializes every other write in that project for its duration. The default is
kept, and the measured cost is now in the manifest comment so the trade is
visible rather than implied. Lower it where write concurrency matters more than
corpus reach; the cost is quadratic, so 2,000 is about a quarter of the bill.

**`pairwise` dominates.** At n=2000 it is 1.60s of the 1.73s total — `buildLevel`
is 196ms. So neither fix above changes the shape of the curve, and no
optimization of the clustering *logic* can: the floor is F²/2 dot products and an
F² matrix. That is the direct argument for the deferred work — the fix has to be
a graph that is not complete, not a faster complete graph.

### The fixture had to cluster

Uniform random high-dimensional vectors are very nearly orthogonal, so nothing
clears the threshold, the graph is sparse, clique enumeration stays trivial, and
the benchmark reports a number unrelated to real embeddings. `clusteredVectors`
builds tight groups instead, and `TestClusteredVectorsActuallyCluster` asserts
the within/between separation so the benchmark cannot quietly start measuring the
wrong thing.

The first attempt got this wrong in an instructive way: a fixed absolute
perturbation (0.08) is larger than a unit vector's own components at any real
dimension (~1/√1536 ≈ 0.026), so it drowned the centre and produced exactly the
non-clustering fixture the test exists to catch. The perturbation now scales as
1/√dim.

## Two candidates that did not survive checking

Recorded so they are not proposed again:

- **`pairwise`'s matrix is not waste.** It looks like an obvious allocation to
  remove, but `thresholdGraph` re-reads every pair on each of up to eight
  attempts and `cohesion` reads it per clique. Recomputing instead would cost
  ~19 billion multiply-adds per attempt at n=5,000. It is a cache, and it is
  earning its keep.
- **`knowledge_memberships` is not missing an index.** `PRIMARY KEY (parent_id,
  ordinal)` gives SQLite an auto-index with `parent_id` leftmost, which already
  covers every `DELETE ... WHERE parent_id IN (...)`.

## Still deferred

Bitsets in Bron–Kerbosch (`neighborCount` is O(|p|) per candidate per frame) —
real, but a risky rewrite of correctness-critical code, and the abort cap now
bounds the pathological case it would most help. And the float32/BLOB vector
storage, which belongs with the retrieval-at-scale work.
