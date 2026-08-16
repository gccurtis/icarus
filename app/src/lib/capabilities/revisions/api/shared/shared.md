# Shared Revisions Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
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
    └── shift(p, span)                   apply/shift.ts
```

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
whole display string, so `applyText` starts the span where that atom starts in
the display. That conversion is the silent-corruption hazard in this file: get it
wrong and marks that had no business moving move, with everything still
well-formed.

**A mark inside removed text collapses to the edit point.** Applying has nobody
to reject to, and the text the mark named is gone. It collapses rather than
disappearing so a change addressing that mark still finds it.

## What applying refuses

Whether an op *may* apply is settled before it gets here. What is still refused
is an op that cannot be carried out: a path naming an id the body does not hold,
an entry that is not there to remove or move, or a `text` op whose offset is
outside its atom or whose `remove` is not the string sitting at it.

The last two are the ones worth the comparison, because `slice` has no bounds and
an empty `remove` matches anywhere: without them a malformed offset appends
silently, which is the same failure mode as a wrong shift. Half an applied set is
a state nobody authored, so the whole thing throws instead.
