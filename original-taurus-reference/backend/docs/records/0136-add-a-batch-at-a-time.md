# 0136 — Add a batch at a time

The rate limit that started this investigation. A connector's first sync over a
folder made **one embedding provider request per file**, back to back, and
followed each with a project-scale corpus rebuild.

Record 0135 stopped re-adding files that had not changed, which fixes every sync
after the first. This fixes the first one, where every file is genuinely new and
there is nothing to skip.

## Both costs are per call, not per file

That is the whole shape of the fix — the loop was simply at the wrong level.

- **Embedding.** N files meant N provider requests in a tight loop, which is
  precisely what a per-minute request limit exists to stop.
- **The corpus rebuild.** It is O(F²) in the project's entire frontier, so N
  files meant N project-scale rebuilds to arrive at one final state.

Neither gets cheaper by doing less per file. Both collapse by doing more per
call.

## `AddBatch`, and `Add` as one item

`AddBatch(ctx, projectID, []AddItem)` is now the implementation; `Add` calls it
with a single item. One code path, so the two cannot drift.

It runs in phases, and the phases are why `addPlan` exists: every source must be
windowed before any is embedded, and every source embedded before any is
clustered. A single-source `Add` kept that state in locals; a batch has to carry
it per item.

1. **Plan** — read what is stored, drop the no-ops, window, build the reuse map,
   record which texts still need vectors.
2. **Embed** — one call for the whole batch.
3. **Cluster** — per source, mint window ids and ascend.
4. **Commit** — one `ReplaceSources`, one corpus rebuild.

`Store.ReplaceSource` became `ReplaceSources([]SourceWrite, rebuildCorpus)` for
the same reason, with `ReplaceSource` gone rather than kept as a wrapper — there
was no remaining caller that wanted one source specifically.

While there: the four delete statements were written out **verbatim twice**, in
`ReplaceSource` and `DeleteSource`, with nothing keeping them in step. They are
now `deleteSourceLatticeTx`.

## What batching costs

**Per-source usage became an attribution.** The provider bills the batch, so no
per-source token figure is a measurement any more. `shareUsage` splits it by each
source's share of the inputs.

That is an approximation, and it is worth being explicit rather than quiet about
it, since `AGENTS.md` requires a run's price to be reported in full. The
alternative considered — charging the whole batch to every source — would make a
sync's reported cost scale with the file count rather than the tokens spent,
which is wrong by a much wider margin than an even split.

**Ordering became the risk.** Vectors are scattered back to sources by recorded
position, and a slip attaches *plausible* vectors to the wrong source. Nothing
downstream can detect that: every vector is individually valid, retrieval just
quietly returns the wrong thing.

So the tests do not check counts. `TestAddBatchLandsVectorsOnTheRightSource`
gives three sources disjoint vocabulary (birds / engines / bread) and requires a
query in each vocabulary to retrieve *that* source, with deliberately uneven
window counts so a fixed-stride scatter would fail. At the intelligence layer,
`chunkRecorder` encodes each input's identity into its vector, so a chunk
concatenation off by one cannot pass.

## What did not change

**A failed embed still leaves the lattice untouched.** The embed happens before
any write, and the write is one transaction — so a rate limit remains a retryable
inconvenience rather than data loss. That property is what makes the whole design
safe to run against a provider that refuses work, and
`TestAddBatchFailureLeavesTheLatticeUntouched` pins it.

**Identity drift is still caught.** A source holding vectors from a different
space than the batch resolved to is re-embedded in full — as its own batch, not
one call per source. Mixing spaces does not fail loudly; it silently retrieves
nothing.

## Also in this slice

`intelligence.Embed` chunks internally (record in the same commit range), so "one
call" here means one request per `max_batch_inputs` windows rather than one
enormous request. A large batch is bounded in both directions: never one request
too big to accept, never one request per source.
