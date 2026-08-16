# Shared Knowledge Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`version.ts`](version.ts) | that a project has exactly one lattice version, and that its vectors all came from one model |
| [`mark-stale.ts`](mark-stale.ts) | that a cluster built from changed text is marked out of date, all the way up |
| [`digest.ts`](digest.ts) | that a window id and a node id are derived the same way, and are wide enough not to collide |
| [`level-index.ts`](level-index.ts) | that a level has one index, and that one fitted under other parameters is recognizable rather than used |
| [`ingest/ingest.ts`](ingest/ingest.ts) | that a source's level-0 nodes are exactly its current windows, and that an unchanged window keeps its vector |

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

## `level-index.ts` is here for the reader that has not been built

Clustering **writes** a level index and never reads one. The reader is descent,
which is not built yet, and that asymmetry is why the file sits in `shared/`
rather than under `cluster/`: it is the row's whole lifetime, not a step of the
clustering procedure.

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

## `markStale` walks `parentId`, not an edge table

Hierarchy is fields and edges are within a level, which is what makes the walk a
field read per level instead of an indexed query per level. It stops at a node in
another project — the parent chain is exactly where a stray write would cross the
boundary unnoticed.
