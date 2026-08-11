# 0118 — Reconciliation is not a queue (JOB-1, coverage half)

Closes the last open item from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). Mostly by deciding
it rather than building it — but with one real fix.

## The item as written

`JOB-1` said the durable queue was under-used: it carries only `documents.rebase`,
`documents.resolve` and `agent.run`, while "connector re-sync, which is
conceptually background work, runs on its **own** detector goroutine outside the
queue." The implied fix was to bring it under the queue.

The observability half was closed in
[0117](0117-jobs-as-observability-and-an-exhaustive-dispatch-table.md). This
record closes the coverage half — by rejecting the premise.

## Why connector sync does not belong in the queue

They are different shapes, and the difference is not cosmetic.

A **job** is a work item with an outcome: enqueue it, run it, retry it on failure,
and past its attempt limit give up and record that it failed. Durability comes
from the *record* — the row survives a crash, so the work is not lost.

A **reconciler** has no work item. `DetectChanges` walks every connector and
compares the source's fingerprint against the stored one; it syncs exactly when
they differ. Durability comes from the *state*, not a record: if a sync is
interrupted the fingerprints still differ, so the next tick does it again. There
is nothing to lose and nothing to retry.

Moving it into the queue would therefore **weaken** the guarantee rather than
strengthen it. A one-shot job that exhausts its attempts stops trying; a
reconciler never stops. It would also add machinery — a self-rescheduling job, or
a job enqueued per detected change — to reproduce a property the loop already
has for free.

The same reasoning applies to the trash purge, which
[0115](0115-p3-hardening-sweep.md) moved to its own recurring loop rather than
into the queue.

So the boundary is now explicit: **the queue is for deferrable work items with an
outcome worth retrying and recording. Periodic reconciliation is a different
shape and stays a loop.** That is recorded in `DetectChanges`'s doc comment, where
the next person to ask this question will be standing.

## The real gap that was hiding underneath

The framing was wrong, but reviewing it surfaced a genuine defect. `DetectChanges`
swallowed per-connector errors:

```go
res, err := c.SyncIfChanged(rec.ProjectID, rec.ID)
if err != nil {
    continue
}
```

Skipping a failed connector is right — one unreachable folder must not abandon
the sweep for every other connector. Skipping it **silently** is not: a connector
that fails on every tick would be invisible forever, which is exactly the class of
problem `JOB-1`'s observability half existed to fix.

`DetectChanges` now returns `(changed, failed int, err error)`, and the detector
in wiring logs any failures. The capability still does no logging itself —
capabilities don't log in this codebase, wiring does — so the count is reported
upward rather than printed.

## Test

`TestDetectChangesReportsFailures`, written first: a sweep containing one healthy
connector and one pointed at a missing directory must re-sync the healthy one,
report exactly one failure, and **not** return an error — because a single bad
source may not fail the sweep.
