# API: `submit`

Accepts a change to a general resource, or refuses it.

Registered as `api.capabilities.revisions.submit`, built from `projectMutation`,
so the caller's token is resolved to a membership before this runs and the
handler receives `ctx.scope` rather than a project it could have chosen.

## Procedure Tree

```text
submit(ctx, scope, authored)
├── headOf(ctx, resourceType, resourceId)   submit.ts   current revision, and whose
├── touchedBy(authored.ops)                 check.ts    the ids step 2 intersects
├── check(ctx, incoming, current)           check.ts    the ladder
│   ├── bothTyping(mine, landed, id)        check.ts    step 2's one exception
│   ├── movesText(op) / disturbed(op)       check.ts    step 4's precondition
│   └── rebased(op, texts)                  check.ts
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

## A rejection says which rung refused

`RevisionsError` carries a `step`, because "conflict" on its own is unactionable.
The client re-reads at the current revision, reapplies the edits still in its
buffer, and resubmits — no work is lost, and the cost is one round trip.

## The head row is what says whose the resource is

Every index on `changeSets` leads with the resource pair rather than `projectId`,
so nothing in reading the window is scoped by the gate. The last accepted set —
or the leader snapshot behind it — is the row that answers it, and a resource
whose head belongs to another project is **not found**, never forbidden.

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

## A known limit

A text op's `at` is an offset into its own atom, and a mark's offsets index the
block's whole display string. Rebasing a mark past a text edit uses the edit's
own span, as the specification prescribes — which is exact for a single-atom
block and off by the preceding atoms' length otherwise. Converting between the
two coordinate systems needs the body, and no rung of the ladder reads one.
