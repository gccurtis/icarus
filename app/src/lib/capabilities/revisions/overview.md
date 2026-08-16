# Revisions

How a general resource's content is stored: anchor bodies plus an append-only log
of what changed. A [document](../documents/overview.md), a deck, and a workbook
all go through here, because replay is generic over ops and never inspects a
body.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `read` | query | what a resource says now, and what to author against |
| `submit` | mutation | whether a change may land, and at which revision |
| `consolidate` | mutation | nothing a reader can observe — it is what keeps `read` cheap |

Registered in
[`src/convex/capabilities/revisions.ts`](../../../convex/capabilities/revisions.ts).
Creating a resource is not among them: `start` in
[`api/shared/`](api/shared/shared.md) writes the anchors, called by whoever
creates the resource, in the same transaction.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `resourceSnapshots` | a materialized body at a revision — `leader` for the hot read, `base` for the cold one, `checkpoint` to bound replay |
| `changeSets` | one row per accepted mutation: the coalesced ops, the revision, the revision it was authored against, and its tier |

## Capability Invariants

- **`(resourceType, resourceId)` is the full key, always.** Never the id alone:
  two resources of different kinds may carry the same id. `projectId` leads that
  pair on every index, as everywhere else, so a read naming one field too few
  ranges over one project rather than the deployment — and the scoping is the
  index rather than a comparison somebody has to remember after it.
- **Neither the resource row nor anything else stores a current revision.** It is
  the highest change set revision, read from an index. Storing it would mean an
  edit patches the resource, and a Convex patch rewrites the whole document
  including the body.
- **A resource is anchored at creation or it does not exist.** `start` writes the
  `leader` and the `base` at revision 0 in the same transaction as the resource
  row, which is what makes a leader's absence mean "no such resource" rather than
  "not written yet". Read through a scope, absent and somebody else's are the
  same answer, which is the refusal a caller should be making anyway.
- **A change set is inserted, never modified** — except `tier`, which
  consolidation flips. Nothing rewrites an accepted set, which is what makes
  history and undo the same mechanism as merging.
- **Uniqueness of `revision` per resource is the transaction's, not an index's.**
  Read the maximum and insert one above it in one mutation; a writer that commits
  first invalidates this one's read set and it re-runs. There is no version field
  and no retry loop.
- **`touched` holds the deepest thing each op addresses**, never its ancestors —
  including them would report a collision on every shared container. Deepest is
  the last `#id` in the path *and the segments below it*, because a keyed
  collection's entries are told apart by nothing else: stopping at the id would
  collapse every cell of a sheet onto the sheet. It is derived from the ops on
  the way in, because a caller that understated it would be a caller whose
  changes collide with nothing.
- **A rejection names the rung that refused it.** Thrown as `RevisionsError`, so
  the payload survives to the client: Convex serializes a `ConvexError`'s payload
  and redacts everything else, and a conflict with no reason is unactionable.
  Nothing is lost by one — the edits are still in the client's buffer, and it
  re-reads, reapplies, and resubmits.
- **A body is opaque to everything here but one op.** Stored it is a union of the
  three resources' bodies, declared in [`types/body.ts`](types/body.ts) by
  importing them; read it is a path and whatever sits at the end of it. The
  exception is a `text` op, which maintains its block's `display` and marks — a
  change set carries neither, so applying is what keeps them true.
- **An op works on a tree, not on a resource.** Ordered lists are addressed by
  the ids their entries carry; a keyed collection's entries are addressed by the
  path itself, because a key *is* the entry's identity. Both are properties of
  the shape at the path, and nothing here branches on `resourceType` to decide
  which — that genericity is what let decks and workbooks arrive without a line
  of new machinery. [`test/unit/resource-types.test.ts`](test/unit/resource-types.test.ts)
  is what says so.

## Related

[change set](../../../../../docs/data-models/revisions/change-set.md) ·
[resource snapshot](../../../../../docs/data-models/revisions/resource-snapshot.md)
— the models this implements ·
[general resources in Convex](../../../../../docs/storage/general-resources.md) —
the tables and their read costs ·
[change conflicts](../../../../../docs/processes/change-conflicts.md) — the
ladder [`api/submit/`](api/submit/submit.md) implements
