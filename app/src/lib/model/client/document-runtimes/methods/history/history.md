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
— ProseMirror hands over a transaction, not a keystroke — and this object never
splits or merges one.

That is why coalescing is forbidden to touch these stacks. `coalesce` folds the
buffer so less goes over the wire; folding history would make one undo revert
whatever happened to share a path, which is not what the user did.

## Why entries are stored as applied, never as inverted

One entry then serves both directions. An entry popped from `undo` goes onto
`redo` unchanged, and the inverse is computed on the way out.

Storing inverses instead would mean inverting again on redo — an inversion of an
inversion, which is only equal to the original if `invert` is exactly
involutive. It is, today. Depending on that is a trap: the day one op's inverse
is not perfectly symmetric, redo starts corrupting documents rather than
failing.

## Every op inverts, which is what `ids` on an insert buys

`insert` names the ids it inserted. Applying one does not need them — the values
carry their own — and inverting one to a `remove` does. Without them an insert
would be the one op with no inverse, and a gesture containing one could not be
undone at all.

## Undo is an ordinary change set

Nothing here is a rewind. `undo` returns ops, the definition buffers them, and
they flush and submit like any other edit. The server sees a change set it cannot
distinguish from typing, which is what makes undo work across a refusal, a
rebase, and another person editing at the same time.

The consequence worth knowing: **an undo can be refused**, exactly as any change
set can. It is not a local guarantee.

## Order matters twice

`invertAll` reverses as well as inverts. The ops in a gesture applied in order,
so undoing walks them backwards — inverting each in place undoes a two-op gesture
in the wrong order and lands somewhere else.

## Neither function buffers

They return ops. The definition applies them, which is what keeps these files
from importing `apply` — a sibling import the ownership rule refuses, and would
be the wrong shape anyway: undo and redo buffer *without recording*, and that
distinction belongs at the composition point rather than inside a stack.
