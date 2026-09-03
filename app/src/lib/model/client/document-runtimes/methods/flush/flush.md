# Flush

Lives at `methods/flush/flush.md`.

Everything between "the user stopped typing" and "the server has it".

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
is measured from the last op rather than the first. That is what makes the two
thresholds mean different things instead of the clock always winning.

`release` also flushes, unconditionally. Disposal is never a silent discard.

## Coalescing, and its one hard rule

Editing produces far more operations than changes. Typing a sentence and
deleting half of it is dozens of ops that mean one small splice, and submitting
each is both wasteful and fills history with steps nobody wants to see.

Repeated `set`s on one path fold, into the most recent earlier `set` on that
path. The folded op keeps the **last** `value` and the **first** `was`.

**That asymmetry is the rule.** `value` is where the run ended; `was` is where it
started. Keeping the later `was` would produce an op that inverts to an
intermediate state the server never held — so the fold would be correct going
forwards and wrong going back, which is the worst kind of correct.

A fold is refused when anything between the two ops touches related ground.
Merging moves the later op earlier in the sequence, and that is only sound if
nothing in between could have changed what it applies to. Relatedness is decided
on the strings — equal, or one continuing the other at a segment boundary —
because **this object resolves no paths**. It is conservative in the safe
direction: a fold that does not happen costs bytes, and nothing else.

## Text folds too, and the reason it can

Runs of `text` ops on one atom fold into one splice, so typing a sentence
travels as one op rather than forty.

There are two different things called recomputing an offset, and only one of them
is the transform this design avoids. **Transforming concurrent ops** — re-stating
somebody else's op against a string yours has changed — needs to know what
happened between two edits nobody ordered, and that is what the id-based paths
exist to make unnecessary. **Composing your own consecutive ops** is neither: one
author, one atom, already in order, nothing to resolve. The combined `remove` is
measured against the string the run started on and the combined `insert` against
the one it ended on — the same asymmetry `set` already keeps, for the same
reason.

The constraint is geometric rather than arithmetic. A `text` op is **one
contiguous splice**, so a run folds only while each op's region touches or
overlaps the region the run has built so far. Typing `h-e-l-l-o` collapses to one
splice; a caret that jumps to a disjoint part of the same atom starts a second
op, because one splice could only cover both by swallowing everything between
them. A fold that cancels out — typing a character and deleting it — leaves no op
at all.

**History is untouched.** Coalescing is the wire's view of the buffer; the undo
stack keeps one entry per gesture.

## Rebasing, and why it is small

A refused change set is not wrong — it was stated against a revision that has
since moved. Because nothing here resolves a path, there is no operational
transform to write: rebasing re-states the ops at the new revision and resubmits.

The refused ops go to the **front** of the buffer, ahead of anything typed while
the submit was in flight, because they happened first.

A refusal the ladder cannot resolve is not retryable, and the ops are **not**
kept. The buffer is dropped, the stored body is read back, and `body` becomes it
— so the editor repaints onto what the server actually holds and `needs-review`
says why.

**Keeping them would be worse than losing them.** A refused change set was stated
against a revision that has moved; resubmitting it at the new one asks the server
to apply ops to a body they were never authored against. The precondition checks
would catch most of that — a `text` op names the string it expects to remove —
but the ones they miss are silent corruption, and a buffer that can never be
accepted is not work in progress, it is a document that has quietly stopped
saving.

One rebase is attempted, and only for `stale`. `unresolved` means an op named
something the body does not hold, which re-stating cannot fix.

## What crosses the wire

A change set, never a bag of ops: `resourceId`, `baseRevision`, the coalesced
`ops`, and the `touched` paths they reached. The rest of a `documentChangeSets`
row is the server's — the revision it becomes, who asked, when, and its tier.

`touched` is derivable from the ops and is sent anyway, because it is part of
what a change set *is*. The capability checks the two agree rather than trusting
either alone.
