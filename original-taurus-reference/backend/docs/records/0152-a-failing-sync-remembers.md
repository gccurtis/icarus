# 0152 — A failing sync remembers

Phase 1 of the resilient-ingest design
([spec](../superpowers/specs/2026-07-29-resilient-ingest-design.md)). It removes
the program's one unbounded cost.

## The defect

Connector sync is **reconciliation, not a queue** — deliberately, and record 0121
explains why. The decision to sync comes from comparing the source's fingerprint to
the stored one, so an interrupted sync simply happens again on the next tick and
never needs a durable job.

The consequence nobody had followed through: a *failed* sync recorded **nothing**.
Sync state is written only on success, so the failure left the stored fingerprint
untouched, so the next detector tick — two seconds later — compared the same two
values, reached the same conclusion, and re-read the source and re-embedded every
window from zero. There was no attempt counter to stop it.

Record 0151 saw this happen and read it as a virtue: a manual sync 500'd mid-embed
and "the 2s change detector retried and completed the whole sync unaided.
Self-healing." It was, that time, because the failure was transient. Against a
provider that stays broken it is a loop that bills, and at 100k files a lap is
~200M tokens and ~$4 — every two seconds.

## What the record now carries

`Connector` gains `FailedAttempts`, `LastError` and `RetryAfter` (plus columns,
defaulted so every existing connector arrives with a clean budget). The state
machine is three transitions:

- **Success** clears all three, in the *same* `SetConnectorSyncState` write that
  records the sync. Success is what ends a failure, so it is one fact and gets one
  statement — split in two, there would be a window where a connector had both a
  fresh sync and an armed counter, and since the counter suppresses syncing the
  disagreement would end in a healthy connector stopping itself.
- **Failure under the cap** increments the count, records the cause, and sets
  `RetryAfter` to `now + backoff × 2^(attempts-1)`.
- **Failure at the cap** increments and leaves `RetryAfter` **zero**. The connector
  is no longer waiting on a clock; it is waiting on a person.

`SyncIfChanged` checks all of this **before** the snapshot. That ordering is the
whole cost argument: the snapshot reads the whole source and everything downstream
of it spends provider tokens, so backing off after paying that would not be backing
off.

## Two decisions worth the words

**Needs-attention is derived, not stored.** `NeedsAttention(rec)` is
`rec.FailedAttempts >= maxAttempts`, evaluated against current configuration. A
stored flag would freeze whatever cap happened to be in force when the connector
failed, and raising the cap would not give an already-stopped connector the
attempts it now allows. The cost is that the HTTP `view` had to become a method —
only the service knows the cap — which is cheaper than a second copy of a
configuration value.

**An explicit sync restarts the count rather than being exempt from it.**
`POST /connectors/{id}/sync` ignores the backoff and clears the terminal state,
because it is a person saying "try now", quite possibly having just fixed the thing
— the one moment when waiting out fifteen minutes is exactly wrong. But it restarts
the count instead of declaring the connector healthy: if the manual attempt fails
too, the automatic path resumes at the *first* backoff step. A person retrying
should not leave the connector stopped (that would make one failed retry as final
as three), and should not pretend nothing is wrong either.

There is also a third clearing path that is easy to miss: a snapshot that
**succeeds and matches** the stored fingerprint clears the failure. That covers a
sync that failed *after* the snapshot, inside the lattice write — the counter is
armed, and if the source is then reverted, nothing else would ever disarm it, so
the next genuine edit would start partway to the cap.

## Telling four situations apart

`DetectChanges` returned `(changed, failed int)`. Deferral broke that: a connector
waiting out its backoff is not a failure and is not "unchanged" either. It now
returns a `DetectOutcome` with four counts — changed, failed, deferred, attention —
because counting a deferral as a failure would report a storm of failures that never
happened, and counting a stopped connector as unchanged would make it silently
invisible, which is the single outcome this phase exists to prevent.

The detector's logging follows the same distinction. A failure this tick is news
every time. A stopped connector is a *standing condition*, so its count is logged
only when it changes — at a two-second cadence, repeating it would bury everything
else.

## Configuration

Numbers only, per the standing rule — and these are ceilings on spend rather than
preferences:

```yaml
connectors:
  sync:
    max_attempts: 3
    backoff: "30s"
    max_backoff: "15m"
    detect_interval: "2s"
```

`detect_interval` was a hard-coded `2s` in the composition root. The backoff curve
is `job.Pool`'s (`base × 2^(attempts-1)`, capped), reused rather than reinvented: a
failing sync and a failing job are the same problem, and one curve in the system is
easier to tune than two that differ for no reason.

Unlike `max_file_bytes` there is deliberately **no** unbounded mode. Unbounded
retrying is the defect; no value should be able to ask for it.

## Gates

Seven tests in `sync_retry_test.go`, over a scripted provider and a hand-advanced
clock so real durations are exercised without a test that waits minutes. The
load-bearing assertion in each is the **provider call count**: a deferral that still
snapshotted would not be a deferral. Coverage is the cap, the deferral inside
backoff, the manual override in both outcomes, the unchanged-source clearing path,
the detector's accounting, and the backoff curve.

## Also fixed in passing

Three doc comments in `config.go` still described the flags records 0148–0149
removed — `descent.audit`, the sparse-path enable flag, and the `max_pool` refusal.
The YAML was corrected when those flags went; the Go comments were not. Corrected,
along with the `wiring.go.md` sentence about "the flag that switches over-bound
pools to sparse clustering".

Four companions (`connector.go.md`, `sync.go.md`, `config.go.md`, and the connector
handler's) were still reproducing whole files verbatim, from before the prose-first
convention, and had drifted — `sync.go.md` still showed a single-file `AddSource`
that has not existed for several commits, and `config.go.md`'s copy of `Config` was
missing the `Connectors` section entirely. Rewritten as prose with excerpts where an
excerpt earns its place.
