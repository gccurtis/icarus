# Knowledge Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`lattice-source.ts`](lattice-source.ts) | `latticeSourceValidator`, `LATTICE_SOURCE_KINDS`, `sourceKey` — what the lattice reads text out of |
| [`lattice-node.ts`](lattice-node.ts) | `latticeWindowValidator`, `LatticeNode`, `WindowPiece` — a window, and a cluster of them |
| [`lattice-version.ts`](lattice-version.ts) | `latticeStateValidator`, `LatticeVersion` — the index's own state |
| [`clustering.ts`](clustering.ts) | `ClusterArtifact`, `ClusterShape`, `ClusterPass`, `LevelRelation` — what a clustering pass sees and what it reports |
| [`level-index.ts`](level-index.ts) | `LevelIndex`, `CandidateFit` — the geometry a large level was clustered through |
| [`embedding.ts`](embedding.ts) | `Embedder`, `Embedding` — the one thing this capability cannot do itself |
| [`retrieval.ts`](retrieval.ts) | `ReachedWindow`, `Region`, `ScopeManifest`, `RetrievalRequest`, `Retrieval` — what a query gets back |

## `LatticeSource` is a strict subset of `ResourceKind`

Using the **same kind strings**, which is what makes scoping total: anything the
lattice indexes, a [resource set](../../resource-sets/overview.md) can select,
with no translation table between two vocabularies to drift apart.

A template is a skeleton and a connector is configuration, so neither is a
source — both are resource kinds all the same, which is what makes the subset
strict rather than equal. `LATTICE_SOURCE_KINDS` states the relation where the
compiler checks it; the runtime half, including *which* two kinds are outside it,
is asserted in `test/unit/types/lattice-source.test.ts` by reading both
validators rather than by writing the list down a second time.

## The embedder is injected, and carries what it is

`Embedder` is a function and nothing more — text in, vectors out. It is passed in
rather than imported because embedding is a network call and nothing here may
make one, and because no provider exists yet: today the only implementation is
the deterministic fake in `test/fixture.ts`.

`Embedding` wraps it with the binding name, the resolved model, and the width.
**Both the binding and the model, deliberately.** The binding is the
[intelligence](../../../../../../docs/processes/intelligence.md) key — `"embedding"`
— and the model is what that key pointed at. The key can be repointed at any time
and the lattice does not follow; comparing the two is exactly how a required
rebuild is detected. Carrying only the binding hides the drift, and only the
model loses the connection to the configuration that should be updated.

## Clustering sees artifacts, not rows

`ClusterArtifact` is an id, a level, a direction, and the spans underneath it —
deliberately not a stored row. Clustering is arithmetic over vectors, and keeping
the store's shape out of it is what lets one algorithm cluster the windows of a
single source and the frontiers of a whole corpus.

## A level is asked about pairs, not handed a matrix

`LevelRelation` is how clique-finding asks "are these two related, and how
strongly" — by position in the pool, with no matrix in sight. Below the crossover
the answers come from one; above it they come from a sparse candidate graph, and
the clique finder cannot tell.

That is what lets the two paths be **compared for equality** rather than for
resemblance: the exact relation can be built over a pool the approximate one
would have taken, and both run through the same code.

`similarity` is a full-dimensional dot product on both. Only `adjacent` differs.

## A `Region` names its source, and carries no label

[The process document](../../../../../../docs/processes/lattice-retrieval.md#regions)
gives a region a `sourceId` and a `label`. Here it holds the whole
`LatticeSource` instead, because a source in this system is a **kind and an id**:
the id alone decides admission, and the kind is what lets whatever quotes a
region open what it quoted.

**There is no label because nothing stores one.** `ingest` takes text and a
revision; the title belongs to the resource, and it is the resource's to render.
Emitting `document:abc` under the name "label" would be a lie in a field.

## `LatticeNode` is a returned shape, not a stored one

`_id`, `projectId`, and `_creationTime` are not on it. What a caller gets back is
the model; where it sits is `schema.ts`'s business, and keeping the two apart is
what stops a storage change from reaching the public contract.
