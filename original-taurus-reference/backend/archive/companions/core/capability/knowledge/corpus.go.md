# `corpus.go`

Maintains the cross-source corpus tier, **off the write path**.

A write drops the tier and bumps the project's dirty sequence; nothing rebuilds
it synchronously. That split exists because the rebuild is O(F²) in the
project's whole frontier — 7.8 s at 4,000 artifacts, measured — and running it
inside the write transaction meant every other write in the project waited on it.
It is why the pool bound could not simply be raised: a larger bound bought longer
write stalls.

## Why the tier is dropped, not left stale

The write that invalidates the tier may have deleted the very nodes and windows
the old tier points at. Leaving it would let descent follow a corpus root into
dangling members and return less while looking like it worked — a silent recall
hole.

With no tier at all, `EntryFrontier` returns source roots and orphan windows and
retrieval enters there instead. That is a path the design already declares valid
(see `build.go`), so the degradation is a flatter entry frontier rather than a
hole. Flatter and honest beats faster and wrong.

## Code breakdown

### `JobTypeRebuildCorpus` and `rebuildPayload`

The background job that rebuilds one project's tier, registered against the
shared `job.Registry` in `core/wiring/wiring.go` beside `document.JobTypeRebase`.
The payload carries only the project id.

### `queueCorpusRebuild`

Schedules a rebuild after a successful write. **Best-effort by design**: the
corpus tier is an optimization over the source frontiers, so failing to schedule
degrades retrieval rather than failing the write that triggered it. The dirty
sequence is already persisted at that point, so nothing is lost — a later write
(or a manual rebuild) still picks the project up. The failure is logged, not
returned.

A nil `Enqueuer` means rebuilds are never scheduled. That is what a test uses to
drive `RebuildCorpus` by hand rather than racing a worker — the same code path
production takes, just called synchronously.

### `RebuildCorpusJob` and `RebuildCorpus`

`RebuildCorpus` is idempotent and **cheap when there is nothing to do** — it
compares the sequences and returns without reading a vector. That is what makes
over-scheduling harmless: several writes in a row may each queue a job, and every
job after the first finds the tier current and exits immediately. No coalescing
machinery is needed.

The clustering deliberately runs **outside any transaction**. The sequence is
read first and handed back to the store with the result:

```go
dirty, built, _ := k.store.CorpusSeq(projectID)
if dirty == built { return nil }
frontier, _ := k.store.SourceFrontier(projectID)
stored, _ := k.store.CorpusIndexes(projectID)
corpus, indexes, outcomes := k.buildCorpusIndexed(projectID, frontier, stored, k.now().UTC())
return k.store.RebuildCorpus(projectID, corpus, dirty, indexes)   // claims `dirty`, not "now"
```

The stored indexes ride the same read phase and the updated ones ride the same
write, so a rebuild is still read → compute → short write. The clustering
itself is `buildCorpusIndexed` ([`repair.go`](repair.go.md)), which decides
per level whether the rebuild is a local repair or a consolidation; its
`outcomes` are logged one line per sparse level — the operator's answer to
"was that write a local event, and if not, why not".

Claiming `dirty` rather than the store's current value is the whole safety
argument. A write landing mid-computation pushes the dirty sequence past what
this rebuild claims, so the tier is stored and the project *still reads as
stale* — the next job picks it up. Nothing is lost, and no write ever waited on
the clustering. A boolean flag could not express this: the intervening write's
own rebuild would clear it and that change would vanish.

The two halves are **timed separately**, and that split is the point: loading is
I/O plus vector decoding and grows linearly with the frontier, while clustering
is the O(F²) ascent. A rebuild that has become slow is a different problem —
and a different fix — depending on which half grew. One combined number would
only say "slow".

```text
info: knowledge: rebuilt the corpus tier for project 3e99… — 1 frontier entries
      in 1ms (load 1ms, cluster 0s), 0 node(s)
```

That line is also the only direct evidence the deferred rebuild actually ran: the
job pool logs nothing on success, and retrieval degrades gracefully without a
corpus tier, so a rebuild that never fired would otherwise be invisible.

There is no refusal outcome any more: `max_pool` is the crossover between the
exact and sparse constructions, and every frontier clusters — exactly below
it, over the k-NN graph above it.

### `CorpusCurrent`

Reports whether the tier reflects every write. It exists for tests, and for an
operator asking whether a rebuild is pending.
