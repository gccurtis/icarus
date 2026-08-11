# 0138 — The rebuild leaves the write path

The corpus rebuild ran inside the write transaction. Record 0137 measured what
that costs: 7.8 s and 458 MB at a 4,000-artifact frontier, quadratic from there.
Since SQLite serializes writers, every one of those seconds was time no other
write in the project could proceed.

That is why `max_pool` could not simply be raised. A larger bound bought a longer
write stall, so the guard was pinned by write concurrency rather than by memory.
This decouples the two.

## What a write does now

`ReplaceSources` and `DeleteSource` write their rows, **drop the corpus tier**,
bump the project's dirty sequence, and commit. `knowledge.queueCorpusRebuild`
then schedules a `knowledge.corpus.rebuild` job, registered against the existing
durable queue beside `document.rebase`.

Nothing waits on the clustering.

## Dropping, not staling

The old tier is deleted rather than left in place, and that is deliberate.

The same transaction may have deleted the node and window ids the old tier
points at. Left alone, descent would enter at a corpus root, follow its member
ids into nothing, and return fewer results while appearing to work — a silent
recall hole, which is the worst failure shape available here.

With no tier at all, `EntryFrontier` returns source roots and orphan windows and
retrieval enters there. That is a path the design already declares valid, so the
degradation is a flatter entry frontier: honest, and visible in the audit numbers
rather than hidden.

## A sequence pair, not a dirty flag

`knowledge_corpus_state` holds `(dirty_seq, built_seq)` per project.

The obvious design is a boolean, and it is wrong here. The whole point is that
the rebuild clusters **outside** a transaction, so a write can land while it is
computing. With a flag, that write sets dirty, the in-flight rebuild finishes and
clears it, and the write's change is never clustered — lost, silently, with the
project reporting itself current.

With a sequence, the rebuild claims only the value it read *before* computing:

```go
dirty, built, _ := store.CorpusSeq(projectID)
if dirty == built { return nil }
frontier, _ := store.SourceFrontier(projectID)
corpus, _ := k.buildCorpus(projectID, frontier, now)
return store.RebuildCorpus(projectID, corpus, dirty)   // `dirty`, not "now"
```

An intervening write has already pushed `dirty_seq` past that, so the tier is
stored and the project *still reads as stale*. The next job picks it up. Nothing
is lost and no write waited.

`TestAWriteDuringARebuildLeavesTheProjectStale` pins exactly this interleaving.

## No coalescing machinery

`RebuildCorpus` compares the sequences first and returns without reading a vector
when they match. So N writes may queue N jobs and every job after the first exits
immediately.

That is cheaper than the alternatives — tracking in-flight jobs, or a debounce
timer — and it has no race to get wrong. It is also why `queueCorpusRebuild` can
be best-effort: the dirty sequence is already persisted, so a failed enqueue
degrades retrieval until some later write schedules one, rather than losing
anything. A failure to schedule must never fail the write that triggered it
(`TestAFailedScheduleDoesNotFailTheWrite`).

## Testing what we ship

Tests drive `RebuildCorpus` directly rather than getting a synchronous fallback
when no `Enqueuer` is configured. A nil enqueuer means "nobody schedules
rebuilds" — not "rebuild inline" — so the test exercises the same code production
runs, just called by hand instead of by a worker. Per record 0129, a test-only
path through the lattice is not worth the determinism it buys.

Existing tests that asserted on the corpus tier now call `RebuildCorpus`
explicitly, which is also a readable statement of the new contract: the tier
exists after a rebuild, not after a write.

## What this unblocks

`max_pool` is now bounded by memory alone, not by how long a write may block. It
is left at 4,000 in this record — raising it is a separate decision with the
measured numbers from 0137 in hand — but the reason it *could not* move is gone.
