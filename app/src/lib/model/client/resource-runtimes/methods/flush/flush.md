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
[`configuration/revisions.yaml`](../../../../../../configuration/revisions.yaml)
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

Only repeated `set`s on one path fold, into the most recent earlier `set` on that
path. The folded op keeps the **last** `value` and the **first** `was`.

**That asymmetry is the rule.** `value` is where the run ended; `was` is where it
started. Keeping the later `was` would produce an op that inverts to an
intermediate state the server never held — so the fold would be correct going
forwards and wrong going back, which is the worst kind of correct.

A fold is refused when anything between the two ops touches related ground.
Merging moves the later `set` earlier in the sequence, and that is only sound if
nothing in between could have changed what it applies to. Relatedness is decided
on the strings — equal, or one continuing the other at a segment boundary —
because **this object resolves no paths**. It is conservative in the safe
direction: a fold that does not happen costs bytes, and nothing else.

Two `text` ops on one atom look foldable and are not. Their offsets are stated
against the string each one produced, so merging them means recomputing offsets —
the transform this whole design exists to avoid.

**History is untouched.** Coalescing is the wire's view of the buffer; the undo
stack keeps one entry per gesture. Folding it would make one undo revert whatever
happened to share a path rather than what the user did.

## Rebasing, and why it is small

A refused change set is not wrong — it was stated against a revision that has
since moved. Because nothing here resolves a path, there is no operational
transform to write: rebasing re-states the ops at the new revision and resubmits.

The refused ops go to the **front** of the buffer, ahead of anything typed while
the submit was in flight, because they happened first.

A refusal the ladder cannot resolve — the base revision has fallen out of the
rebase window, or two edits genuinely conflict — is not retryable. The buffer is
kept and `needs-review` says so, because a person has to decide.

## What is not built yet

`revisions.submit` does not exist; the capability ships its vocabulary now and
its tables later. The call is written out in `flush.ts` as a comment, and the
accepted branch is taken locally so every state transition around it is the real
one.

`rebase` therefore has no caller yet — nothing can produce a refusal — and is
proved by its own unit tests instead. That is deliberate rather than an
oversight: the alternative was leaving the refusal path unwritten until the
capability lands, and writing it against the vocabulary it will actually receive
is what makes the wiring a one-line change.
