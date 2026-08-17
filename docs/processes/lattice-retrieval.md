# Lattice retrieval

How a query becomes passages. Walks the structure
[clustering](lattice-clustering.md) built.

## The path

1. Embed the query.
2. Load the **corpus frontier**.
3. Use the [stored level index](#narrowing-the-frontier) to narrow frontier
   candidates, when one is available.
4. Run **best-first descent** with the configured beam, similarity threshold, and
   expansion limit.
5. Collect candidate window ids and their similarity scores.
6. Load the candidate windows.
7. Merge overlapping or touching windows from the same source into
   [regions](#regions).
8. Rank and admit regions under the character budget.

An empty descent returns an empty region list. **There is no fallback scan** — a
query with no good answer says so, rather than returning the least-bad passages
in the project, which read as answers and are not.

## The frontier

Descent enters through the corpus frontier: every artifact that no higher cluster
contains — top-level corpus nodes and orphan windows alike, since both are roots
and neither has a parent.

That is exactly the `clustered: false` set, which is also what the
[clustering pass](../data-models/knowledge/knowledge-lattice.md#not-everything-clusters-and-that-is-load-bearing)
treats as unfinished work. The same index serves both, and it is why orphans
staying reachable matters: an unclustered window is not a loose end, it is an
entry point.

## Narrowing the frontier

On a large corpus the frontier itself is big enough that scoring all of it is the
dominant cost. The [stored level index](lattice-clustering.md#the-stored-level-index)
is what avoids that: project the query into the level's PCA basis, find the
nearest IVF cells, and score only the frontier entries in them.

Same discipline as clustering — **the projection selects candidates, full
dimensions score them.** PCA narrows what is worth looking at and never decides
what is relevant.

When no index exists — a small corpus, or one not yet indexed — the whole
frontier is scored. That is correct rather than degraded: below the crossover,
scoring everything is cheaper than the machinery for avoiding it.

## Best-first descent

Repeatedly:

1. take the best `beam` candidates
2. drop any scoring below `threshold`
3. a **window** is terminal — record its best score
4. a **node** expands — load its members, score each against the query, insert
   them into the candidate queue

A node's `centroid` is what makes this work. It approximates its members, so a
cluster scoring poorly means everything beneath it scores poorly, and the branch
is never opened.

Cost is bounded by `beam × maxExpansions` — a fixed number of loads,
**independent of corpus size**. A corpus ten times larger costs the same query;
it has more levels, and each level is one more hop rather than one more scan.
That is the entire reason the hierarchy exists.

`beam` trades recall against cost directly. `maxExpansions` is the hard ceiling,
so a pathological graph cannot run away.

## Regions

What comes back is not the window list. Windows overlap by design, so returning
them raw returns the same sentences repeatedly and spends the budget on
duplicates.

Per source: sort reached windows by start offset, merge those that overlap **or
touch** into contiguous spans, and emit each as a region.

```ts
interface Region {
  sourceId: string;
  label: string;
  start: number;
  end: number;
  text: string;        // verbatim
  relevance: number;   // the best covering window's score
  density: number;     // how many retrieved windows cover the span
}
```

`relevance` is the best covering window's score, not an average — a span
containing one excellent passage should rank on that passage, and averaging
would punish it for the ordinary material merged alongside.

`density` counts retrieved windows covering the span. It is the retrieval-time
cousin of the [density on a cluster's
windows](../data-models/knowledge/knowledge-lattice.md#windows-merge-density-counts-the-merge):
both say "the corpus keeps returning here", one about clustering and one about
this query.

Region text is **verbatim**. No summarizing, no trimming to sentence boundaries —
whatever is quoted downstream must be what the source actually says.

## Admission

Sort by relevance, then density, and admit until the character budget is spent.

Density breaks ties for a reason. Two regions scoring alike are not equally
useful: one assembled from several overlapping windows is material the query kept
landing on, and one from a single window is a passing mention.

Two exceptions keep the budget from being perverse:

- **The top region is always admitted**, even if alone it exceeds the budget. A
  truncated best answer beats no answer.
- **Dense regions get a 25% overage.** A region of density 2 or more that just
  misses the cut is admitted anyway, because cutting substantial material to
  admit two thin ones is the wrong trade.

## Scoped retrieval

A [resource-set](../data-models/special-resources/resource-set.md) scope resolves
to a set of admissible source ids, and **filtering happens after descent**:

1. resolve the scope entries once
2. deduplicate and sort them canonically
3. build the admissible source id set
4. run normal descent
5. load the candidate windows
6. retain those whose source is admissible
7. assemble regions from what remains
8. return the scope manifest alongside the result

An absent or empty scope searches the whole lattice.

The source id is the authoritative membership key; entry kind guides resolution
and provenance but never decides admission.

### The known limitation

Descent is global, so a narrow scope can come back thin — the expansion budget
gets spent on globally stronger out-of-scope branches before in-scope material is
reached.

This is the deliberate price of **one lattice**. Scoping the descent itself means
a scope-shaped graph per scope, which is a lattice per scope, re-clustered over
overlapping content forever.

**An unproven mitigation, recorded as an option and not as design:** for scopes
small enough to express as an index filter, skip descent and vector-search the
in-scope windows directly. The two have opposite cost profiles — descent is
bounded by the corpus-independent budget and fails on narrow scopes; direct
search is proportional to scope size and fails on wide ones. Choosing by resolved
scope size rather than falling back after a thin result would avoid paying for
both. This was not in the original implementation and should be measured before
it is believed.

## The scope manifest

A scoped result carries the manifest it resolved against: the input entries, the
resolved entries, the admissible source ids, a digest of each, and the resolution
time.

It is what makes a scoped answer checkable. "Why was this not found" has an
answer — either the source was not admissible, or it was and descent did not
reach it, and the manifest is what distinguishes those two.

Digests are over the canonical entries and descriptors; `resolvedAt` is recorded
but not part of either digest, so an identical scope resolved twice produces
identical digests.

Nothing here is stored as its own record. A retrieval is a step in producing a
[message](../data-models/core/message.md#tool-calls-are-not-stored), and it
leaves no typed trace — what the turn says about what it found is the record.

## Configuration

`beam`, `threshold`, `maxExpansions`, `charBudget`, `topK`, and the frontier
narrowing parameters belong in [`app/configuration/`](../../app/configuration/).
Each trades recall against cost on a curve nobody can pick correctly in advance.

## Related

[lattice clustering](lattice-clustering.md) ·
[knowledge lattice](../data-models/knowledge/knowledge-lattice.md) ·
[resource set](../data-models/special-resources/resource-set.md)
