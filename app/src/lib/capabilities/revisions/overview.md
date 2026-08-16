# Revisions

How a general resource's content is stored: anchor bodies plus an append-only log
of what changed. A [document](../documents/overview.md), a deck, and a workbook
all go through here, because replay is generic over ops and never inspects a
body.

**No registered function yet, so no deployment door.** [`api/`](api/api.md) holds
the procedures every eventual function shares — applying ops, inverting one,
shifting an offset. The conflict ladder arrives in task 9 and
`read`/`submit`/`consolidate` in task 10.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `resourceSnapshots` | a materialized body at a revision — `leader` for the hot read, `base` for the cold one, `checkpoint` to bound replay |
| `changeSets` | one row per accepted mutation: the coalesced ops, the revision, the revision it was authored against, and its tier |

## Capability Invariants

- **`(resourceType, resourceId)` is the full key, always.** Never the id alone:
  two resources of different kinds may carry the same id. It is what every index
  leads with here, unlike the rest of the codebase, because these rows are
  reached through a resource row the gate has already scoped. `projectId` is
  stored anyway, so nothing has to join upward to know whose a row is.
- **Neither the resource row nor anything else stores a current revision.** It is
  the highest change set revision, read from an index. Storing it would mean an
  edit patches the resource, and a Convex patch rewrites the whole document
  including the body.
- **A change set is inserted, never modified** — except `tier`, which
  consolidation flips. Nothing rewrites an accepted set, which is what makes
  history and undo the same mechanism as merging.
- **Uniqueness of `revision` per resource is the transaction's, not an index's.**
  Read the maximum and insert one above it in one mutation; a writer that commits
  first invalidates this one's read set and it re-runs. There is no version field
  and no retry loop.
- **`touched` holds the deepest id each op addresses**, never its ancestors —
  including them would report a collision on every shared container.
- **A body is opaque to everything here but one op.** Stored it is `v.any()`
  until task 11, where it becomes a union discriminated on `resourceType`; read
  it is a path and whatever sits at the end of it. The exception is a `text` op,
  which maintains its block's `display` and marks — a change set carries
  neither, so applying is what keeps them true.

## Related

[change set](../../../../../docs/data-models/revisions/change-set.md) ·
[resource snapshot](../../../../../docs/data-models/revisions/resource-snapshot.md)
— the models this implements ·
[general resources in Convex](../../../../../docs/storage/general-resources.md) —
the tables and their read costs ·
[change conflicts](../../../../../docs/processes/change-conflicts.md) — the
ladder task 9 implements
