# 0121 — A connector's sync must be serialized against itself

The live model-backed suites found a production bug the unit suite could not:
two callers reach the connector sync path concurrently in normal operation, and
nothing serialized them. This record fixes it and documents how it was found,
because *how* it was found is the point.

## The symptom

Running `./dev-test/run.sh intelligence`, the `context-scope` suite failed
intermittently — roughly half of runs — with:

```text
POST /connectors/<id>/sync
✗ expected status 200, got 500   {"error":"connector error"}
```

The same run would pass on the next invocation. The underlying error was
invisible: the connector handler's `default` error arm maps any unrecognized
error to a generic `"connector error"` without logging it, so from the outside
there was nothing to distinguish a transient hiccup from a real defect.

## The cause

Two entry points reach `applySync` for the same connector:

- the **background change detector**, ticking every `connectorDetectInterval`
  (2s) and calling `SyncIfChanged`, and
- an **explicit** `POST /connectors/:id/sync`, calling `Sync`.

Neither took a lock. When a tick landed while an explicit sync was in flight,
both walked the same read-modify-write — read the stored fingerprint, feed the
lattice one source per file, prune vanished sources, record the new sync state —
interleaved. Go's race detector confirms it is a genuine data race, not merely
an unfortunate ordering.

This is the same shape as `BUG-1` from the review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)): an unguarded
background loop racing a foreground request over shared state. Twice now, so it
is a class: **any state a reconciler loop touches must be serialized against the
request path that touches the same state.**

## The fix

`Connectors` gains a `syncing dispatch.KeyedMutex`, keyed per
`(projectID, connectorID)`. Both `Sync` and `SyncIfChanged` hold it for their
whole body — across the fingerprint comparison as well as the write, because
reading the stored fingerprint and then acting on it is itself a
read-modify-write; guarding only `applySync` would leave the decision racy.
Different connectors still sync in parallel.

This reuses the same `dispatch.KeyedMutex` that backs the serial request path,
which is exactly what it is for: a lock on a per-operation key.

## Why the unit suite never caught it

All 41 packages were green under `-race` — because no unit test ran the
detector and an explicit sync against each other. It took a running server with
the detector actually ticking, driven by the live suites, to expose it. That is
the standing argument for running the model-backed dev-tests before declaring
work complete, not treating them as optional.

## Test

`TestConcurrentSyncsDoNotRace`, written first and watched fail: 25 rounds of
`Sync` and `SyncIfChanged` driven at the same connector from two goroutines.
Red under `-race` ("race detected during execution of test"); green after the
mutex, `-race -count=3`. The live verification is recorded in
[0123](0123-live-suite-repairs.md).
