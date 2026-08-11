# 0142 — Clustering over the neighbour graph

Record 0141 built the k-NN graph; this record wires it into the ascent. With
`knowledge.cluster.neighbors.enabled`, a pool larger than `max_pool` is
clustered over the graph instead of being refused — the ceiling on the lattice
(record 0134) stops being a ceiling. The flag ships **false**: the exact path
remains production until `dev-test/knowledge` shows retrieval quality holding,
the same gate `descent.enabled` passed through.

## The switch is per level, not per ascent

`ascend` decides exact-versus-sparse at each level, by the pool that level
actually has. A corpus frontier of 20,000 needs the sparse path for one level;
the ~1,000 representatives it collapses into do not, and get exactness for
free. Small projects never touch the sparse path at all, enabled or not —
`max_pool` is now the *crossover point* between the two constructions rather
than a wall.

The refusal semantics are preserved where they still apply. With the flag off,
nothing changes: over-bound pools are refused, `skipped` reports it, the logs
narrate it. The k-NN path is not the kind of approximation that refusal exists
to prevent (record 0134 argued no sample or partition may stand in for the
pool): every member participates, every kept similarity is exact, and only
candidate *discovery* is approximate — recall can fray at the margin, but no
artifact is silently excluded from the question.

## The recall harness

The load-bearing test is `TestSparseAscendRecoversExactClusters`: the same
clustered fixture ascended both ways, compared at level 1. Content-addressed
node ids (record 0140) make the comparison exact — a node is its member set,
so "the sparse path found the same cluster" is literally an id match, no
structural diffing.

Result on the fixture (1,200 vectors, 60 groups of 20, k=32):

    sparse path recovered 60 of 60 exact level-1 clusters (recall 1.000)

The harness asserts ≥ 0.9 so drift fails loudly, and re-runs the sparse ascent
to hold it deterministic end to end.

## Measured

`BenchmarkAscendSparse` beside `BenchmarkAscend` (dim 1536, single run):

| pool | exact | sparse |
|---|---|---|
| 4,000 | 8.13 s | 2.66 s |
| 20,000 | *(needs a 3.2 GB matrix; ~3.4 min extrapolated)* | 14.8 s |

The 4,000 row overlaps deliberately: even where the exact path is affordable,
the sparse one is ~3× faster — but exactness is worth more than 5 seconds
below the crossover, so the exact path keeps every pool it can hold.

## The regime where the paths diverge

> **Superseded by record 0143.** The regime below no longer degrades as this
> section predicts: the retry ladder was removed from the sparse path and the
> dense regime now switches to verified neighbourhood clusters, which
> reassemble one level up. Kept as written because the analysis of *why* the
> regime is hard is what motivated the fix.

A natural cluster **larger than k** cannot be one clique in a k-NN graph — k
caps cluster size by construction, a trade the plan accepts. But the failure
shape is worth recording precisely, because it is worse than "the cluster
splits in two":

Inside an over-k cluster, every member's neighbour list is a random-looking
subset of its peers, so the cluster's subgraph is *near-complete with holes* —
the worst case for maximal-clique enumeration (the count can grow
exponentially in the holes). The abort cap bounds the work, and the retry
ladder raises the threshold — but inside a near-uniform cluster the
similarities are tightly packed, so pruning by similarity removes edges almost
at random and can leave the graph in the explosive regime for all eight
attempts. A level that fails all eight yields nothing, and the ascent stops.

Small pools escape quickly (the ladder reaches a genuinely sparse regime);
very large pools with many over-k clusters may not. This is the first question
the live validation gate has to answer — real embedding clusters are not
uniform blobs, so the pathology may not occur in practice — and if it does,
the candidate fix is a degree-based final attempt (prune each vertex to its
tightest few edges) rather than more percentile raises. Not built now:
it would be new semantics invented ahead of a measurement.

The recall harness and the benchmark both size groups *below* k on purpose —
they measure the regime the design targets. The over-k regime is named here so
nobody mistakes its absence from the tests for its absence from the world.

## Configuration

```yaml
knowledge:
  cluster:
    max_pool: 4000        # the exact/sparse crossover once neighbors is on
    neighbors:
      enabled: false      # OFF until dev-test/knowledge validates it
      k: 32               # neighbours per artifact; caps cluster size
      cells: 0            # IVF cells; 0 derives sqrt(pool)
      pca_dims: 128       # 0 = default, negative disables projection
```

`pca_dims` reads three ranges (0 default, negative off) so "score candidates
at full dimension" is something configuration can say deliberately, the same
convention as `connectors.max_file_bytes`.
