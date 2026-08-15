# Change set

One accepted mutation to a general resource: a group of operations, coalesced so
that what remains is the minimal set of changes actually made.

A change set is the unit of everything. It is what gets validated, what gets
accepted, what becomes a revision, and what gets undone.

```ts
interface ChangeSet {
  projectId: Id<"projects">;
  resourceType: "document" | "slides" | "spreadsheet";
  resourceId: string;
  revision: number;            // this set's index; unique per resource
  baseRevision: number;        // the revision it was authored against
  tier: "recent" | "historical";
  ops: Op[];
  actor: Actor;
  at: number;
}

type Op =
  | { op: "set"; path: string; value: unknown; was: unknown }
  | { op: "insert"; path: string; index: number; values: unknown[] }
  | { op: "remove"; path: string; index: number; values: unknown[] }
  | { op: "move"; path: string; from: number; to: number }
  | { op: "text"; path: string; at: number; insert: string; remove: string };
```

## Sets, not individual operations

Typing a sentence, deleting half of it, and pasting a replacement is dozens of
operations and one change. The client accumulates operations as they happen and
folds them before submitting:

- consecutive `text` ops on one path merge into a single splice
- an `insert` later undone by a `remove` of the same values cancels to nothing
- repeated `set` ops on one path collapse, keeping the first `was` and the last
  `value`
- any op inside a subtree that the same set later removes is dropped

What arrives is a minimal set of orthogonal changes. That matters for storage,
but it matters more for **merging**: fewer touched paths means a higher chance
that [rule 2](#rebase-rules) applies and a concurrent edit merges instead of
being rejected. Coalescing is a correctness-adjacent optimization, not just a
size one.

The folding is client-side. The model's obligation is to make it possible — the
set is validated and accepted atomically, and nothing depends on seeing the
intermediate states that were folded away.

## Revision is an index

`revision` is the change set's position in the resource's sequence. Not a
timestamp, not a hash — the first accepted set is 1, the next 2, and the
resource's current revision is the last one.

`baseRevision` is what its author was looking at when they made it. For an
uncontended edit the two differ by one.

A conventional CAS stores only the base and compares it to current, answering
"has anything changed". Keeping both turns it into "has anything *conflicting*
changed", which is the entire reason this model exists.

## The resource has no revision field

Current revision is the highest change set revision for that resource, read from
an index. It is deliberately not stored on the resource row.

If it were, every edit would have to patch the resource — and a Convex patch
rewrites the whole document, including the body. A large document would be
rewritten on every keystroke batch. Keeping revision out of the row means a
mutation writes one small change set row and nothing else.

**CAS falls out of that for free.** The change set table is uniquely indexed on
`(resourceId, revision)`. Inserting at a revision that is already taken fails,
and that failure *is* the compare-and-swap — no read-modify-write, no
transaction retry loop around a version field.

## Reading the current resource

Read the [head](resource-snapshot.md), read the change sets after its revision,
apply them in order.

The head is not current, by design. It advances only on consolidation, so the
number of sets to apply is bounded by the consolidation interval rather than by
how long the resource has existed.

## Paths

`path` addresses a location inside the resource using the same
object/field/index scheme as everything else — `blocks/4`, `blocks/4/marks`,
`slides/2/elements/1/blocks/0`, `sheets/0/cells/B7`.

A string rather than an array of segments, so it can be compared,
prefix-matched, and indexed directly. Disjointness — the core of the merge rule
— is a prefix comparison.

## Every op is invertible

Undo is a first-class requirement, so the op set is closed under inversion. Each
operation carries enough to reverse itself:

| Op | Inverse |
| --- | --- |
| `set` | `set` with `value` and `was` swapped |
| `insert` | `remove` with the same `values` |
| `remove` | `insert` with the same `values` |
| `move` | `move` with `from` and `to` swapped |
| `text` | `text` with `insert` and `remove` swapped |

This is why `remove` carries `values` rather than a `count`, and why `text`
carries the removed string rather than a length. Undoing a delete has to
reproduce what was deleted, and the alternative — reconstructing it by replaying
from the head — makes the cost of an undo depend on how long ago the change
was.

Inverting a change set is inverting each op and reversing their order. The
result is an ordinary change set, submitted like any other, subject to the same
rebase rules. An undo is not a special operation; it is a change.

## Rebase rules

Given an incoming set with `baseRevision = B` and the resource at revision `C`:

1. **`B === C`** — apply directly at revision `C + 1`.

2. **`B < C`, paths disjoint** — for every set in `(B, C]`, if no path is equal
   to or a prefix of an incoming path in either direction, rebase and apply.
   Rebasing adjusts indices: an intervening `insert` at a lower index in a
   shared array shifts the incoming index up, a `remove` shifts it down.

3. **`B < C`, same path, both `text`, non-overlapping ranges** — shift the
   incoming `at` by the intervening length deltas and apply. Two people typing in
   different sentences of one paragraph merge.

4. **Anything else** — reject. The client re-reads at `C` and retries.

5. **`B` older than the rebase window** — reject regardless of paths.

Rules 1–3 stop deliberately short of a full operational transform. Overlapping
edits to the same text range conflict rather than being resolved by a tiebreak,
because silently merging two people rewriting the same sentence produces text
neither of them wrote.

**Rule 5 is the one that is expected to change.** Whether two edits conflict is
a question about paths, not about time, and rule 5 rejects on age alone. It
exists now because evaluating conflict requires the intervening sets to still be
in the hot tier, and keeping every set there forever is what the two-tier split
avoids. The window is
[configuration](../../../app/configuration/revisions.yaml), so it can be widened
without a model change while a better answer is worked out.

## Tier

Which side of the consolidation boundary the set sits on. `recent` sets are the
rebase window and are read on contended writes and on every resource read;
`historical` sets are the archive, read only when reconstructing a past
revision.

A field rather than two tables, so consolidation is a flag flip rather than a
copy-and-delete, and so reconstructing a revision spanning the boundary is one
indexed range read.

## Marks and text edits

A `text` op changes the display string, and [marks index the display
string](../content/content-block.md#marks-index-the-display-string). A set that
edits text therefore also carries a `set` on that block's `marks`, in the same
op list, adjusted for the length delta.

Bundling them means they apply atomically, rebase together, and invert together.
A rebase that shifted the text but not the marks would leave formatting over the
wrong characters.

## Actor

The shared [`Actor`](../core/actor.md) type, not a user id, because agents,
automations, and connectors edit resources too. An agent change points at its
task, so "why did this paragraph change" is one hop away.

It is the reference form and never the label — a display string on every change
set would be duplicated thousands of times per document and would go stale the
moment someone is renamed.

Two things depend on this field:

**Undo** reverts sets where the actor is the person undoing, and no others. See
[undo scopes on the actor](../core/actor.md#undo-scopes-on-the-actor).

**Attribution** survives consolidation. Change sets move to the `historical`
tier rather than being discarded, so who wrote a given paragraph stays
answerable for as long as history is retained.

Actor is here as well as in [activity](../collaboration/activity.md) because
activity is deliberately coarse: a burst of editing is one activity entry and
many change sets.

## Related

[resource snapshot](resource-snapshot.md) · [revisions](README.md) ·
[document](../general-resources/document.md) ·
[activity](../collaboration/activity.md)
