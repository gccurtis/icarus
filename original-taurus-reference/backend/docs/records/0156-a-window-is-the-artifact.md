# 0156 — A window is the artifact; a source is a pointer to one

The lattice kept a whole second copy of every document, file and connector
member — `knowledge_sources.text` — and produced cited text by slicing it. It is
gone. Phase 4 of the resilient-ingest design, in four commits:
`67cb84d`, `2690397`, `af6aa82`, and this one.

## Why the copy was wrong

Not primarily for its size, though it was 1.0× the corpus for nothing. It was
wrong because **a copy can disagree with the thing it copies, and nothing here
would say so.**

A document's text lives in the document capability, a file's in the file store, a
connector member's at its origin. Each of those can change without the lattice
hearing about it. When they do, the lattice's copy keeps serving — well-formed,
plausible, and describing a file that no longer says that. Every response is a
200. The characteristic failure of this subsystem is not a crash; it is a
citation that resolves to the wrong place.

The copy also had to be right about *ranges*, not just bytes. `resolveRegion`
sliced `src.Text[start:end]` behind an `end <= len(src.Text)` guard — a guard
that existed precisely because the range and the stored text could disagree, and
whose only behaviour when they did was to return empty text with no error.

## What replaced it

**A window carries what a citation needs.** Its own text and the block refs that
text covers, written in the same pass, from the same snapshot, as the range
(`67cb84d`). Both halves therefore cannot drift: the invariant is structural
rather than checked. Old rows were filled in by `backfillWindowText`, a pure
local computation — embeddings are the one thing here that costs real money, so
a migration that re-embedded would bill the user to recover data already on disk.

**Regions stitch instead of slicing** (`2690397`). Merging A[0,4000] with
B[3600,7600] is `A.text + B.text[A.End-B.Start:]`, which is only sound because
window starts strictly increase and ends never decrease — `windowSpans`
guarantees it, and `planAdd`'s reuse inherits ids and vectors but never ranges,
so one source's windows always come from one windowing pass. The old
implementation is kept in the test file as a differential oracle. It was
falsified before being trusted: a deliberate one-byte error in the stitch made it
fail in ten places.

**Whole-source reads go to the origin** (`af6aa82`). Knowledge declares a
`SourceReader` port; wiring implements it per source type, mirroring
`LatticeWriter` in reverse so neither capability imports the other. This replaced
a plan to reassemble whole sources from window text, which was the same
second-copy mistake rebuilt one layer down — and would not have worked anyway,
since all-whitespace windows are dropped and can leave a silent hole. It also
means a read of a source whose origin is gone now fails rather than serving a
stale copy. That is the intended behaviour, not a regression.

**A source keeps three numbers instead of its text** (this commit).
`size_bytes` and `line_count` are what `knowledge.list` reports — it previously
loaded every source in the project in full to produce two integers per row.
`content_hash` is what `unchangedFrom` compares, replacing a whole-string
comparison that cannot survive streaming ingest: a 5MB file can be hashed as it
is read, but comparing strings means holding both.

`SourcesByRef` stopped selecting text as well. It is on the query path, once per
retrieval, so the cost of answering a query no longer scales with the size of the
files it happened to hit.

## The one step that destroyed data, and how it was fenced

Blanking the column is irreversible, and where an origin has since been deleted
the erased copy was the last one. Three decisions bound that:

1. **No `DROP COLUMN`.** This store's migration model is additive — nothing is
   renamed or dropped in place. The column stays and is blanked. Same storage
   outcome; a real drop becomes optional cleanup rather than a load-bearing step.
2. **Gated per source** on every one of that source's windows already carrying
   its own text. A half-finished window backfill therefore cannot erase text
   whose replacement does not yet exist, and a single stale window cannot pin the
   whole project's copy in place.
3. **Metadata is derived before the text is erased**, in that order, in `Open`.

Both fences were falsified rather than assumed. Removing the `NOT EXISTS` clause
made the gate tests fail; swapping the two migration steps made the ordering test
report `0 bytes` and the hash of the empty string. Restored, both pass. A gate
that has never failed is decoration.

`knowledge.ContentHash` and `knowledge.CountLines` are exported for the same
reason `CoveredBlocks` was: the migration filling those columns in has to compute
them exactly the way ingest does. A hash derived even slightly differently would
make every migrated source compare as changed and re-cluster on its first sync —
a cost with no error attached to it.

## What this unlocks

Nothing downstream now wants a source's whole text, which is what makes Phase 6's
streaming ingest a change to the reader rather than a change to everything. Peak
memory during a sync stops being bounded below by the corpus size.

## Also in this commit: the nondeterminism was ours

While reviewing before the destructive step, the explanation recorded for the
scale suite's flaky threshold turned out to be wrong. It had been attributed to
provider float noise by elimination, and never tested.

The real chain: `newID()` is `crypto/rand`, so a fresh ingest mints random window
ids and node ids inherit them through content-addressing; `EntryFrontier` orders
by id, so the frontier arrives in a fresh random permutation; `sampledSims` draws
pairs by *index* under a fixed seed, so the same positions hold different
vectors. Above `thresholdSampleBudget` the percentile is order-dependent. The
scale suite lowers `max_pool` to 256 so its corpus tier runs sparse, and 664
frontier entries is 220,116 pairs against a 200,000 budget — just over the line,
which is why it shows there and essentially nowhere else. Two orders of the same
vectors gave 0.779328 and 0.788097.

Clustering is still a pure function of its inputs. One of its inputs is randomly
ordered. Within a database ids are stable and repair works; across fresh ingests
of identical content the lattice differs. It is a reproducibility problem, not a
correctness one, and it survived because nothing asserts reproducibility.

The fix — content-addressed window ids over `(localRefID, text, occurrence index
among identical texts)` — is agreed in principle and deliberately not bundled
here. Corrected in `876eff3`; the full account is in
[`archive/orientation/resilient-ingest.md`](../../archive/orientation/resilient-ingest.md).
