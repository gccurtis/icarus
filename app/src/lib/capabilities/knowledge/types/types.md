# Knowledge Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`lattice-source.ts`](lattice-source.ts) | `latticeSourceValidator`, `LATTICE_SOURCE_KINDS`, `sourceKey` — what the lattice reads text out of |
| [`lattice-node.ts`](lattice-node.ts) | `latticeWindowValidator`, `LatticeNode`, `WindowPiece` — a window, and a cluster of them |
| [`lattice-version.ts`](lattice-version.ts) | `latticeStateValidator`, `LatticeVersion` — the index's own state |
| [`lattice-edge.ts`](lattice-edge.ts) | `LevelEdge`, `LatticeNeighbour` — the network inside a level |
| [`lattice-change.ts`](lattice-change.ts) | `latticeCauseValidator`, `latticeNodeSetValidator`, `LatticeChange` — why the lattice moved |
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

`similarity` is a full-dimensional dot product on both, and `threshold` is read
off the pool's own pairs on both. Only `adjacent` differs — and it differs only
in *reach*, so the two agree wherever the candidate search found every pair above
the threshold. Where it did not, the approximate path splits what the exact path
keeps whole; that is candidate recall, and
[`cluster.md`](../api/cluster/cluster.md) is where its bounds are stated.

## A `Region` names its source, and carries no label

[The process document](../../../../../../docs/processes/lattice-retrieval.md#regions)
gives a region a `sourceId` and a `label`. Here it holds the whole
`LatticeSource` instead, because a source in this system is a **kind and an id**:
the id alone decides admission, and the kind is what lets whatever quotes a
region open what it quoted.

**There is no label because nothing stores one.** `ingest` takes text and a
revision; the title belongs to the resource, and it is the resource's to render.
Emitting `document:abc` under the name "label" would be a lie in a field.

## An edge is a pair, and containment is not one

`members` and `parentId` are the tree; `LevelEdge` is the network *inside* a
level. Keeping them apart is what makes the structure queryable both ways
without a kind check on every traversal — descending is a field read, finding
neighbours is an indexed query. Containment as an edge kind would mean every
neighbour query filtering vertical edges out first.

**An edge's level is the generation it was computed at, and its endpoints need
not share it.** A window that found no home at level 0 is carried into every pool
above it, so a pass at level 3 can relate it to a level-2 cluster. The number
says *when the comparison happened*, which is also what the level index for that
same pass carries — one number files an edge and the geometry it was found
through together.

There is no `LatticeEdge` type here because nothing returns a bare edge. A
neighbour query answers with `LatticeNeighbour` — the *other* node — since one
row serves both ends and which column held which id is storage's business.

## A cause is what makes the lattice explicable

A `resource` cause carries the [change set](../../revisions/overview.md) revision
it followed, so a lattice state and a document state line up: *lattice version
214 reflects document revision 47*. The gap between a resource's current revision
and the one the lattice last indexed is then a subtraction. Without it you can
see the lattice is behind and not what it is behind.

The other four causes carry no such number, because a file, a finding, and a
connector sync follow no change-set sequence and a rebuild followed nothing at
all — it carries the reason it was ordered, in `rebuildReasonValidator`, the same
vocabulary the version row records a rebuild under.

**Added and removed, never modified**, and `unchanged` a count. A node's identity
is its content and its embedding together, so changed text is a different vector,
a different point in the index, a different node; calling it a modification would
imply the node survived the change. And a small edit to a large document leaves
most of its passages alone — listing thousands of ids to say "these were fine"
would make a change row larger than the change.

## `LatticeNode` is a returned shape, not a stored one

`_id`, `projectId`, and `_creationTime` are not on it. What a caller gets back is
the model; where it sits is `schema.ts`'s business, and keeping the two apart is
what stops a storage change from reaching the public contract.
