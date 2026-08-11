# descent.go

`descent.go` is directed lattice descent: the best-first walk from the entry
frontier toward a query vector, and the small max-first priority queue it pops
from. It is the pruned alternative to the exact scan — instead of scoring every
window in the project, it follows the cluster hierarchy toward the query and
scores only what it reaches.

It is called from [`retrieve.go`](retrieve.go.md), unconditionally — descent
IS retrieval, and the exact scan survives as `RetrieveExact` (the reference
oracle tests hold descent to) and as the fallback. Because descent can
legitimately return nothing — the thresholds may prune every path — its caller
always keeps that exact-scan fallback, so an empty walk never becomes an empty
answer.

Three bounds keep the walk finite and cheap: the similarity threshold
(`descentThreshold`) decides what is worth following or collecting at all, the
beam (`descentBeam`) caps how many children of one node are pushed, and
`maxDescentExpansions` is a hard backstop on nodes expanded per query regardless
of the other two.

## Code breakdown

### descend — best-first walk from the entry frontier

The walk starts from the entry frontier, the artifacts of *either* tier that
are no node's member: corpus roots, corpus-unabsorbed source roots, and orphan
windows. Frontier entries are scored against the query and split by kind —
windows that clear the threshold are collected as candidates immediately (they
have no children to descend into), while nodes that clear it are pushed onto
the queue.

### entryFrontier — the probe, or the full scan

Where the entry set comes from. Presence of the index is the decision — there
is no flag. When a level-1 corpus index is stored
([`repair.go`](repair.go.md)), the query is projected through the index's
basis and only the nearest cells' members are loaded — plus everything the
index does not cover, because the probe may narrow the indexed mass (the
orphan bulk that makes a frontier large) but never hide corpus roots or
artifacts written since the index was stored. A project with no index — one
whose corpus clusters exactly, under the crossover — gets the full
`Store.EntryFrontier` scan, which at that size is both exact and cheap. The
audit measures the probe's recall delta like any other approximation here.

Node loading is incremental by design:

```go
// nodeByID caches the nodes we have loaded so far; it grows one expansion's
// worth of children at a time, never the whole lattice.
nodeByID := map[string]Node{}
```

Only the seed frontier nodes are fetched up front; every later node enters the
cache as a child of something actually expanded. This is the whole point of
descent — the store is never asked for the full node set.

The main loop pops the most promising node globally (not level by level), and
skips it if already visited. The visited set is load-bearing rather than
defensive: because cliques overlap, one member may appear under several parents,
so the lattice is a DAG and without it shared members would be re-expanded once
per parent.

Expanding a node is two batch reads. Members are a mix of windows and lower
nodes with no type tag, so the code probes windows first and treats whatever
`WindowsByID` did not return as node ids:

```go
var nodeMembers []string
for _, m := range n.MemberIDs {
	if !isWindow[m] {
		nodeMembers = append(nodeMembers, m)
	}
}
```

Window members clearing the threshold become candidates; node members clearing
it are sorted by score (id-tie-broken, so the walk is deterministic), truncated
to the beam, and pushed. Note that pruning happens twice over — a child must
clear the threshold *and* survive the beam — which is what keeps the queue from
growing with the lattice.

Candidate ids are accumulated in a set rather than a slice, since overlapping
parents can surface the same window more than once, and the windows are
materialized in one final batch read at the end.

### scoredID and scoreQueue — the max-first priority queue

A minimal binary heap over `(id, score)` pairs, ordered score-descending with an
id tie-break so pops are deterministic — the same ordering rule `descend` uses
for its beam selection, and the reason two runs over the same lattice produce
the same walk.

It is hand-rolled rather than built on `container/heap` because the interface
that package requires (`Len`, `Less`, `Swap`, `Push`, `Pop` with `any`) is more
ceremony and more boxing than a fixed-purpose heap of one concrete struct needs.

### len, less, push and pop — the heap operations

`push` appends and sifts the new item up while it out-ranks its parent; `pop`
takes the root, moves the last item into its place and sifts down, choosing the
better of the two children each step. Both are the textbook array-heap
implementations with parent `(i-1)/2` and children `2i+1`/`2i+2`. `pop` assumes
a non-empty queue, which holds because the only caller guards with
`pq.len() > 0`.
