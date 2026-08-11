# connector.go

The connector capability: a project-scoped external-source resource of a provider
subkind (first `local-folder`) that names where external content lives. This file
holds the domain (`Connector`, `SubKind`, `Actor`, errors), the `Store` port, the
`Connectors` service (create/get/summaries/configure/rename/delete), the bounds a
sync runs under — one file's maximum size, and the retry budget a failing sync is
allowed — and `FileSourceID`, the lattice source-ID convention sync.go uses to key
each of a connector's files as its own lattice source. It owns only the connector
record and its config: it never reads the filesystem or talks to a provider (that
is sync.go, through the injected `Provider`). See repo conventions (AGENTS.md).

## Code breakdown

### `SubKind` — a closed vocabulary

`local-folder` is the only provider today; `validSubKind` is where the next one is
admitted. Keeping it a closed set means an unknown subkind is rejected at the
creation boundary rather than discovered at sync time.

### `Usage` and `CostRecorder` — a sync's spend is never discarded

A sync's token cost comes back on `SyncResult` and is also handed to an injected
`CostRecorder`, which wiring backs with the telemetry sink. Embedding is the only
part of a sync that costs money, so it is the part that has to be visible
centrally rather than only to whoever called.

### `FileSourceID` composes ids, never paths

A connector file's source id is the connector's id, `FileSeparator`, then the id
minted for that file — not its relative path.

Two reasons, and the second is what forced the change. A path can hold anything a
filesystem permits, and this id is handed to a model as evidence and has to come
back byte-exact as a citation. And the separator itself used to be `\x1f`, chosen
because an unprintable byte cannot collide with a path segment; that reasoning was
sound and became irrelevant once paths left the id, while the byte itself turned
out not to survive a model round trip at all — a live answer came back with U+FFFD
in its place and was rejected as citing evidence that was never retrieved.

The path is not lost: it is stored as the source's label, which is how a file is
recognised in a listing and how `applySync` recovers its id on the next sync.
Prefix enumeration is unchanged — every id a connector owns still starts with
`connectorID + FileSeparator`, so `SourcesUnder` on that prefix enumerates exactly
one connector's files.

### `Connector` — the record, including how its sync is going

Identity and config (`ID`, `ProjectID`, `Name`, `SubKind`, `Path`, `CreatorID`),
then two groups of sync state.

`Fingerprint` / `SyncSeq` / `SyncedAt` describe the last **successful** sync: what
content was synced, a monotonically increasing sequence, and when.

`FailedAttempts` / `LastError` / `RetryAfter` describe a sync that is **failing**:
how many consecutive attempts have failed, why the last one did, and the earliest
the automatic path may try again. All three are cleared by a successful sync.

The second group exists because the first is not enough to stop a loop. Sync is
reconciliation — the decision to sync comes from comparing the source's
fingerprint to the stored one — so a failure that recorded nothing would be
forgotten before the next detector tick, and the whole connector would be re-read
and re-embedded on every tick for as long as the failure lasted.

### `Store` — success and failure are each one write

`SetConnectorSyncState` records a successful sync **and** clears the failure
fields, in one call. A connector that has just synced is not also mid-retry, and
leaving those two facts to separate writes is how they would come to disagree.

`SetConnectorSyncFailure` records the attempt count, the cause and the retry time;
passing zeroes clears them.

### `Connectors` — the service and its bounds

Beyond the store and the injected seams (`providers`, `lattice`, `costs`,
`cascader`), the service carries three things that bound a sync.

`syncing` is a `dispatch.KeyedMutex` serializing a sync against itself, per
connector. Two callers reach the sync path concurrently in normal operation: the
background detector on its interval, and an explicit request. Without it they both
write the same lattice sources and the same connector state at once. Different
connectors still sync in parallel.

`maxFileBytes` bounds one synced file's content, defaulting to 1 MiB to match the
chat attachment bound. The bound is there because there was none: connectors
capped a connector's *name* at 200 bytes and nothing else, so one arbitrarily
large file could be pulled into the lattice, and a file large enough produces
enough windows to dominate a project's retrievable content on its own.

`retry` is the failure budget, below.

### `syncRetry` — three numbers, three different questions

```go
type syncRetry struct {
	maxAttempts int
	backoff     time.Duration
	maxBackoff  time.Duration
}
```

`backoff` is how long to wait after the first failure. `maxBackoff` caps the
doubling, so a long outage settles into a steady, cheap poll rather than an
ever-lengthening one. `maxAttempts` is where automatic retrying stops altogether,
because a sync that has failed that many times is not waiting on a transient
condition.

The defaults — 3 attempts, 30s, 15m — are deliberately patient rather than eager.
A connector sync is not latency-sensitive (nothing is waiting on it) and its
failure modes — an unreachable provider, a rate limit, a folder that has gone
away — resolve on a human timescale or not at all.

### `New`, `UseMaxFileBytes`, `UseSyncRetry`, `UseLogger` — the injection surface

`New` seeds the defaults, including a `Nop` logger so `log` is never nil.

`UseMaxFileBytes` reads its argument in three ranges rather than two: zero
restores the default, negative means unbounded, positive sets the bound. That
exists so configuration can express "no limit" — with only zero-means-unbounded,
an absent config key and a deliberate opt-out would be the same value, and the
safer of the two has to be what you get by saying nothing.

`UseSyncRetry` takes all three retry numbers, keeping the default for any
non-positive one. It offers no unbounded mode, unlike `UseMaxFileBytes`:
unbounded retrying is precisely the defect it exists to remove, so there is no
value that asks for it.

### `NeedsAttention` — derived, not stored

```go
func (c *Connectors) NeedsAttention(rec Connector) bool {
	return c.retry.maxAttempts > 0 && rec.FailedAttempts >= c.retry.maxAttempts
}
```

Such a connector is no longer snapshotted or synced on the detector's interval: it
has failed the same way enough times that continuing to try is spending money on a
condition only a person can clear. `Sync` — the explicit request — clears it.

It is derived rather than stored so the attempt cap remains a configuration value
with one meaning. A stored flag would freeze whatever cap happened to be in force
when the connector failed, and raising the cap would not give an already-stopped
connector the extra attempts it now allows.

### `delay` — the job pool's curve, on purpose

`backoff × 2^(attempts-1)`, capped at `maxBackoff`. It is the same shape as
`job.Pool.backoff`, deliberately: a failing sync and a failing job are the same
problem — an operation whose cause of failure may or may not still be there — and
one backoff curve in the system is easier to reason about, and to tune, than two
that differ for no reason.
