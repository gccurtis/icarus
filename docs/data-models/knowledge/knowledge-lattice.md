# Knowledge lattice

The project's content read into overlapping windows, embedded, and clustered into
**levels** — each level a network whose nodes are clusters of the level below.

The fields here are thin for how much they carry, because almost everything about
the lattice is procedural. How nodes are produced is
[clustering](../../processes/lattice-clustering.md); how they are walked is
[retrieval](../../processes/lattice-retrieval.md).

```ts
interface LatticeNode {
  projectId: Id<"projects">;
  level: number;                       // 0 = windows read from sources
  tierSourceId?: string;               // set on source-tier nodes
  clustered: boolean;                  // has a parent yet
  windows: LatticeWindow[];
  text?: string;                       // level 0 only
  centroid: number[];                  // unit-normalized
  count?: number;                      // members, level > 0
  cohesion?: number;                   // weakest pairwise similarity in the clique
  tokens?: number;
  members?: Id<"latticeNodes">[];      // level > 0
  parentId?: Id<"latticeNodes">;
  staleAt?: number;
  updatedAt: number;
}

interface LatticeWindow {
  source: LatticeSource;
  start: number;                       // offset into the source's text
  end: number;
  density: number;                     // how many windows merged into this one
}

type LatticeSource =
  | { kind: "document"; id: Id<"documents"> }
  | { kind: "slides"; id: Id<"slideDecks"> }
  | { kind: "spreadsheet"; id: Id<"spreadsheets"> }
  | { kind: "externalFile"; id: Id<"externalFiles"> }
  | { kind: "finding"; id: Id<"findings"> };

interface LatticeEdge {
  projectId: Id<"projects">;
  level: number;
  fromId: Id<"latticeNodes">;
  toId: Id<"latticeNodes">;
  weight: number;                      // full-dimensional dot product
}

interface LatticeLevelIndex {
  projectId: Id<"projects">;
  level: number;
  threshold: number;                   // similarity threshold used at this level
  k: number;                           // neighbours retained per artifact
  basis: number[][];                   // PCA basis
  centroids: number[][];               // IVF cell centroids
  updatedAt: number;
}
```

## A node is a window, or a cluster of them

At **level 0** a node is one window of text — a span read out of a source,
overlapping its neighbours, embedded. One entry in `windows`, and it carries that
span's `text`.

At **level 1 and above** a node is a cluster of the level below, with its own
centroid, its own edges to its peers, and a `windows` list assembled from
everything underneath it.

Clustering runs on the previous level's nodes, not on the level-0 windows, so
level 2 clusters clusters. What emerges is a cascade of networks, each a coarser
view of the one below.

## Two tiers

`tierSourceId` marks a **source-tier** node — one clustering a single source's
windows. Corpus-tier nodes leave it absent, because they span several sources.

The split keeps ingestion affordable: adding a document rebuilds that document's
forest and then *repairs* the corpus tier, rather than re-clustering the project.
Only the corpus tier reasons about everything, and it does so over source
frontiers rather than raw windows.

## Centroid, count, cohesion

`centroid` is the unit-normalized mean of a node's members; at level 0 it is the
window's own embedding. Retrieval scores against it, which is what lets a
poorly-matching cluster be skipped without opening it.

`cohesion` is the **weakest** pairwise similarity inside the clique, not the
average. A cluster is only as tight as its loosest pair, and averaging hides
exactly the case worth knowing about — a tight core with something barely related
attached.

## Windows merge; density counts the merge

A cluster's `windows` is not a concatenation of its members'. Two windows join
into one when — and only when — they name the **same source** and their ranges
overlap. The joined window spans the union, and its `density` is the sum.

Density is what makes a cluster legible. All-density-1 windows scattered across
nine sources is a thin thematic link; one window of density 40 over a single
document is that document's argument, recognized as one thing. The number tells
them apart without re-reading text.

Windows from one source that do **not** overlap stay separate. A document
discussing a topic in two distant sections is two contributions, and collapsing
them would claim coverage of everything between.

## Not everything clusters, and that is load-bearing

A clustering pass leaves nodes behind. A window with no strong neighbours belongs
in no cluster, and forcing it into the nearest one would invent a relationship
the weights did not support.

`clustered` marks whether a node has found a parent. **The next pass clusters
every unclustered node, regardless of level** — not just what the last pass
produced. A level-3 cluster can absorb a level-0 window that never found a home,
because by then there is something for it to relate to that did not exist before.

That set is also [retrieval's entry
point](../../processes/lattice-retrieval.md#the-frontier) — the frontier is
exactly the unclustered nodes. So an orphan is not a loose end; it is a root, and
one index serves both readers.

It is a stored boolean rather than derived from `parentId` being absent because
it is an **index key**: `by_project_clustered` is asked at the start of every
pass and every query, and building the most frequent question on the absence of a
field makes it the most expensive one.

Whether a node is unclustered because clustering has not reached it or because it
has no neighbours is **not** stored. Both mean the same to retrieval — enter
here — and the distinction is a judgement the algorithm re-makes each pass.

## Hierarchy is fields; edges are within a level

`members` and `parentId` express the tree. `LatticeEdge` expresses the network
*inside* a level.

Keeping them separate makes the structure queryable both ways without a kind
check on every traversal: descending is a field read, finding neighbours is an
indexed edge query. Containment as an edge kind would mean every neighbour query
filtering out vertical edges.

Storing both `members` and `parentId` is redundant and safe here — the hierarchy
is written by one clustering pass rather than edited incrementally, so the two
sides cannot drift the way independently mutated lists would.

`weight` is a **full-dimensional** dot product, always. The PCA projection used
during clustering selects which pairs are worth comparing and never decides how
similar they are — see
[clustering](../../processes/lattice-clustering.md#large-pools--pca-and-ivf).

## The level index is derived

`LatticeLevelIndex` holds the PCA basis and IVF centroids for a level. It
accelerates both clustering and frontier narrowing, and everything in it is
rebuildable from the persisted windows.

Storing `threshold` and `k` beside the basis is what makes that safe: an index
built under different parameters is recognizable as stale rather than silently
mixed with one that is not.

## Text is stored once

`text` is present at level 0 and absent above; a cluster's text is recoverable
from its windows. Storing merged text at every level would duplicate the corpus
once per level, and a five-level lattice would hold six copies of the project.

## Nodes are derived, never authored

Every node is a projection of something else. Nothing is written into the lattice
directly and nothing is lost by rebuilding it — which is what makes it safe to
re-window, re-embed with a different model, or discard and regenerate.

## Every source is a resource kind

`LatticeSource` is a strict subset of
[`ResourceKind`](../special-resources/resource-set.md#every-lattice-source-is-a-resource-kind),
using the same kind strings. That is what makes scoping total: anything the
lattice indexes, a resource set can select.

Templates and connectors are resource kinds that are not sources — a template is
a skeleton, a connector is configuration.

**Messages are not indexed.** A conversation is working material, and indexing it
would fill retrieval with half-formed reasoning and abandoned turns. A message
worth keeping becomes a [finding](../research/finding.md) — the editorial act
worth indexing, which gives the content a title, sources, and a place in the
research graph that a raw turn does not have.

Questions and hypotheses are not indexed either. They are what the project does
not know; retrieving over them returns the asking rather than an answer.

## Staleness cascades upward

When a source changes, its level-0 nodes get `staleAt` set — and so does every
cluster above them, reached by `parentId`. A cluster built from a passage that no
longer exists is stale whether or not its own text changed.

Retrieval can still use stale nodes, marked as possibly out of date, while
re-embedding and re-clustering happen. A window where edited content is absent
from retrieval entirely is worse: a slightly stale answer beats a confidently
incomplete one.

## Index-wide state lives elsewhere

Which embedding model built the index, how many levels it has, and whether it is
mid-rebuild are on the [lattice
version](../revisions/lattice-version.md), one row per project. A per-node field
cannot express them, because the subject is the population.

Its history is the [lattice change](../revisions/lattice-change.md) log.

## What is not here

No retrieval receipts and no per-query logs. What a search returned is a property
of that search — it belongs on the [message's tool
calls](../core/message.md#research-steps-are-tool-calls).

## Related

[clustering](../../processes/lattice-clustering.md) ·
[retrieval](../../processes/lattice-retrieval.md) ·
[lattice version](../revisions/lattice-version.md) ·
[lattice change](../revisions/lattice-change.md) ·
[resource set](../special-resources/resource-set.md)
