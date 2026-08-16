# API: `submit`

Accepts a change to a general resource, or refuses it.

Registered as `api.capabilities.revisions.submit`, built from `projectMutation`,
so the caller's token is resolved to a membership before this runs and the
handler receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
submit(ctx, scope, authored, by)
├── head(ctx, authored)                     ../shared/head.ts   current revision, and whose
├── touchedBy(authored.ops)                 check.ts    the ids step 2 intersects
├── check(ctx, scope, incoming, revision)   check.ts    the ladder
│   ├── bothTyping(mine, landed, id)        check.ts    step 2's one exception
│   ├── removedBy(op) / anchorOf(op)        check.ts    step 3's containment
│   ├── movesText(op) / disturbed(op)       check.ts    step 4's precondition
│   ├── displayed(ctx, scope, incoming, …)  check.ts    a mark's coordinates
│   │   ├── current(ctx, scope, resource)   ../shared/current.ts
│   │   └── displaySpan(body, op)           ../shared/apply/apply.ts
│   └── rebased(op, texts, display)         check.ts
│       └── shift(p, span)                  ../shared/apply/shift.ts
└── ctx.db.insert("changeSets", …)          submit.ts
```

`check.ts` sits here rather than in [`shared/`](../shared/shared.md) because the
ladder has exactly one caller. Promotion means a second function needs it, not
that a file grew large.

## The ladder is [change conflicts](../../../../../../../docs/processes/change-conflicts.md)

That document is the specification and this is not a second copy of it. What is
decided here rather than there:

**`touched` is derived from the ops, never taken from the caller.** It is the
whole of step 2, so a set that understated it would be a change that collides
with nothing.

**The window's age is tested before the window is read.** Same answer either
way, and it is also what bounds the read: `(B, C]` on a base from last year is
every set the resource ever had.

**`rebaseWindow` is copied into `check.ts`, not read.** A mutation runs in an
isolate with no filesystem and the Convex bundler has no YAML loader, so the
value in [`configuration/revisions.yaml`](../../../../../../configuration/revisions.yaml)
cannot reach it. The copy names the key it copies, and
`test/unit/retention.test.ts` fails if the file moves without it.

**A path that does not name what an offset is measured against is refused.** An
`#id` segment resolves alone, so `#a9x1` is a legal path for a text op — and
nothing can then prove the block around it was left alone. Step 4 rejects rather
than shifting on a guess, which is the same stance as every other rung.

**A removal has to say what it took, or nothing concurrent may land.** `values`
is what an undo restores from, and it is also the only account of the subtree a
removed row carried: no id in the op names the blocks and atoms inside it, and an
incoming path naming one of them by its own id says nothing about the row above.
A removal that carries none makes the window opaque and everything concurrent is
refused — which is what a rung that will not read a body costs when the client
understates its own payload.

**A refusal here is cheaper than the alternative.** The sets step 3 now catches
are not conflicts; they are changes that pass every other rung, commit, and can
then never be applied. There is no repair path in this capability for a resource
whose log holds one, so the rung fails closed wherever it cannot see.

## `by` decides whose undo can reach the change

The door builds the caller's own actor from `ctx.scope`, which is the default and
what a person's edit carries. An agent editing during a task passes
[its task's actor](../../../agent-tasks/types/agent-task.ts) instead, because a
task's changes are attributed to the task and not to whoever dispatched it — undo
selects on `actor.kind === "user"`, so that one argument is what keeps a hundred
agent edits out of somebody's Ctrl-Z.

It is a parameter rather than an argument for the usual reason: nothing at the
door accepts it, so a browser cannot sign somebody else's name to a change.

## A rejection says which rung refused

`RevisionsError` carries a `step`, because "conflict" on its own is unactionable.
The client re-reads at the current revision, reapplies the edits still in its
buffer, and resubmits — no work is lost, and the cost is one round trip.

## No head means no resource here

Every index on `changeSets` leads with `projectId`, so the window this reads is
the caller's project's or it is empty. A resource belonging to somebody else has
no head to find and is **not found**, never forbidden — the same answer as one
that was never created, because telling them apart confirms it exists.

**No head means no resource**, and that is why this is sound rather than a gap:
[`start`](../shared/shared.md) writes the leader in the same transaction as the
resource row, so nothing that exists is without one. Two rows at most, rather than
the window [`read`](../read/read.md) collects — what this needs is the maximum
revision, not the body.

## What it does not do

**No activity entry.** An edit is a keystroke batch, and a feed of them would
bury everything a person would want to read there.

**No compare-and-swap.** Convex mutations are serializable: a writer that commits
`current + 1` first invalidates this one's read set and it re-runs against the
state that beat it. No version field, no retry loop.

## Converting a mark's coordinates is the one body read

A text op's `at` is an offset into its own atom; a mark's offsets index the
block's whole display string. Rebasing one against the other without converting
is exact for a single-atom block and wrong by the preceding atoms' length
otherwise — and wrong here means marks land on text nobody put them on, with
nothing raised and nothing to notice.

So the conversion is made, by the same function `applyOps` uses, and the body it
needs is fetched only where the case actually arises: an incoming mark, and an
intervening text edit in that mark's own block. Everything before it has already
returned. The window is replayed from the change's own base rather than measured
against the body as it stands, because an edit to an earlier atom moves where a
later one starts — and a change authored below a leader consolidation has since
passed is refused, because that body can no longer be rebuilt from what a read
reaches.
