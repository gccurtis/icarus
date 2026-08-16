# Revisions API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`read/`](read/read.md) | `read` | query — a resource's current body and revision |
| [`submit/`](submit/submit.md) | `submit` | mutation — accepts a change, or refuses it |
| [`consolidate/`](consolidate/consolidate.md) | `consolidate` | mutation — folds the recent sets into the leader |
| [`shared/`](shared/shared.md) | — | `current`, `start`, `discard`, `applyOps`, `invert`, and `shift` |

Registered in
[`src/convex/capabilities/revisions.ts`](../../../../convex/capabilities/revisions.ts).
`shared/` is exempt from the correspondence between `api/` and the door, in both
directions.

## Three functions, and they are asymmetric on purpose

`read` folds a bounded window onto the leader. `submit` reads two rows and
inserts one. `consolidate` is what keeps the first of those bounded, and it is
the only thing that ever moves the leader.

Nothing here writes to the resource row, and nothing here stores a revision. That
is not an omission — a Convex patch rewrites the whole document, so a revision on
the row would cost the size of a deck per keystroke batch.

## Only `submit/` decides whether a change may apply

That is the [conflict ladder](../../../../../../docs/processes/change-conflicts.md),
and it is the whole reason this capability has a public write. Everything in
`shared/` executes a decision already made — which is why the only thing those
procedures refuse is an op that cannot be carried out at all.

## Creating or deleting a resource is not a function here

[`shared/start.ts`](shared/shared.md) writes the anchors a resource is read from
and [`shared/discard.ts`](shared/shared.md) takes them away again, both called by
whoever owns the resource, in that owner's own transaction. They are registered
nowhere: a client that could plant or erase a body under an id it chose would be
reaching past the capability the resource belongs to.
