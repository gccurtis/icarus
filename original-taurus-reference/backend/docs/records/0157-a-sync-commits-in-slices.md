# 0157 — A sync commits in slices

`AddBatch` embedded every window in a sync, then wrote every source in one
transaction. Peak memory was therefore O(sync), and a failure anywhere discarded
all of it.

The second half is the expensive one. Sync state is recorded only on success, so
a batch that failed left the connector's fingerprint unchanged, the detector
found the source still "changed", and the next tick re-embedded **from zero**.
A sync too large to complete in one attempt never completed at all, and paid full
provider price for every attempt (record 0152 bounded how often that could
happen; this removes the reason it was ruinous).

## What changed

Planned sources accumulate until they hold `commit_window_budget` windows, then
that slice is embedded, clustered, written and released before the next source is
planned. `syncState` holds the slice being filled; `commitSlice` flushes it.

Peak becomes O(slice). Measured, in
`TestWhatASyncHoldsIsBoundedByTheBudget`: the same 60-source batch commits 120
windows in one write unbudgeted, and 2 at a budget of 2.

The bound is `budget + largest single source`, and that second term is not slack.
A source is planned whole before the budget is consulted, which is exactly what
lets a source with more windows than the entire budget be admitted — the budget
is a commit cadence, never an admission limit. Refusing oversized sources is what
the byte cap did, and deleting that is the point of the phase after this one.

## Both batching benefits had to survive

**One embedding call per slice**, not one per window. The provider cost a batch
exists to control is per *call* — a per-minute rate limit counts requests — so a
slice still gathers every source in it into a single `Embed`.
`TestEachSliceMakesOneEmbedCall` pins calls == commits.

The honest caveat: at a budget below a few hundred, a slice holds fewer windows
than `max_batch_inputs` and the sync makes more requests than it needs to. That
is a real cost of a small budget and it is documented in the manifest rather than
hidden. Correctness holds at any budget, including 1.

**One corpus rebuild.** Each slice's write drops the corpus tier and bumps the
project's dirty sequence, but the rebuild is scheduled once, after the loop —
`TestSlicingStillQueuesOneCorpusRebuild`. It is scheduled from a `defer`, so a
sync that fails partway still queues it: the committed slices have already
dropped the tier, and without the defer the project would sit with no corpus tier
and nothing queued to rebuild one until some unrelated write happened.

## The failure slicing introduces

Slice 1 could land under one embedding space and slice 2 under another, if the
route were re-pointed mid-sync. Vectors from two spaces share no basis: they do
not error, they silently retrieve nothing. Retrieval refuses the whole project
with `ErrIdentityMismatch`, and only re-buying every vector repairs it.

So the identity is **pinned to whatever the first slice resolved to**, and a
later slice that disagrees aborts the sync before writing. What is on disk stays
coherent — every committed slice shares the pinned identity — and the sources
that never landed are simply absent, which the next sync sees as changed and
retries.

This is deliberately not the same as `embedPending`'s existing `restale` path.
There, a source that *reused* vectors from a different space is re-embedded in
full, because the correct space is the one the call just resolved to. Here the
committed slices cannot be revisited, so aborting is the only answer that does
not split a project.

## Verification

`TestSlicedIngestBuildsTheSameLatticeAsOneBatch` compares budgets 1, 2, 5 and
1000 against one batch: identical window texts, ranges, per-source forest shapes
and frontier size. It compares those rather than ids on purpose — a window id is
16 random bytes, so two ingests of identical content agree on everything except
their identifiers (the reproducibility problem recorded in 0156).

Two gates were falsified before being trusted. Removing the identity check made
`TestAnIdentityChangeMidSyncAborts…` fail; removing the final flush made the
equivalence test fail on a missing source. Both restored.

`TestASmallBudgetCommitsInSeveralSlices` exists because every other test here
would pass on an implementation that ignored the budget entirely.

## Configuration

`knowledge.ingest.commit_window_budget`, default 2000 — roughly 40MB in flight at
1536 dims, small beside the pairwise matrix a rebuild allocates, which remains the
real memory ceiling. Phase 6 derives this number from system RAM instead of
fixing it.
