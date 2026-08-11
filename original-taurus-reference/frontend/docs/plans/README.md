# Plans — active only

A plan lives here **while it is driving work**. The moment it ships it moves to
[`../archive/plans/`](../archive/plans/), and its change records in
[`../archive/records/`](../archive/records/) become the history.

How this differs from the neighbours:

- [architecture/](../architecture/README.md) describes what **exists**, kept in step with
  the code. A plan describes what **should exist** and how.
- [../roadmap/](../roadmap/README.md) says what we intend to build **next**, as a standing
  list. A plan is what a roadmap item becomes when it is big enough to need staged
  commits and settled decisions before anyone starts typing.
- [backend-requests/](../backend-requests/README.md) are asks of *Omega*; plans here are
  front-end intent.

## There is no active plan right now

The next work is listed in [`../roadmap/`](../roadmap/README.md).

This directory used to hold six dated plans, four of them describing completed or deleted
work — a reader could not tell which still mattered. The rule now is mechanical: **if it
is finished, it is not here.** An empty directory is a truthful answer to "what is in
flight?"; a directory of shipped plans is not.

Two archived plans remain the best architecture reference in the repo, and are worth
reading before touching the editor:

- [`2026-07-27-document-subsystem-reorg.md`](../archive/plans/2026-07-27-document-subsystem-reorg.md)
  — the target runtime model (a thin `DocumentRuntime` over `model/{pm-state, selection,
  overlay, sync, presentation, actions}`), the code layout that mirrors it, and the
  settled decisions.
- [`2026-07-27-document-subsystem-issues.md`](../archive/plans/2026-07-27-document-subsystem-issues.md)
  — the issue catalog behind that reorg, every row now closed.

## Writing one

Keep the shape the archived plans use: a status header stating what shipped and what
diverged, the settled decisions, then staged workstreams that each end in a committable,
verified deliverable. Update the status header **as it lands**, not afterwards — an
accurate status is what makes the archived plans still worth reading.
