# Flush

Lives at `methods/flush/flush.md`.

Everything between "the user committed the cell" and "the server has it".

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
| `flushAfterOps` | 50 | Editing continuously |
| `flushAfterMs` | 2000 | Stopping |

The timer is **refreshed** on every apply rather than left running, so the wait
is measured from the last op rather than the first.

`release` also flushes, unconditionally. Disposal is never a silent discard.

## Coalescing, and its one hard rule

A cell commits whole, so typing never reaches the buffer as keystrokes. What
does repeat is a person re-entering one cell, dragging one column edge, or
nudging one style field several times in a row, and only the last state is what
the sheet ends up holding.

Only repeated `set`s on one path fold, into the most recent earlier `set` on that
path. The folded op keeps the **last** `value` and the **first** `was`.

**That asymmetry is the rule.** `value` is where the run ended; `was` is where it
started. Keeping the later `was` would produce an op that inverts to an
intermediate state the server never held.

A fold is refused when anything between the two ops touches related ground.
Relatedness is decided on the strings — equal, or one continuing the other at a
segment boundary — because **this object resolves no paths**.

**History is untouched.** Coalescing is the wire's view of the buffer; the undo
stack keeps one entry per gesture.

## What an answer does

| Answer | Then |
| --- | --- |
| accepted | Adopt the revision, apply any catch-up ops to the sheet, read the leader again |
| `stale` | Restate the buffer at the leader's revision and send once more; a second refusal reverts |
| `unresolved` | Revert: drop the buffer, read the leader, report `needs-review` |
| a fault | Put the ops back at the front and report `error`; the next flush retries them |

Reverting is a read, not a rewind. The sheet the server holds replaces the one
that diverged, and the person is told so rather than left with two truths.

## Rebasing, and why it is small

A refused change set is not wrong — it was stated against a revision that has
since moved. Because nothing here resolves a path, there is no operational
transform to write.

The refused ops go to the **front** of the buffer, ahead of anything typed while
the submit was in flight, because they happened first.
