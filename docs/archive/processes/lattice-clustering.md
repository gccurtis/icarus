# Lattice clustering

How text becomes the [lattice](../data-models/knowledge/knowledge-lattice.md).
Ingestion, windowing, and the clustering that builds the layers
[retrieval](lattice-retrieval.md) descends.

Carried forward from the Taurus Omega knowledge runtime, which is the design this
should follow rather than reinvent.

## Ingest

1. Read the text, or stream it.
2. Compare the supplied revision against the source registry — unchanged sources
   are skipped entirely.
3. Window the text into overlapping spans.
4. **Reuse embeddings for content-addressed windows that match.** A window whose
   text is unchanged keeps its vector, so editing one paragraph re-embeds one
   paragraph.
5. Embed the changed windows in batches.
6. Replace the source's windows.
7. Rebuild the **source-tier** lattice for that source.
8. Repair or rebuild the **corpus tier**.
9. Persist the source record.

Step 4 is what makes editing affordable. Without content addressing, saving a
document re-embeds every window in it, and embedding is the expensive part.

## Two tiers

**Source tier** — each source builds its own forest of clusters over its own
windows. Source-tier nodes carry a `sourceId`.

**Corpus tier** — the source frontiers feed a second round that clusters across
sources. Corpus-tier nodes have no `sourceId` because they span several.

The split is what keeps ingestion cheap. Adding one document rebuilds that
document's forest and then *repairs* the corpus tier, rather than re-clustering
the project. Only the corpus tier has to reason about everything, and it operates
over source frontiers rather than raw windows — a far smaller pool.

## Clustering is overlapping maximal cliques

At each level, find maximal cliques of artifacts whose pairwise similarity is at
or above the level threshold. Cliques may overlap: an artifact can belong to more
than one cluster, which is why the structure is a lattice and not a tree.

Each node records:

- **`centroid`** — the unit-normalized mean of its members. This is what
  retrieval scores against, and it is why a poorly-scoring cluster can be skipped
  without opening it.
- **`count`** — how many members.
- **`cohesion`** — the *weakest* pairwise similarity inside the clique. A cluster
  is only as tight as its loosest pair, and averaging would hide exactly the case
  worth knowing about.

**Node IDs hash their sorted member IDs.** Identity is therefore independent of
member order and of when clustering ran — re-clustering that produces the same
grouping produces the same id, which is what lets repair recognize unchanged
clusters instead of churning them.

Window IDs and node IDs use distinct prefixes, so descent can tell an artifact's
type without a store lookup.

## The crossover: two clustering modes

This is the part that matters at scale, and it is chosen by **pool size**.

### Small pools — exact

For pools at or below `maxClusterPool`, build the full pairwise cosine
similarity matrix and cluster from it. Exact, simple, and quadratic — which is
fine when the pool is small and unacceptable when it is not.

### Large pools — PCA and IVF

Above the crossover, an approximate candidate graph is built instead:

1. **PCA projection.** Fit an orthonormal basis over the pool's dominant
   directions and project every vector into `pcaDims` dimensions.
2. **IVF cell assignment.** Cluster the projections into cells by k-means; each
   artifact lands in one.
3. **Candidate search.** For each artifact, search its own cell and the nearest
   `probeCells` neighbours — not the whole pool.
4. **Exact reranking.** Score the surviving candidates with **full-dimensional**
   dot products.
5. **Symmetric neighbour graph.** Keep the top `k` mutual edges.
6. **Maximal-clique clustering** over that graph.

**PCA guides candidate selection and nothing else.** Every similarity that is
stored, every edge weight, and every ranking decision uses the full embedding
dimensions. The projection decides *which pairs are worth comparing*; it never
decides how similar they are. That is the whole trick — approximation where it
buys asymptotics, exactness where it affects answers.

The basis is fitted by **uncentered** subspace iteration over a stride sample.
Uncentered because the basis is approximating dot products, not mean-centered
variance — subtracting the mean would optimize for the wrong quantity.

### Determinism

Projection and k-means seeds are fixed, sampling is by stride rather than at
random, and node ids hash their members. So the same ordered pool, the same
vectors, and the same configuration produce the same lattice every time.

That is not a nicety. A lattice that reshuffled on every rebuild would make
retrieval results irreproducible and repair impossible to reason about.

## Repair versus rebuild

After a source changes, the corpus tier is **repaired** when the damage is small
and **rebuilt** when it is not. Two bounds decide:

- `repairMaxFraction` — how much of the tier may be touched before a rebuild is
  cheaper than patching.
- `repairMaxDrift` — how far a centroid may move before its cluster is no longer
  meaningfully the same cluster.

Drift matters independently of fraction. A single member replaced by something
very different can invalidate a cluster's centroid entirely, and a
fraction-only rule would happily keep it.

## The stored level index

Each level persists an index used to accelerate both clustering and
[retrieval](lattice-retrieval.md#narrowing-the-frontier):

```ts
interface StoredLevelIndex {
  level: number;
  threshold: number;         // the similarity threshold used at this level
  k: number;                 // neighbours retained per artifact
  basis: number[][];         // the PCA basis
  centroids: number[][];     // IVF cell centroids
  artifacts: StoredArtifactEntry[];   // cell assignment + reranked edges
}
```

It is **derived**. Everything in it can be rebuilt from the persisted windows and
source metadata, so it can be dropped and regenerated without data loss — which
is what makes changing `pcaDims`, `k`, or the cell count a rebuild rather than a
migration.

Storing the threshold and `k` alongside the basis is what makes that safe: an
index built under different parameters is recognizable as stale rather than
silently mixed with one that is not.

## Configuration

```ts
interface KNNConfig {
  k: number;
  pcaDims: number;
  cells?: number;
  maxClusterPool: number;      // the exact/approximate crossover
  repairMaxFraction: number;
  repairMaxDrift: number;
}
```

All of it belongs in [`app/configuration/`](../../app/configuration/).
`maxClusterPool` is the most consequential: it is the point where exactness stops
being affordable, and it should be measured on real corpora rather than guessed.

## Related

[lattice retrieval](lattice-retrieval.md) ·
[knowledge lattice](../data-models/knowledge/knowledge-lattice.md) ·
[lattice version](../data-models/revisions/lattice-version.md)
