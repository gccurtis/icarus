# API: `cluster`

One clustering pass over a project: each source's own forest, then the corpus
tier above their frontiers.

Registered as `api.capabilities.knowledge.cluster`, built from `projectMutation`.
It takes no argument at all — not even what changed. Damage is read off the
clusters, and the work queue is the stored `clustered: false` set.

## Procedure Tree

```text
cluster(ctx, scope)
├── readVersion()                    ../shared/version.ts
├── settle() per source tier, then the corpus tier   settle.ts
│   ├── assess()                     settle.ts
│   ├── needsRebuild()               settle.ts
│   ├── repair() / release()         settle.ts
│   │   ├── nodeId()                 node-id.ts
│   │   └── mergeWindows()           merge-windows.ts
│   └── grow()                       grow.ts
│       ├── clusterLevel()           level.ts
│       │   ├── exactRelation()      level.ts        ← at or below the crossover
│       │   │   └── similarityMatrix(), thresholdOf()   similarity.ts
│       │   ├── approximateRelation()   level.ts     ← above it
│       │   │   ├── candidateGraph()    candidates.ts
│       │   │   │   ├── fitProjection(), project()   projection.ts
│       │   │   │   │   └── orthonormalize(), seeded()   projection.ts, seeded.ts
│       │   │   │   └── cellCount(), assignCells()   cells.ts
│       │   │   └── thresholdBySample()   similarity.ts
│       │   └── levelOf()            level.ts
│       │       ├── maximalCliques() cliques.ts
│       │       ├── centroidOf(), cohesionOf()   similarity.ts
│       │       ├── nodeId()         node-id.ts
│       │       └── mergeWindows()   merge-windows.ts
│       └── writeLevelIndex()        ../shared/level-index.ts
└── advanceVersion()                 ../shared/version.ts
```

## The crossover, and what does *not* change at it

Pool size picks the path. At or below `maxClusterPool` every pair is compared;
above it, an IVF search over a PCA projection picks which pairs are worth
comparing at all.

**Everything else is the same on both sides.** Both score with full-dimensional
dot products, both read their threshold off the pool's own distribution through
the same function, and both find overlapping maximal cliques over the result.
That is why `levelOf` takes a `LevelRelation` rather than choosing one: the exact
path can be run over a pool the approximate one would have taken, and the two
compared for equality. It is the **known-correct oracle**, not a fallback.

**The projection guides candidate selection and nothing else.** Every similarity
stored, every edge weight, and every cohesion is a full-dimensional dot product.
The projection decides *which pairs are worth comparing*; it never decides how
similar they are — approximation where it buys asymptotics, exactness where it
affects answers.

**Which is why the threshold is sampled from the pool and never from the graph.**
Above the crossover there is no matrix to take a percentile over, and the
candidate graph's edges are the wrong substitute: they are each artifact's
strongest neighbours by construction, so a percentile over them measures how
similar *neighbours* are rather than how similar "related" has to be. Reading the
cutoff off the selection the projection made is the projection deciding
adjacency — the one thing it must not do. `thresholdBySample` scores a stride
sample of the pool's own pairs in full instead, at a cost constant in the pool,
and within the sample budget it *is* the exact path's threshold rather than near
it.

### Where the two paths agree, and the two bounds on it

Equality is a property of a pool the candidate search reaches whole, not an
unconditional one. Two bounds are worth stating rather than discovering:

- **A clique cannot be larger than the graph's degree.** Each artifact keeps its
  strongest `k` neighbours, so a group of more than about `k + 1` members can
  never come back as one clique, whatever the threshold. Raising `k` to chase it
  trades away the asymptotics the approximate path exists to buy.
- **Cell recall is its own concern.** An artifact probes `probeCells` cells; a
  neighbour that landed outside all of them is never scored, and the pair is not
  related. Losing a few within-group pairs splits a group the exact path keeps
  whole — the search working as designed, and the reason the equality test uses a
  pool whose groups it provably reaches whole.

Neither bound is a threshold problem, and neither is fixed by one.

**The basis is fitted uncentered**, over a stride sample, from a fixed seed. It
approximates dot products rather than mean-centred variance, and subtracting the
mean would optimize for the wrong quantity: a one-line difference that degrades
recall without failing anywhere.

A pair the candidate search never reached is **not related**, however close it
turns out to be — that is what makes the search worth doing. `similarity` still
answers exactly for such a pair, because measuring one is arithmetic and cheap;
`adjacent` does not, because comparing all of them is the cost being avoided.

## Determinism is the reason every seed is fixed

Projection and k-means seeds are constants, sampling is by stride rather than at
random, the pool is sorted by id before anything is grown, and node ids hash
their sorted members. So the same pool, the same vectors, and the same
configuration produce the same lattice every time.

Not a nicety: a lattice that reshuffled on every rebuild would make retrieval
irreproducible and repair impossible to reason about — a cluster whose id changed
for no reason looks exactly like one whose membership changed.

## Source tiers first, corpus tier last

The corpus tier is built out of the source frontiers, so settling it first would
cluster artifacts that are about to move. It is also why adding a document is
affordable: that document's forest is rebuilt and the corpus tier is *repaired*,
rather than the project being re-clustered.

A source-tier node names its source in `tierSourceId`. A corpus node names none,
because it spans several.

## Repair versus rebuild

`assess` measures one thing per cluster — how far its centroid is from the
centroid it would have if it were built now. That covers both ways a cluster goes
wrong, a member deleted and a member re-embedded, because both land in the same
place.

`repairMaxFraction` is the cost argument: past a point, rebuilding is cheaper
than patching what is left. `repairMaxDrift` is the correctness one, and it is
**independent** — one member replaced by something very different invalidates a
centroid entirely while touching almost nothing, and a fraction-only rule would
happily keep it.

**A rebuild re-derives the grouping, not the rows.** A cluster's identity is the
hash of its sorted member ids, so the rebuild releases the tier's clusters,
clusters the frontier again, and any clique naming the same members keeps its
row. Only what the new grouping never reached is deleted. Without that, every
rebuild would churn the whole tier and nothing downstream could tell a cluster
that changed from one that did not.

## What the pass deliberately does not do

**It does not find every node a home.** A node with no strong neighbour stays
`clustered: false`, because forcing it into the nearest cluster would invent a
relationship the weights did not support. That set is retrieval's frontier, so an
orphan is a root rather than a loose end.

**It does not restrict itself to the level it just built.** Every unclustered
node enters the next level regardless of when it was passed over, which is what
lets a deep cluster absorb a level-0 window that never found one — by then there
is something for it to relate to that did not exist before.
