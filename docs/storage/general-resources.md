# General resources in Convex

A [document](../data-models/general-resources/document.md) is not a row. Neither
is a deck or a workbook. Each is spread across three tables, and this is what
each one holds and how they are read and written together.

The same shape serves all three, discriminated by `resourceType`.

## Why one snapshot table, not one per resource type

`resourceSnapshots` and `changeSets` are each **one table** covering documents,
decks, and workbooks, keyed by `(resourceType, resourceId)`.

Three of each is the obvious layout, and the reason not to is that the machinery
operating on them is **entirely generic**. An op says "set `sheets/0/cells/B7`"
and the code applying it never inspects the body — so replay, rebase,
consolidation, base advancement, and pruning are written once. Split across three
tables they become three copies of the most intricate logic in the system, and
three copies diverge.

**Type safety survives the sharing.** The usual objection is that a per-type
table validates its own body shape, and Convex validates a discriminated union
just as well: `body` is `v.union(documentBody, deckBody, sheetBody)` keyed on
`resourceType`. Per-type validation and one implementation, rather than a choice
between them.

Queries are unaffected. Every index leads with `projectId` and then the resource
pair, so `by_resource_revision((project, "document", id))` is exactly as
selective as a document-only table would be — Convex does not scan what an index
range excludes.

The genuine cost is that a reader has to know `resourceType` before they know
what `body` contains. That is one discriminant, in a table nobody reads casually.

## Do snapshots earn their place?

Yes, and the reasoning is worth following because the alternative sounds simpler
than it is.

Without a snapshot, reading a document means applying **every change set since it
was created**. That is fine on day one and ruinous on day four hundred: read cost
grows without bound, and it grows fastest for the documents people use most.

The snapshot is precisely the fix — it is *the change sets we already folded*,
materialized once so nobody folds them again. `leader` is "the most current
folded version", which is the same thing as "filter to the newest and apply what
came after". So the instinct that there might be a list you filter to the current
one and then apply the rest is the design; the snapshot is what that filtering
lands on.

`base` and `checkpoint` are the same trick applied to history rather than to the
present. Reconstructing revision 12,000 from a base at revision 0 is the same
unbounded replay, so a checkpoint every few thousand revisions bounds it.

The cost is one materialized body per anchor. That is small next to the cost of
replaying a year of edits on every open.

## The three tables

**`documents` / `slideDecks` / `spreadsheets`** — metadata only. Title, template
origin, creator, timestamps. Small, rarely written, and readable without touching
content. This is what a document list, a tab, a breadcrumb, and a search result
render from.

Notably **not** here: the body, and the revision number.

**`resourceSnapshots`** — materialized bodies at a revision, with a `role` of
`base`, `leader`, or `checkpoint`. One `leader` and one `base` per resource;
checkpoints optional.

**`changeSets`** — one row per accepted mutation, each holding the coalesced
operations, a `revision`, the `baseRevision` it was authored against, and a
`tier` of `recent` or `historical`.

## Reading the current body

Change sets from every resource in the project land in one table, interleaved in
insertion order. Reading one document must touch only that document's rows, and
the index is what guarantees it.

```ts
changeSets
  .index("by_resource_state", ["projectId", "resourceType", "resourceId", "tier", "revision"])
  .index("by_resource_revision", ["projectId", "resourceType", "resourceId", "revision"])
```

```text
leader = resourceSnapshots.by_resource_role(project, type, id, "leader")
sets   = changeSets.by_resource_state(q =>
           q.eq("projectId",    project)
            .eq("resourceType", type)
            .eq("resourceId",   id)
            .eq("tier",         "recent")
            .gt("revision",     leader.revision))
body   = apply(leader.body, sets)
```

### Why interleaving does not matter

A Convex index is a B-tree sorted by its field tuple, **not by insertion time**.
Equality on the leading fields plus a range on the one after them is one
contiguous scan over exactly the matching rows.

Rows belonging to other documents are not adjacent in that ordering, so they are
never visited — not scanned and discarded, never reached. Writes arriving
interleaved changes nothing, because insertion order is not the index order.

### The cost, concretely

| | Rows read |
| --- | --- |
| Resource metadata | 1 |
| Leader snapshot | 1 |
| Recent change sets | ≤ `consolidateAfter` |

Bounded at **`consolidateAfter + 2`**, currently 102. And bounded *independently*
of: how many documents the project has, how many total change sets exist, how
long this document has been edited, and how many other people are editing right
now. None of those appear in the cost.

A write is one insert. It does not touch the resource row, the snapshot, or any
other change set.

### Against the alternatives

| Layout | Read | Write |
| --- | --- | --- |
| Body on the resource row | 1 row, whole body | rewrite whole body |
| **Head + change sets** | **1 + 1 + ≤ 102 small rows** | **1 small insert** |
| Change sets indexed by time only | scan and filter — grows with the project | 1 small insert |
| Per-resource-type tables | identical to head + change sets | identical |

The first row is the one worth beating and the reason for all of this: a Convex
patch rewrites the entire document, so a 400 KB deck costs 400 KB of write per
keystroke batch.

The third row is what "interleaved" would actually cost without a compound index
— and it is the thing the index shape exists to prevent.

The fourth row shows splitting by type buys nothing here. The index already
isolates by `resourceType`; separate tables would isolate the same rows the same
way while triplicating the code that reads them.

### The honest cost

Roughly 100 small row reads per open is not free, and Convex bills by documents
read. If reads dominate writes for a given resource, the answer is to lower
`consolidateAfter` or consolidate opportunistically on read — both move the
constant without changing anything structural. The point of the design is that
the constant is *tunable* and does not grow.

## Writing

```text
current = last recent changeSet's revision (or leader.revision)
if incoming.baseRevision < current:
    rebase against sets in (baseRevision, current]   // may reject
insert changeSets { revision: current + 1, ... }
```

The insert is the whole write. The resource row is untouched, the leader snapshot
is untouched, and nothing is patched.

The read of `current` and the insert happen in one mutation, and Convex mutations
are serializable. A concurrent writer that committed `current + 1` first
invalidates this mutation's read set, so it re-runs and sees the new maximum —
[no unique index and no retry
loop](README.md#there-are-no-unique-indexes) are involved. The isolation level is
the guarantee.

## Consolidation

```text
sets = changeSets.by_resource_state(project, type, id, "recent") where count > consolidateAfter
patch leader { revision, body: apply(leader.body, sets) }
patch each folded set { tier: "historical" }
```

The leader moves forward and the folded sets change tier. Re-tiering is a flag
flip rather than a copy between tables, which is why `tier` is a field and not
two tables — and why reconstructing a revision spanning the boundary is one
indexed range read.

## Reading a past revision

```text
anchor = newest resourceSnapshot with revision <= target
sets   = changeSets.by_resource_revision(project, type, id) in (anchor.revision, target]
body   = apply(anchor.body, sets)
```

The anchor is a checkpoint when one exists below the target, otherwise the base.
This is the **only** mechanism for older versions — nothing stores past bodies
separately, which is why no other object in the system needed a bespoke history
model.

## Pruning

Advancing the base is the storage lever: reconstruct the body at revision R,
write it as the new `base`, delete historical sets and checkpoints older than R.

It touches nothing in the hot path. Merging, current reads, and CAS are all
unaffected by how far back history goes.

## Why the body is not on the resource row

Everything above follows from one decision, so it is worth stating plainly.

A Convex `patch` rewrites the whole document. If `documents` held `blocks`, every
accepted change set would rewrite the entire body — hundreds of kilobytes for a
one-character edit. If it held `revision`, the same rewrite would happen just to
bump a counter.

With neither, a mutation appends one small row. The cost is that a read is a
snapshot plus a bounded fold instead of a single row — and reads can be cached,
batched, and served from a warm leader, while write amplification cannot be
mitigated at all.

## Related

[storage](README.md) · [document](../data-models/general-resources/document.md) ·
[change set](../data-models/revisions/change-set.md) ·
[resource snapshot](../data-models/revisions/resource-snapshot.md)
