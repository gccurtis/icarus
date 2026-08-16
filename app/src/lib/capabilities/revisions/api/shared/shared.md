# Shared Revisions Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`current.ts`](current.ts) | that a resource is reached by its whole key, in this project, at a cost that does not grow |
| [`head.ts`](head.ts) | that where a resource stands is two rows and never a body, read inside the caller's own project |
| [`start.ts`](start.ts) | that a resource is readable from the moment it exists, and anchored below wherever the leader gets to |
| [`discard.ts`](discard.ts) | that deleting a resource ends it, rather than leaving a body its owner's row no longer guards |
| [`apply/apply.ts`](apply/apply.ts) | that a body advances by whole ops, and that a text edit leaves the block's display and marks consistent with it |
| [`apply/shift.ts`](apply/shift.ts) | that an offset measured before an edit still names the same characters after it |
| [`apply/invert.ts`](apply/invert.ts) | that every op has an opposite, so undo is an ordinary change |

`apply/` is a directory rather than three loose files because `applyOps` has
sub-procedures of its own; a nested procedure directory carries no document, so
this one covers the tree.

```text
applyOps(body, ops)
├── clone(body)                          apply/apply.ts
├── locate(body, op.path)                apply/apply.ts
│   └── findById(node, id)               apply/apply.ts   an #id segment resolves by search
└── applyText(body, op)                  apply/apply.ts
    ├── blockOf(body, atomId)            apply/apply.ts
    ├── displaySpan(body, op)            apply/apply.ts   atom offsets → display offsets
    └── shift(p, span)                   apply/shift.ts
```

## `current` is one read with two callers

[`read`](../read/read.md) folds what it returns and
[`consolidate`](../consolidate/consolidate.md) folds it and writes it back, so the
range predicates — and the bound they buy — are stated once. `submit` deliberately
does **not** use it: it needs the maximum revision, not the body, and that is two
rows rather than a hundred.

## `head` was promoted when generation needed it

[`submit`](../submit/submit.md) reads it to accept a change above the current
revision, and [derived outputs](../../../derived-outputs/overview.md) read it to
ask whether an input has moved since a generation saw it. Both want the number
and neither wants the body, which is the difference between it and `current` —
folding a body per input would make staleness cost a document per question.

## `start` and `discard` are called from outside this capability

Like [`activity`'s `record`](../../../activity/api/shared/shared.md), their
callers are the capabilities that own the resources rather than functions of this
one. That is unusual and correct: a general resource's body lives here, and when
one begins and ends does not.

**Both are registered nowhere.** The `api/` set and the deployment door name the
same functions, and neither of these is in either, because a client that could
plant or erase a body under an id it chose would be reaching past the capability
that owns the resource.

`discard` is what makes deletion mean anything: a read finds the leader snapshot
and a write the head change set without consulting the resource row at all, so
rows that outlived their owner's stay readable and writable by anyone in the
project still holding the id.

## Promoted before either caller exists

`read` folds recent sets onto the leader body, `submit` rebases an incoming set
against the window, and `consolidate` folds recent into leader. All three apply
ops, and `submit` shifts offsets, so these are promoted rather than owned by
whichever function is written first.

## `shift` is the one thing here that fails open

Every check in the ladder rejects when in doubt, and the worst that costs is a
resubmit. `shift` returns a number, so a bug puts characters in the wrong order
with no error raised and nothing to notice. Its case table is tested directly
rather than through anything that calls it.

The precondition that keeps it bounded lives in the ladder, not here: it only
ever runs on literal text against literal text, because everything else in the
window disqualifies the change first.

## Marks shift when text applies, and are never carried

A change set holds no marks beside a text op. The shift is a consequence of
applying one, computed here — which is what leaves rebasing a text op a
one-integer adjustment rather than a rewrite of a list.

The op's `at` is an offset into its atom, and a mark's offsets index the block's
whole display string, so the span starts where that atom starts in the display.
That conversion is the silent-corruption hazard in this file: get it wrong and
marks that had no business moving move, with everything still well-formed.

`displaySpan` is exported for the same reason `shift` is — the ladder needs the
identical conversion to rebase a mark, and two copies of this sum would agree
right up until one of them was edited.

**A mark inside removed text collapses to the edit point.** Applying has nobody
to reject to, and the text the mark named is gone. It collapses rather than
disappearing so a change addressing that mark still finds it.

## Ordered lists and keyed collections

`insert` and `remove` read the shape at the path rather than the op's target: an
array is an ordered list whose entries are found by the ids they carry, and
anything else is a keyed collection whose entry the path itself names. A
spreadsheet cell is the case that needed the second reading — its address is its
identity — and a style set is the same shape, which is why this is a property of
the tree rather than a special case for sheets.

## What applying refuses

Whether an op *may* apply is settled before it gets here. What is still refused
is an op that cannot be carried out: a path naming an id the body does not hold,
an entry that is not there to remove or move, or a `text` op whose offset is
outside its atom or whose `remove` is not the string sitting at it.

The last two are the ones worth the comparison, because `slice` has no bounds and
an empty `remove` matches anywhere: without them a malformed offset appends
silently, which is the same failure mode as a wrong shift. Half an applied set is
a state nobody authored, so the whole thing throws instead.
