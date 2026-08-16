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
│       └── clusterLevel()           level.ts
│           ├── thresholdOf(), centroidOf(), cohesionOf()   similarity.ts
│           ├── maximalCliques()     cliques.ts
│           ├── nodeId()             node-id.ts
│           └── mergeWindows()       merge-windows.ts
└── advanceVersion()                 ../shared/version.ts
```

## The exact path, and only the exact path

`clusterLevel` builds the **full pairwise matrix**. Quadratic, fine below
`maxClusterPool`, and unacceptable above it — which is what the approximate path
(PCA and IVF) exists to answer.

It is not a placeholder for that path. It is the **known-correct oracle** the
approximate one is measured against, and building both at once would mean
debugging a projection and a clustering algorithm simultaneously with nothing to
compare either to.

Two consequences are outstanding until that work lands: nothing here consults the
crossover, and a pass holds every vector it clusters in memory, which a large
project's mutation cannot afford.

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
