# Shared Knowledge Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`version.ts`](version.ts) | that a project has exactly one lattice version, and that its vectors all came from one model |
| [`mark-stale.ts`](mark-stale.ts) | that a cluster built from changed text is marked out of date, all the way up |
| [`digest.ts`](digest.ts) | that a window id and a node id are derived the same way, and are wide enough not to collide |
| [`level-index.ts`](level-index.ts) | that a level has one index, and that one fitted under other parameters is recognizable rather than used |
| [`edges.ts`](edges.ts) | that a pair is one row read from either end, and that no edge outlives the node it names |
| [`changes.ts`](changes.ts) | that the history explains without ever being needed to reconstruct, and stays inside its bound |
| [`ingest/ingest.ts`](ingest/ingest.ts) | that a source's level-0 nodes are exactly its current windows, and that an unchanged window keeps its vector |
| [`retrieve/retrieve.ts`](retrieve/retrieve.ts) | that a query with no good answer returns nothing, and that what does come back is the source's own words |

## `version.ts` is the single enforcement point

Convex has no unique index, so "one `latticeVersions` row per project" is an
invariant a mutation maintains. `ensureVersion` reads then inserts inside a
serializable transaction: a concurrent insert invalidates the read set and the
mutation re-runs against the row that won. No version field, no retry loop.

That only holds while there is **one** such path. A second place inserting
without the read breaks it in silence, which is why every writer comes through
here.

It also refuses rather than adopting a drifted binding. Mixing vectors from two
models does not degrade the answers, it makes the distances mean nothing.

## `ingest` — the procedure

```text
ingest(ctx, scope, request, embedding)
├── sourceRecord()                 ingest/ingest.ts   ← step 2, before any work
├── ensureVersion()                version.ts
├── windowText()                   ingest/window-text.ts
├── windowId() per window          ingest/window-id.ts
├── embedWindows()                 ingest/embed-windows.ts
├── markStale()                    mark-stale.ts
├── dropEdges() per window gone    edges.ts
└── advanceVersion()               version.ts
```

Each step exists to avoid work, and they are ordered so the cheapest refusal
comes first:

1. **The revision is compared before the text is windowed.** An unchanged source
   costs one indexed read — not a windowing pass and a hash of the corpus. That
   is what "unchanged sources are skipped entirely" means, and why
   `latticeSources` is a table rather than something derived from the nodes.
2. **Window ids are content-addressed over `(source, text)`**, so a window whose
   text is unchanged keeps its vector. Editing one paragraph re-embeds one
   paragraph. Without it, saving a document re-embeds every window in it, and
   embedding is the expensive part of all of this.
3. An unchanged window whose **offsets** moved is patched rather than re-embedded.
   The vector belongs to the text; the offsets belong to the source.

**Steps 7 and 8 — rebuilding the source tier and repairing the corpus tier — are
[`cluster`](../cluster/cluster.md), and they run after this rather than inside
it.** Ingestion leaves the lattice at level 0 with the changed source's clusters
marked stale, and the pass that follows is what answers those marks. Doing it
here would make `markStale` pointless and put a quadratic algorithm inside the
transaction that writes the windows.

## `retrieve` — the procedure

```text
retrieve(ctx, scope, request, embedding)
├── readVersion()                  version.ts        ← refuses another model's vectors
├── resolveScope()                 retrieve/scope-manifest.ts
├── embedding.embed([query])
├── frontier()                     retrieve/frontier.ts
├── descend()                      retrieve/descent.ts
├── ctx.db.get() per window        ← then dropped if the scope does not admit its source
├── assembleRegions()              retrieve/regions.ts
└── admit()                        retrieve/admit.ts
```

**It is here rather than in an `api/retrieve/` of its own for `ingest`'s reason.**
Embedding the query is a network call, so retrieval is the transactional half of
an action whose outer half is the intelligence capability, which does not exist
yet. A registration would have to fabricate an embedder or throw on every call.

**An empty descent returns an empty region list**, and nothing in the path scans
for a consolation answer. A query with no good answer says so, rather than
returning the least-bad passages in the project — those read as answers and are
not.

## Narrowing the frontier needs a row nothing writes

[The process document](../../../../../../../docs/processes/lattice-retrieval.md#narrowing-the-frontier)
has descent narrow the frontier through the stored level index: project the
query, find the nearest cells, score only the entries in them. **That is not
built, and the reason is structural rather than unfinished work.**

An IVF search needs the inverted lists — which cell each artifact is in.
`latticeLevelIndexes` holds the basis and the cell centroids and no assignments,
so the only way to place a frontier entry in a cell is to project it, and
projecting one entry costs `pcaDims` times what scoring it in full costs.
Narrowing that way is slower than not narrowing at all.

Storing the cell on each node would not fix it either, because **the frontier is
by definition the set no clustering pass has placed.** A pass assigns cells to
the pool it clusters, and everything it clusters stops being frontier; the
clusters it creates are the new frontier and were in no pool. Only the orphans
would carry a cell.

So the whole frontier is scored, which the process document already calls correct
rather than degraded below the crossover. Making it true above the crossover
needs a cell written at node creation — a projection per new cluster, amortized
over every query that follows — and that is a clustering change, not a retrieval
one.

## Scoped retrieval

A [resource set](../../../resource-sets/overview.md) expression resolves once,
into a set of admissible source ids, and **filtering happens after descent**.

**The source id is the authoritative membership key.** A kind guides resolution —
it says which table to walk, and a connector expands to the files it brought in —
and it is carried as provenance, but admission compares ids alone.

An absent scope, and one written as an empty selector, both search the whole
lattice. A scope that *resolved* to nothing does not: it names resources that are
gone or were never the caller's, and reading that as "no restriction" would
answer from the whole project exactly when the caller asked for the least.
`{ op: "project" }` is how the whole lattice is said positively, so nobody has to
write an empty scope to mean everything.

The manifest is what makes a scoped answer checkable. "Why was this not found" is
either "the source was not admissible" or "it was, and descent did not reach it",
and the manifest distinguishes them. Its digests are over the canonical input and
the canonical resolution; `resolvedAt` is in neither, so the same scope resolved
twice digests the same.

### The known limitation

**Descent is global, so a narrow scope can come back thin.** The expansion budget
is spent on globally stronger out-of-scope branches before in-scope material is
reached.

That is the deliberate price of **one lattice**. Scoping the descent itself means
a scope-shaped graph per scope, which is a lattice per scope, re-clustered over
overlapping content forever.

The process document records a mitigation — for scopes small enough to express as
an index filter, skip descent and vector-search the in-scope windows directly.
**It is an option and not a design, and it is deliberately not built here.** The
two have opposite cost profiles and choosing between them needs a measurement
nobody has made.

## `level-index.ts` is here for a reader that still cannot use it

Clustering **writes** a level index and never reads one. Descent, the reader it
was written for, cannot narrow the frontier with it for the reason above — so the
asymmetry stands, and it is why the file sits in `shared/` rather than under
`cluster/`: it is the row's whole lifetime, not a step of the clustering
procedure.

It is what makes "the index is derived" true rather than claimed — `clusterLevel`
takes no context and so *cannot* consult one, which is where the guarantee is
enforced. Dropping every row costs a refit and no lattice.

**A stored index whose parameters still hold is left alone.** The basis is by far
the largest row this capability writes, and rewriting it every pass to move a
timestamp costs far more than the timestamp is worth. A basis a little behind its
pool costs recall in candidate selection and nothing in the answers, because
every score is full-dimensional either way.

The row holds the basis, the cells, and the parameters — not the per-artifact
assignments and edges the
[process document](../../../../../../../docs/processes/lattice-clustering.md#the-stored-level-index)
draws inside the same structure. Those are edges, they belong to a table of their
own, and a single row holding every artifact's would grow without bound and could
not be read for one node.

## `edges.ts` — one row per pair, two indexes

A pair is stored once, with the columns assigned by id order rather than by which
end reported it, and read back through `by_from_level` or `by_to_level`. Two rows
per pair would double every write and let the two halves of one relationship
disagree; one row read from one index would answer differently depending on which
end happened to be written first.

**A pass re-derives its own generation and nothing else.** `writeEdges` clears
both columns for every node in the pool at that level before writing, because a
pair the pass no longer relates has to stop being an edge and there is no version
to compare against — the pass that just ran is the answer. Other levels are left
alone: each is its own network, not a correction of another.

**The clearing is what bounds pool size.** Its reads are empty ranges when
nothing was there, so a first pass costs seeks; a re-clustering pass reads what
it replaces, and a pool near `maxClusterPool` writes on the order of `pool × k`
edges in one transaction. That is the largest write this capability makes, and
it sits beside [the basis note](../../overview.md) as a bound the corpus decides
rather than something to fix in advance.

**`dropEdges` goes with every node deletion**, in `ingest` and in `settle` alike.
An edge outliving its endpoint hands back an id that reads as a node until
someone loads it, and a neighbour query has no way to notice that on its own.

## `changes.ts` — a history that explains and never reconstructs

`recordChange` writes one row per change, holding a node set per source it
touched, and reads the version rather than taking one: a change row is only
meaningful beside the lattice state it produced, and a caller that supplied the
number could supply the wrong one.

**Pruning is oldest-first and loses nothing.** The lattice can be rebuilt from
project content at any time, so a dropped row costs an explanation and never a
state — unlike a [resource snapshot](../../../revisions/overview.md), there is no
base to advance first. The read that finds what to drop is bounded by
`CHANGE_HISTORY` because this same function is what keeps the table under it.

**Nothing here calls it yet, for `ingest`'s reason.** A change is caused by
something outside the transaction — a document saved, a connector synced, a
rebuild ordered — and the half that knows which is the intelligence capability.
What this capability supplies is the two halves only it can know:
`ingest` returns the source's node set, and `cluster` returns `reclustered`.

## `markStale` walks `parentId`, not an edge table

Hierarchy is fields and edges are within a level, which is what makes the walk a
field read per level instead of an indexed query per level. It stops at a node in
another project — the parent chain is exactly where a stray write would cross the
boundary unnoticed.
