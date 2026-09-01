# History

Lives at `methods/history/history.md`.

Two stacks of gestures, and the two moves between them.

```text
history/
├── history.md
├── history.ts     undo() · redo() — move an entry, return ops to buffer
└── invert.ts      invert() · invertAll() — the payload swap
```

## What a stack entry is

**One gesture, which is one `apply` call.** The editor decides what a gesture is
— committing a cell, not each keystroke in it — and this object never splits or
merges one.

That is why coalescing is forbidden to touch these stacks. `coalesce` folds the
buffer so less goes over the wire; folding history would make one undo revert
whatever happened to share a path.

## Four cases, where a document has five

A sheet has no `text` op. A cell holds a value and an expression rather than
atoms, so editing one is a `set`, and a `set` inverts by exchanging `value` and
`was` like any other.

A cell is also in neither `insert` nor `remove`: where it sits is which row and
column it names, so there is nowhere to insert one and clearing one writes an
empty value. That is what keeps `insert` and `remove` exact mirrors over the same
three targets, which is what makes those two cases a rename.

## Why entries are stored as applied, never as inverted

One entry then serves both directions. An entry popped from `undo` goes onto
`redo` unchanged, and the inverse is computed on the way out.

Storing inverses instead would mean inverting again on redo — an inversion of an
inversion, which is only equal to the original if `invert` is exactly
involutive. It is, today. Depending on that is a trap.

## Every op inverts, which is what `ids` on an insert buys

`insert` names the ids it inserted. Applying one does not need them — the values
carry their own — and inverting one to a `remove` does. Without them an insert
would be the one op with no inverse, and a gesture that added a row could not be
undone at all.

## Undo is an ordinary change set

Nothing here is a rewind. `undo` returns ops, the definition buffers them, and
they flush and submit like any other edit.

The consequence worth knowing: **an undo can be refused**, exactly as any change
set can.

## Order matters twice

`invertAll` reverses as well as inverts. The ops in a gesture applied in order,
so undoing walks them backwards.

## Neither function buffers

They return ops. The definition applies them, which is what keeps these files
from importing `apply`.
