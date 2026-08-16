# API: `consolidate`

Folds the recent change sets into the leader snapshot once more than a window has
accumulated.

Registered as `api.capabilities.revisions.consolidate`, built from
`projectMutation`, so the caller's token is resolved to a membership before this
runs and the handler receives `ctx.scope` rather than a project it could have
chosen.

## Procedure Tree

```text
consolidate(ctx, scope, resource)
├── current(ctx, scope, resource)     ../shared/current.ts   leader + the sets past it
├── applyOps(leader.body, ops)        ../shared/apply/apply.ts
├── ctx.db.patch(leader, …)           consolidate.ts
└── ctx.db.patch(set, { tier })       consolidate.ts
```

## This is what keeps [`read`](../read/read.md) a constant

`read` folds every recent set past the leader, so the leader standing still is
what would make reads grow without bound. Moving it up to the newest set means the
next reader folds nothing.

## Re-tiering is a flag flip, not a delete

A folded set stays exactly where it is, with `tier` changed. That is why `tier` is
a field and not two tables: [the ladder](../submit/submit.md) rebases against
`by_resource_revision`, which does not filter on tier, so a change authored just
before a consolidation still merges.

It is also why **`consolidateAfter` must stay below `rebaseWindow`** — above it,
folding would run ahead of what the ladder still needs, and pruning would then
evict those rows for real. The two numbers live in
[`configuration/revisions.yaml`](../../../../../../configuration/revisions.yaml),
mirrored into the isolate that cannot read it, and
`test/unit/retention.test.ts` fails if either moves.

## What it does not touch

**The resource row.** It has no body and no revision, which is the reason an edit
is one small insert rather than a rewrite of a document — and consolidation has
nothing to tell it.

**The base snapshot.** It stays at revision 0 as the anchor for reconstructing
anything below the leader. Advancing it is pruning, which is a separate lever and
the only thing here that destroys history.

## Registered rather than hidden

Folding is a real maintenance action someone triggers, and a directory the door
never names fails lint besides. It is safe to expose because it refuses any
resource the caller cannot already read, and because it changes nothing anyone can
observe: the body a reader gets before and after a fold is the same body.
