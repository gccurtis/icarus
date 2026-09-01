# Flush

Lives at `methods/flush/flush.md`.

Everything between "the user left the cell" and "the server has it".

```text
flush/
├── flush.md
├── flush.ts       submit the buffer as one change set
├── coalesce.ts    fold the buffer before it goes
└── rebase.ts      a refused change set, re-stated at the new revision
```

## When it runs

Two thresholds, whichever is reached first, both from
[`configuration/revisions.yaml`](../../../../../../../configuration/revisions.yaml)
by way of the client `configuration` object.

| Threshold | Default | Reached by |
| --- | --- | --- |
| `flushAfterOps` | 50 | Typing continuously |
| `flushAfterMs` | 2000 | Stopping |

The timer is **refreshed** on every apply rather than left running, so the wait
is measured from the last op rather than the first.

`release` also flushes, unconditionally. Disposal is never a silent discard.

## Coalescing, and its one hard rule

Editing one cell produces far more operations than changes: every keystroke in
the formula bar is a `set` on one path, and only the last one is what the cell
ends up holding.

Only repeated `set`s on one path fold, into the most recent earlier `set` on that
path. The folded op keeps the **last** `value` and the **first** `was`.

**That asymmetry is the rule.** `value` is where the run ended; `was` is where it
started. Keeping the later `was` would produce an op that inverts to an
intermediate state the server never held.

A fold is refused when anything between the two ops touches related ground.
Relatedness is decided on the strings — equal, or one continuing the other at a
segment boundary — because **this object resolves no paths**.

**A sheet has one fewer case to argue about.** There is no `text` op: a cell is
`set` whole rather than spliced, so nothing here has to reason about offsets
stated against a string an earlier op produced.

**History is untouched.** Coalescing is the wire's view of the buffer; the undo
stack keeps one entry per gesture.

## Rebasing, and why it is small

A refused change set is not wrong — it was stated against a revision that has
since moved. Because nothing here resolves a path, there is no operational
transform to write.

The refused ops go to the **front** of the buffer, ahead of anything typed while
the submit was in flight, because they happened first.

A refusal the ladder cannot resolve is not retryable. The buffer is kept and
`needs-review` says so, because a person has to decide.

## What is not built yet

Nothing writes `spreadsheetChangeSets`. The call is written out in `flush.ts` as
a comment, and the accepted branch is taken locally so every state transition
around it is the real one.

`rebase` therefore has no caller yet and is proved by its own tests instead.
