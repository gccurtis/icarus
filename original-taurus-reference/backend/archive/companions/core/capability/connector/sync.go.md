# sync.go

Syncing a connector's provider content into the knowledge lattice, and bounding
what a failing sync costs. `LatticeWriter` is the seam to knowledge (the real
adapter lives in wiring, keeping the two capabilities independent);
`ProviderFactory` builds a connector's `Provider` from its config. `Sync` always
re-syncs (the manual endpoint); `SyncIfChanged` re-syncs only when the provider
fingerprint moved, and only when the connector is not backing off from a
failure. `applySync` feeds the whole snapshot through one `AddSources` call —
one lattice source per file, keyed by `FileSourceID` — then prunes whatever
vanished and records the new sync state. `DetectChanges` sweeps every connector
across all projects for the background detector. See repo conventions
(AGENTS.md).

## Code breakdown

### `LatticeWriter` — the knowledge seam, taking the whole snapshot

`AddSources` admits a sync's files in one call, carrying each file's source id,
its provider key as a label, its content and the sync sequence as a revision.
`RemoveSource` prunes one; `SourcesUnder` enumerates what a connector currently
has stored.

It takes the whole set rather than one file at a time because both costs behind
it are per-call, not per-file: the embedding provider sees one request per batch
instead of one per file, and the lattice rebuilds its corpus tier once instead of
once per file. Per-file, that loop was a request storm — one provider call and
one project-scale rebuild for as many files as the folder held, which is exactly
the shape a per-minute rate limit exists to stop.

A sync where every file was skipped for size makes no call at all rather than an
empty one.

### `LatticeFile.Key` — the provider's name for a member, not "the filename"

`Key` is whatever the provider identifies a member by. For `local-folder` that is
the path relative to the connector root; for a cloud subkind it will be that
service's item id, which is not a path at all. The field is named for the role,
not for today's only implementation.

The distinction that matters is **path, not name**. `src/a.txt` and `docs/a.txt`
share a base name and are two different files; keying the registry on a name
would merge them into one source, and the merge would be silent — one file's
content serving under the other's id, and excluding one excluding both. Same key
means same file. Same name means nothing. There is a test for each direction: the
same path in two connectors stays distinct, and the same base name at two paths
in one connector stays distinct.

### `SyncResult.Deferred` — a third answer

A sync now has three outcomes, not two: it changed the lattice, it found nothing
to do, or it never ran. `Deferred` is the third — the connector is inside its
retry backoff, or has stopped retrying altogether.

It is a separate field rather than a flavour of `Changed: false` because a
caller counting activity has to tell them apart. "The source had not changed" is
health; "we did not look" is not.

### `SyncResult.Skipped` and `SkippedFile` — a success the caller is told about

A sync that left files out is still a success: one unusable file is a reason to leave
that file out, never to abandon everything beside it. But it is a success the caller
has to hear about, and that was the missing half — the skip existed only as a
`log.Warnf`, and a server's stderr is not where the person who synced a folder is
looking. A file that silently failed to arrive looked exactly like one that arrived.

`SkippedFile` carries the path, a stable `Code`, prose `Detail`, and the arithmetic
(`Size`, `Limit`) where the reason is a bound.

The fields mirror `limit.Exceeded` **without being one**, deliberately. The sync
succeeded and the response carrying this is a 200; modelling a skip as an error
would misreport the outcome. What the two share is the obligation to say what the
bound was and what crossed it.

The reason set will outlive the reason that created it. Today's only entry is the
size bound — itself scheduled to disappear once ingest streams — and what remains
after that are the failures a reader does not fix: an unreadable file, a binary with
no text extractor, a file that vanished between the snapshot and the read. Each of
those is currently a log line nobody sees, which is why the channel is worth
building now.

### `Sync` — the explicit request ignores the backoff

`Sync` clears the attempt count on the record it is about to act on before it
snapshots:

```go
rec.FailedAttempts = 0
```

An explicit sync is a person saying "try now", quite possibly right after fixing
whatever was broken — which is the one moment when waiting out a fifteen-minute
backoff, or refusing because the connector is in its terminal state, would be
exactly wrong.

Restarting the count rather than exempting the request is what keeps the two
paths coherent. If the manual attempt fails too, the automatic path resumes at
the *first* backoff step: a person retrying does not leave the connector stopped
(which would make one failed retry as final as three), and it does not pretend
the connector is healthy either.

### `SyncIfChanged` — deferral comes before the snapshot

The order of the three checks is the whole cost argument. The keyed lock is held
across the fingerprint comparison as well as the write, because reading the
stored fingerprint and then acting on it is a read-modify-write — an unguarded
gap there is what let the detector and an explicit sync both apply the same
change. Then `deferSync` runs, and only then the snapshot.

The snapshot has to come last because it is the expensive half: it reads the
whole source, and everything downstream of it spends provider tokens. Backing off
after paying that cost would not be backing off.

The unchanged branch clears the failure state rather than merely returning. A
reachable source identical to what is stored has nothing left to retry — and the
case this covers is real: a sync that failed *after* the snapshot, inside the
lattice write, leaves the counter armed, and if the source is then reverted the
next genuine edit would start partway to the cap.

### `deferSync` — two reasons not to try, one answer

It reports a deferral when the connector `NeedsAttention` (attempts exhausted) or
when `RetryAfter` is still in the future. Both answer with the connector's
existing fingerprint and sequence, since neither observed anything new.

### `noteSyncFailure` — the memory a reconciliation loop lacks

It records the consecutive-failure count, the cause, and the earliest the
automatic path may try again.

At the attempt cap `RetryAfter` is left **zero**. The connector is no longer
waiting on a clock — it is waiting on a person — and encoding that as a very
distant timestamp would turn a state anyone can read into a piece of arithmetic.
`NeedsAttention` answers it directly instead.

A store write that fails here is logged and swallowed. The caller's error is the
sync's own failure; replacing it with a bookkeeping error would hide the thing
that actually went wrong.

### `clearSyncFailure` — free when there is nothing to forget

It returns without writing when the record carries no failure. The common case is
a healthy connector the detector finds unchanged, every tick, forever; that path
must cost no write.

### `DetectChanges` and `DetectOutcome` — four situations, told apart

The sweep is best-effort per connector: one unreachable source is counted, not
fatal, so it cannot abandon the reconciliation of everything else.

`DetectOutcome`'s four counts exist because four situations look alike from
outside and are not — changed, failed just now, waiting to retry, and stopped.
Counting a deferral as a failure would report a storm of failures that never
happened; counting a stopped connector as unchanged would make it silently
invisible, which is the outcome the retry cap exists to prevent.

Needs-attention is checked here against the record the sweep already holds, as
well as inside `SyncIfChanged`. The duplication buys something: a stopped
connector then costs the sweep nothing at all — not even a lock and a re-read —
which matters when the sweep runs every couple of seconds for the life of the
process.

The doc comment carries the reason the cap has to exist at all. Sync is
reconciliation, not a queue: the decision to sync comes from comparing
fingerprints, so on its own it has no memory of having tried. A connector whose
provider is broken would re-read its source and re-embed every window on every
tick, indefinitely, at provider rates. The failure state on the record *is* that
memory.

### `applySync` reads before it writes

The enumeration of what is already stored happens **before** the write loop. A
file already synced is recognised by its provider key and keeps the id it was
given; only a genuinely new key mints one.

Order is the correctness argument. Minting a fresh id for an unchanged file would
break two things at once: the smart-update path compares a source against the
previous snapshot of *the same* source, so a new id re-embeds every window and
turns a free re-sync into a full one; and anything already pointing at the old id
— a resolved prompt block, a context bound to one file — would be left addressing
a source that no longer exists.

Pruning runs last, against that same enumeration, so a file that vanished from
the provider is removed. Success ends with `SetConnectorSyncState`, which also
clears the failure columns, and a best-effort cascade so dependents refresh.

### Oversized files are skipped, and the skip comes before `want`

A file whose content exceeds `maxFileBytes` is logged and `continue`d rather than
added. It is not an error: one huge file in a folder is a reason to leave that
file out, never to abandon the sync of everything beside it — the same judgement
`IndexAttachment` makes about a PDF it cannot index.

The placement is the subtle part. The `continue` sits **before** `want[sid] =
true`, which means an oversized file is not merely skipped but *pruned* by the
loop below. That is deliberate: the case that matters is a file which has grown
past the bound since it was last synced. Marking it wanted would leave its old,
smaller snapshot in the lattice indefinitely, and retrieval would go on citing
content the file no longer has. Dropping it is the honest outcome — the lattice
says nothing about that file rather than something stale.

The skip is now recorded on `SyncResult.Skipped` as well as logged, so the caller
learns which files did not arrive and why. The log line stays — an operator watching
a server wants it there too — but it is no longer the only record.

### `Files` — the translation point

`Files` lists the connector's synced files, pairing each provider key with the
lattice id minted for it, sorted by key so a client gets a stable order.

This is deliberately the **connector's** method rather than a lattice listing.
The connector minted the ids and it is the only thing that knows what its
provider calls a member — knowledge stores the pair because it had to store both
halves anyway and because a scope exclusion has to resolve against lattice
sources, but it has no business knowing that one subkind's key is a path and
another's is an item id. Keeping the translation here is what stops that
knowledge leaking downward.

It is what "use this connector but not this one file" needs: the caller holds a
name, every scope selection is by source id, and this maps one to the other.

### `ReadFile` — one file, at the cost of a whole snapshot

Returns the current content of one file by the provider's own key for it, reporting
**false rather than an error** when the connector no longer has that file. The source
is external and may have changed since it was synced; that is an ordinary answer.

It snapshots the entire source and picks the file out, which is more work than the
question deserves. `Provider` exposes only `Snapshot()`, so there is no way to ask for
a single member, and adding one means changing `cmd/connector-watcher`'s wire protocol
— a separate binary. Phase 6 of the resilient-ingest design moves the provider to a
per-file reader for streaming ingest anyway, at which point this becomes a single read
for free.

Correct-now-and-slow beats fast-later-and-wrong here because of *where the cost lands*:
this serves a read a person triggers by hand, not the sync path, so one person waits
for one answer rather than the detector paying on every tick.
