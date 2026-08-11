# Resilient ingest: self-contained artifacts, bounded retries, sliced commits

*Design, 2026-07-29. Follows records 0134–0151.*

> **Picking this up cold?** Read
> [`archive/orientation/resilient-ingest.md`](../../../archive/orientation/resilient-ingest.md)
> first. It carries the state around this plan: what has landed, the invariants that
> fail *silently* if broken, the facts verified against the code, and the mistakes
> already made here. This document is the plan; that one is why to be careful with
> it.

## Progress

**Complete, 2026-07-30.** All seven phases landed. What is still open is in
[`docs/architecture/issues-and-gaps.md`](../../architecture/issues-and-gaps.md)
under *Ingest* (ING-1 … ING-6), not here.

| Phase | Commit | Record |
| --- | --- | --- |
| 1 — Cap the retry loop | `dca0408` | 0152 |
| 2 — Real rate-limit patience | `e76e436` | 0153 |
| 3 — Typed limits, nothing silent | `79ee190`, `b8ba4aa` | 0154, 0155 |
| 4 — The window becomes self-contained | `67cb84d`, `2690397`, `af6aa82`, `4a5710b` | 0156 |
| 5 — Sliced commits | `ef04a11` | 0157 |
| 6 — Streamed ingest and derived caps | `cc5badc`, `8311bb2` | 0158 |
| 7 — One indexed ascent | `087c907`, `ed619f5` | 0159 |

Two things landed after the plan that it did not call for, and both came out of
doing the work:

- **Content-derived ids** (`492aed2`, record 0160). Window ids were random, and
  since both frontier queries order by id and the sparse threshold sample draws
  pairs by index, a fresh ingest of identical content built a *different lattice*.
  The plan assumed clustering's determinism was sufficient; it was, and one of its
  inputs arrived shuffled.
- **`max_pool` 4000 → 2000** (`815ff7e`). Phase 7 timed the crossover for the first
  time. The old value came from a memory budget and was never a measurement, and at
  4,000 the 2,000–4,000 band got the slower construction *and* no incremental
  clustering.

Corrections made to this document while it was live, each recorded in place: the
byte cap is **deleted** rather than raised (`fc757aa`); whole-source reads come from
the **origin** through a `SourceReader` port rather than from reassembled windows
(`93cd569`); `SourcesByRef` does not disappear; Phase 5 must pin the embedding
identity across a whole sync; and companion docs were retired mid-programme, so the
verification section no longer names them.

## Where we already are

The scaling program is landed and green. For context after a compaction, what
**is** built:

- **Batched ingest** — a connector's whole snapshot is one `AddBatch`, one
  chunked embedding stream, one deferred corpus rebuild (0135–0136).
- **Corpus rebuild off the write path** — deferred to a coalesced background
  job (0138).
- **float32 BLOB vectors** — 58× faster decode (0139).
- **Stable ids** — windows inherit ids; nodes are content-addressed from their
  member set (0140).
- **Sparse clustering** — k-NN graph over a PCA/IVF index above the `max_pool`
  crossover; verified-neighbourhood fallback for clusters larger than k
  (0141–0143).
- **Incremental clustering at the corpus tier** — the level index (k-NN graph,
  pinned threshold, PCA basis, IVF cells) is persisted; a rebuild diffs the
  frontier **by artifact id** and *repairs* it locally when the changed
  fraction and the threshold's measured drift are both under bounds,
  consolidating only when they are not. Measured **15.7×** on a 1% delta at
  20k artifacts (0144–0146).
- **Retrieval probe** — descent enters through the persisted index (0147).
- **No mechanics flags** — construction chosen by pool size, probing by index
  presence, retrieval is always descent (0148–0149).
- **Validated on a real 596-file corpus** — one 19s sync, 1.21M tokens
  ($0.024), a one-file edit repairing at `+1 −1 of 665, drift 0.0003` (0151).

This design does not revisit any of that. It addresses the **write path's
resilience**, plus one storage mistake that makes resilience harder than it
needs to be.

## The storage correction (the root of the rest)

`knowledge_sources.text` stores a **whole second copy** of every source, and
cited region text is produced by slicing that copy in memory
(`regions.go:121-131` → `src.Text[start:end]`, fed by `SourcesByRef`). The
lattice is not a second storage for documents or files — they already live in
the document capability, the file store, or the connector's origin.

**Each window should be self-contained**: its own text, the byte range that
text occupied in the source *at the time it was indexed*, the block refs it
covers, and its vector. Retrieval then returns artifacts that already carry
their text — it never loads a source's bytes at all. The source row keeps
metadata only (label, origin, identity, size, line count, content hash,
timestamps).

This is what makes streaming ingest simple rather than invasive: with nothing
downstream wanting whole text, a file can be read, windowed, and released in
bounded memory. Storage goes from 1.0× the corpus to ~1.1× (windows overlap by
design), and a whole class of read disappears.

## The five defects the audit found

1. **Unbounded repeated spend.** `AddBatch` embeds every window before writing
   any, so one failed chunk discards the whole batch. Sync state is recorded
   only on success, so the 2s detector re-syncs and **re-embeds from zero**,
   forever, with no attempt counter. At 100k files that is ~$4 and 200M tokens
   per lap.
2. **7 seconds of rate-limit patience.** `max_attempts: 4` × `backoff: 1s`
   doubling = 1+2+4s, against per-*minute* limit windows. `Retry-After`
   ignored.
3. **Timeouts abort instead of retrying.** Verified empirically:
   `http.Client{Timeout}` yields an error satisfying
   `errors.Is(err, context.DeadlineExceeded)`, so `shouldFallover` returns
   false and the embed gives up with no retry — exactly when load is highest.
4. **Silent skipping.** A file over `max_file_bytes` is dropped with only a
   `log.Warnf` (`connector/sync.go:255`); nothing reaches `SyncResult`. A
   1,000-page textbook (~5MB) exceeds the 1MiB cap and vanishes. Separately,
   **exactly one handler sets `endpoint.Response.Err`** — `chatErr`, from record
   0130 — so the practice exists and never spread, which is why record 0121's race
   hid behind `{"error":"connector error"}`.
5. **No artifact ceiling.** Removing the `max_pool` refusal (`5591a44`) was
   right — it was a *clustering* ceiling the sparse path obsoleted — but
   nothing replaced it as an *ingest* ceiling. The wall is RAM: a rebuild holds
   every frontier vector, ~12KB per artifact at 1536 dims, so ~200k artifacts ≈
   2.4GB. Crossing it OOMs rather than refusing.

**Also worth knowing:** vectors are as large as the text (a 5MB textbook is
~1,250 windows ≈ 15MB of vectors), so streaming text alone caps ~25% of peak.
**Sliced commits** are what bound everything — and they fix defect 1 too.

**Decisions taken:** commit in slices (partial progress persists, retries
resume); caps derived from system RAM with config overrides.

## What the caps are, and what each one really bounds

Worth stating plainly, because they are not the same kind of thing and one of them
was pretending.

| Setting | Bounds | At the limit |
| --- | --- | --- |
| `connectors.sync.max_attempts` / `backoff` / `max_backoff` | repeated spend on a failing connector | needs-attention (0152) |
| `intelligence.embedding.max_wait` | one chunk's total waiting | surfaces the rate limit (0153) |
| `intelligence.embedding.max_batch_inputs` | inputs per provider request | splits into more requests |
| `knowledge.cluster.max_pool` | **nothing** — the exact↔sparse crossover | switches construction |
| `knowledge.ingest.commit_window_budget` | windows resident per commit | commits and releases |
| `knowledge.ingest.max_artifacts` | the project frontier held in RAM | typed refusal |
| ~~`connectors.max_file_bytes`~~ | one file's content | **deleted — see below** |

Three kinds: **spend** bounds, **pacing** bounds, and one real **resource ceiling**
(`max_artifacts`). `max_pool` is in the table only to say it belongs to none of
them.

### Why `max_file_bytes` is deleted rather than raised

It looks like a resource ceiling and is not one.

**It does not bound what it appears to.** `localfolder.go:31` reads every file with
`os.ReadFile` and holds them all in one `[]FileEntry` snapshot, so the exposure is
the whole folder while the bound is per file: 596 × 1 MiB passes at ~600MB resident,
and a single 2 MiB file is refused.

**Both of its stated reasons are gone.** The code says a large file's "windows alone
can approach the clustering bound" — that referred to the `max_pool` *refusal*,
deleted in `5591a44`. And "would dominate a project's retrievable content rather
than contribute to it" is a quality argument that contradicts the goal: a project
whose only source is a textbook *should* be dominated by it.

**Nothing left over wants a byte cap.** After the reader, text is O(window).
Vectors stay proportional to size (a 5MB file ≈ 1,389 windows ≈ 17MB) and are
bounded by the commit slice. The source-tier pairwise matrix is bounded by the
crossover, which applies per level including the window level
(`lattice.go:577`) — a source over `max_pool` windows clusters sparsely by itself.
Cost is ~$4/GB and is a budgeting question, not a correctness one.

What remains is a **provider** property, not a system budget: a provider that cannot
stream (an HTTP body it must buffer) bounds its own reads, exactly as
`file.DefaultMaxSize` bounds one upload. That is not configuration this plan owns.

---

## Phase 1 — Cap the retry loop

Stops the unbounded spend. Smallest change, highest risk removed.

- `connector.Connector` (`connector.go:84-96`) gains `FailedAttempts`,
  `LastError`, `RetryAfter` (+ migration columns).
- `SyncIfChanged` skips a connector whose `RetryAfter` is in the future;
  `applySync` failure increments attempts and backs off. At `max_attempts` the
  connector enters a terminal **needs-attention** state — no more automatic
  syncing, surfaced on the record so the front end can say "sync failing,
  contact your administrator". An explicit `POST /sync` clears it and retries.
- Detector interval (`connector_lattice.go:18`, hard-coded `2s`) becomes
  config.
- Reuse the job pool's backoff shape (`job/pool.go:190-199`:
  `base × 2^(attempts-1)`, capped) rather than inventing one.

Config `connectors.sync`: `max_attempts: 3`, `backoff: "30s"`,
`max_backoff: "15m"`, `detect_interval: "2s"`.

## Phase 2 — Real rate-limit patience

- **Honor `Retry-After`.** `openrouter.go:322-326` wraps a 429 as a bare
  `ErrRateLimited`; make it a typed error carrying the header's delay so the
  retry waits what the provider asked instead of guessing.
- **Budget, not attempt count.** Replace `max_attempts` with `max_wait: "90s"`
  as per-chunk total patience — the honest expression of "wait a minute or
  two".
- **Timeouts become retryable.** The provider wraps its own client timeout in a
  distinct `ErrProviderTimeout` *before* it escapes, so `shouldFallover` still
  treats a caller-cancelled context as fatal while retrying a slow provider.

Config `intelligence.embedding`: keep `max_batch_inputs: 96`, add
`max_wait: "90s"`, keep `backoff: "1s"` as the floor between tries.

## Phase 3 — Typed limits, nothing silent

- New `core/platform/limit`: one structured error carrying `Code`, `Message`,
  `Limit`, `Actual`, `Subject` — following the repo's precedent
  (`document.AdmissionConflict`, `formula.FormulaError`), shared because every
  handler must map it identically.
- `SyncResult` gains `Skipped []SkippedFile{Path, Reason, Size, Limit}`,
  returned in the sync response. **No file is dropped without the caller being
  told.**

  The channel outlives the reason that motivated it. `too_large` retires in Phase
  6 when the cap goes, but a file can still fail to be admitted for reasons the
  reader does not fix — unreadable permissions, a binary with no text extractor,
  a file that vanished between the snapshot and the read — and each of those is
  today a `log.Warnf` nobody sees. Build it for the set that survives.
- Handler error bodies gain `code` and the limit fields beside `error`, so the
  front end branches on a value, not prose.
- **Every handler sets `endpoint.Response.Err`** so `requestlog.AttachError`
  records the cause — the plumbing exists (`endpoint.go:34-38`) and is unused.
  Retire the generic `"connector error"` default arm.

## Phase 4 — The window becomes self-contained

The storage correction. **This is the phase the rest leans on.**

It ships in three independently-correct steps, so the one that removes data lands
last and only after its dependents are migrated:

- **A1 (`67cb84d`, done)** — windows persist their own text and blocks; the reuse map
  re-keys onto them; resumable backfill. Purely additive.
- **A2 (`2690397`, done)** — regions stitch from window text; `resolveRegion` is gone.
  Behaviour-changing, gated by a differential oracle against the old implementation.
- **C (next)** — the `SourceReader` port, `readTool` reading the origin, and the
  source's text stopping. The decisions taken for it, including why the column is
  blanked rather than dropped and how the blanking is gated, are in
  [`archive/orientation/resilient-ingest.md`](../../../archive/orientation/resilient-ingest.md).

- `knowledge_windows` gains `text` and `blocks` (the block refs this window
  covers, denormalized at ingest). A window becomes: id, local ref, ordinal,
  byte range, text, covered blocks, embedding — everything a citation needs.
- `knowledge_sources` **drops `text`**, gains `size_bytes`, `line_count`,
  `content_hash`. Origin metadata, not content.
- `resolveRegion` stops slicing `src.Text`; region text comes from the windows
  already in hand. `coveredBlocks` reads the window's own block refs.
  `SourcesByRef` does **not** disappear — a region still needs `SourceType` and
  `SourceID` to be citable — but it stops loading megabytes of text, which was
  the cost.
- **Region merging must stitch by range arithmetic**, not by slicing a parent
  string: merging windows A[0,4000] and B[3600,7600] yields
  `A.text + B.text[A.end-B.start:]`. This is the one genuinely fiddly part and
  gets a differential test against current behaviour. See the invariant below,
  which is what makes the formula safe.
- `planAdd`'s reuse maps get *simpler*: `SourceWindows(prev.LocalRefID)` already
  returns the windows, and they now carry text — no `prev.Text[w.Start:w.End]`
  reconstruction, and no per-window hash needed.
- `unchangedFrom` compares the source `content_hash` (hashed incrementally as
  text streams in Phase 6) instead of full strings. This also removes today's
  cost of loading **every** item's previous full source before any skip decision
  (`build.go:67`).
- `listTool` (today loads **every source in the project** in full for `len` and a
  line count) reads the new columns instead.
- **Migration**: backfill window text/blocks from the source text — both are
  present during migration — then drop `knowledge_sources.text`. Resumable,
  following `backfillVectorBlobs`' precedent.
- Side effect worth having: `AddResult.Source` stops carrying full text, so the
  add handler stops serializing whole documents back to the client.

### The stitching invariant, which has to be asserted

The merge formula depends on a property of `windowSpans` that is currently
implicit: **window starts strictly increase and window ends never decrease.** The
accumulator proves it — a window admits its first sentence unconditionally and then
while the total stays under target, so re-opening at `next > i` always reaches at
least the previous window's last sentence (`j' >= j`).

Two consequences:

- A later window may share the running end (a suffix window), which makes
  `B.text[A.end-B.start:]` index exactly at `len(B.text)` — legal, empty, correct.
- A window with `End < end` would panic. It cannot occur, and the reason it cannot
  is worth stating: the reuse path in `planAdd` inherits only **ids and vectors,
  never ranges**, so every window of a source always comes from one consistent
  windowing pass over the current text. There is no mixed-revision range.

Assert it rather than rely on it.

### `readTool` reads the ORIGIN, through a port

`knowledge.read` is line-addressed over a whole source (`lineSpans`, `TotalLines`,
arbitrary line ranges). It must not be served from lattice storage at all — that is
the second-copy mistake in miniature, and a whole-source read is the origin's data.

So knowledge declares a **`SourceReader`** port and wiring implements it per source
type, exactly mirroring `LatticeWriter` in the other direction, with neither
capability importing the other:

| source type | origin read |
| --- | --- |
| `document` | `docs.Get(id)` + `flatten` |
| `connector` | the provider's reader for that file |
| `attachment` | the file store's bytes |

This is the same reader the connector gains in Phase 6; it lands here because this
is where it is first needed, and Phase 6 extends it with the streaming shape rather
than introducing a second reader concept.

**Reassembling from windows was considered and rejected.** Windows very nearly tile
a source — `sentenceSpans` tiles the text exactly and consecutive windows overlap or
abut — but the blank-window filter drops all-whitespace windows, so reassembly can
have a silent hole, and a whitespace-only source has no windows at all. Adding a
per-window line index to work around that would be building lattice machinery to
answer a question the origin already answers.

**Accepted behaviour change:** `readTool` returns *current* origin content rather
than the indexed snapshot. Where a source has drifted since indexing the two
differ, and if the origin is gone the read now fails where it previously succeeded
from the copy. Current-truth is the better answer — a stale second copy silently
disagreeing with the real file is the worse failure — and `content_hash` is what
lets a caller be told the source has changed since it was indexed rather than
guessing. It is still a change, and it needs a test that pins it deliberately.

## Phase 5 — Sliced commits

`AddBatch` currently embeds everything, then writes everything.

- Commit every `commit_window_budget` windows: embed that slice's chunks,
  cluster those sources, `ReplaceSources` them, release, continue. Peak becomes
  O(slice) instead of O(sync).
- **Both batching benefits survive**: embeddings still chunk at 96 per request
  (never tied to the commit boundary), and the corpus rebuild is still one
  deferred, coalesced job at the end.
- A failure leaves committed slices committed; the retry's `unchangedFrom`
  skips them — forward progress instead of another lap.

### The vector identity must be pinned across the whole sync

`embedPending` has a `restale` path: when a batch's resolved embedding identity
differs from what a source reused vectors from, that source is re-embedded **in
full**, because mixing two embedding spaces "does not fail — it silently retrieves
nothing."

Slicing breaks that guarantee, and quietly. Slice 1 can commit under identity A and
slice 2 resolve to identity B — the route was re-pointed mid-sync — leaving the
sources in slice 1 permanently unretrievable by any later query, with no error
anywhere.

So the identity is resolved once and pinned for the sync: a slice that resolves to a
different identity aborts the sync rather than committing beside the earlier ones.
The sources already committed stay correct under A, and the next sync re-embeds
everything under B through the ordinary `restale` path.

## Phase 6 — Streamed ingest and derived caps

Now straightforward, because nothing downstream wants whole text.

**Why it cannot come earlier.** `knowledge_sources.text` is a column, and writing a
column needs the whole string. Hand `AddSources` an opener today and someone still
has to `ReadAll` it before the insert — the materialization would simply move from
the provider into the wiring adapter. Phase 4 removing that column is what makes a
reader mean anything.

### The `Provider` contract carries an opener and a size

`FileEntry` stops carrying `Content string`. It carries the path, the **size**, and
a way to **open** the file. `localfolder.go:31` swaps `os.ReadFile` for `os.Open`;
`Snapshot` yields entries, not bytes. `httpprovider.go` and
`cmd/connector-watcher` move to NDJSON-per-file so the HTTP path streams too.
Fingerprinting hashes incrementally through the same reader rather than over
retained content.

The change is at the **connector** level on purpose. `os.ReadFile` lives there, so
that is where the materialization has to stop; a reader introduced only at the
knowledge boundary would leave the provider holding every file in the snapshot and
change nothing.

The size travels because knowledge needs it, and it is worth being exact about what
for. **Three concerns run together here and should not:**

- **Size informs admission and planning** — the pre-flight artifact projection
  below, `unchangedFrom`'s cheap comparison, the `size_bytes` column Phase 4 adds
  (which `listTool` currently derives by loading every source in full), and how
  Phase 5 chooses its commit slices.
- **Source type / subkind selects an extractor** — a PDF or a spreadsheet needs
  converting to text before it can be windowed. Out of scope here, but note it is a
  *stage between* the reader and the windower, not a different way of reading.
- **The read itself is always the reader.** A 2KB file is a stream that ends after
  one buffer.

That last one is a deliberate choice against a size threshold selecting a
whole-file path. Two read paths mean two windowing implementations to keep
byte-identical forever — and the streaming windower already has to be
byte-identical to `windowSpans` to be trusted at all (that differential oracle is
this phase's gate). Once it is, the batch path earns nothing and costs a branch,
which is the argument records 0148–0149 settled for mechanics generally.

### The artifact ceiling is checked before anything is spent

`max_artifacts` is project-wide, because that is where the RAM is. But sliced
commits change its failure mode: crossing it mid-sync leaves slices 1..N committed
and fails at N+1, having silently indexed an arbitrary prefix of someone's folder.

So it is checked **pre-flight**, from the snapshot's byte total, projecting windows
as `bytes / (target_runes − overlap_runes)`. That over-estimates for multibyte text,
which is the safe direction. The whole sync is then refused before a token is spent,
with a message someone can act on — "this folder needs more capacity than this
project has" rather than "some of your files are indexed".

### The rest of the phase

- **Incremental windowing**, carrying: chunk byte base, open-sentence state
  (`start`, `runes`, the `terminated` flag), the open sentence's bytes,
  sentences since the window opened (bounded by `target + overlap`), running
  rune total, ordinal counter, and a true-EOF flag. `splitOversized`
  (`lattice.go:139-161`) drops its per-rune offset table (40MB on a 5MB
  single-sentence file) for a running counter.
- **`connectors.max_file_bytes` is deleted**, along with `UseMaxFileBytes` and the
  `too_large` skip. See "What the caps are" above for why it is a deletion and not
  a larger number.
- **Caps derived from RAM at startup**, logged with their derivation so the
  number is never mysterious. Linux reads `/proc/meminfo`; other platforms take
  the fixed default (no new dependency — the repo has five, all
  infrastructure).

```yaml
limits:
  memory_budget: ""            # empty = 25% of system RAM
knowledge:
  ingest:
    commit_window_budget: 0    # 0 = derived from memory_budget
    max_artifacts: 0           # 0 = derived: budget / (dims x 8 bytes)
```

`max_artifacts` produces a typed `project_artifact_limit` error — the "reach
out to your administrator" signal — instead of an OOM.

## Phase 7 — One indexed ascent, source tier included

**Landed (`88b0ea5`, `c71b9c6`; record
[0158](../../records/0158-one-ascent-and-the-crossover-measured.md)), ahead of
Phase 6.** Phase 6 changes how bytes reach the windower and leaves the ascent's
inputs — ids and unit vectors — untouched, so it never gated this. Two claims
below were wrong and are corrected in place.

Last, because Phases 4 and 5 change what a window is and how commits slice —
building this before them would build it against a storage model about to
move.

Today there are **two ascent loops**: `ascend()` (`lattice.go`) for a source's
own forest, and `buildCorpusIndexed()` (`repair.go`) for the corpus tier with
index awareness. They have the same shape and different capabilities. This
phase collapses them into **one indexed ascent parameterized by scope**
(`localRefID` empty = corpus tier), so a re-synced source repairs its own
subtree exactly as the corpus tier repairs itself — and a code path is
deleted rather than added.

Two things that make this cheaper than it first looks:

- **No size threshold is needed.** `repairDecision` already returns "no stored
  index → build in full", and for a small pool a repair and a rebuild are both
  instant, so tiny sources self-select without a conditional. That matters:
  the whole point of records 0148–0149 was that mechanics do not carry
  switches.
- ~~**Storage is negligible.** A source index is ~1 row plus `W × min(k, W)`
  edge rows; a 2-window source costs a couple of hundred bytes, and the entire
  596-file corpus would be well under a megabyte. A 1,250-window textbook is
  ~800KB.~~

  **Wrong premise.** Sizing a *2-window* source's index assumes an **exact**
  level persists one — which is the question this phase says it is forcing, and
  the bullet quietly answers "yes" while the section below leaves it open. It
  was decided **no** (record 0158): an exact level neither persists nor consults
  an index, because letting one divert a sub-crossover level onto the k-NN graph
  makes the construction depend on history rather than on pool size, and
  content-addressed ids churn at the transition. So no small source stores
  anything and the storage estimate describes a world that does not exist.
  Storage really is negligible for the sources that *do* run sparse — above
  `max_pool` windows, i.e. a ~17MB text today — but there are almost none of
  them, which is a different and much weaker claim.

**Be honest about the payoff.** Measured, the real corpus averages ~2 windows
per file, so the typical source ascent is a 2×2 matrix and saves nothing. The
performance win is concentrated in *large, frequently re-synced* sources — a
1,250-window textbook re-clusters in ~0.7s today and would repair in
milliseconds. That is a real but narrow gain; the durable justification is the
unification, not the number. Nothing here resembles the corpus tier's 15.7×,
because a source's pool is only its own windows while the corpus pool is
everything and every write touches it.

Gate: the existing source-tier tests (`TestUnchangedClustersKeepTheirNodeIDs`,
`TestAscendDeterministic`) must pass unchanged, plus a repaired-vs-rebuilt
source producing identical node ids — the same equivalence gate the corpus
tier got in 0146.

**Two corrections to that gate, as landed.**

The source-tier tests pass with their assertions untouched, but the ones that
call `ascend` directly needed a mechanical signature update — `ascend(scope,
…).nodes` — so "unchanged" holds for the behaviour, not the source text.

"A repaired-vs-rebuilt source producing identical node ids" assumed a source
*persists* an index. It cannot: `knowledge_corpus_index` and
`knowledge_corpus_edges` are keyed `(project_id, level)`, and adding
`local_ref_id` is a schema change this phase did not include (a subtraction that
adds a column is not one). The gate is met at the ascent's boundary instead —
`TestASourceScopedAscentRepairsLikeTheCorpusTier` hands the index in, and gets
the same 40 level-1 node ids from a repair and a consolidation — which proves
the machinery is scope-independent and leaves persistence as the only gap. The
real gate for the collapse turned out to be a different test:
`ascent_differential_test.go`, holding frozen copies of *both* pre-collapse
loops against the one that replaced them.

---

## Verification

Per phase: `go build ./... && go test ./... && ./scripts/check-format.sh`, then
the live suites before each commit touching the production path. (The companion
check was part of this list until the practice was retired mid-Phase 4.)

The load-bearing tests:

- **Region text is byte-identical** before and after Phase 4, across
  overlapping, adjacent and disjoint window merges — the differential gate for
  the storage change.
- **Incremental windower vs `windowSpans`**: a differential oracle over varied
  chunk boundaries requiring **byte-identical spans**. Same pattern as
  `TestSparseCliquesMatchDense`; the gate for Phase 6, and what makes keeping only
  one read path defensible.
- **A provider's reported size equals what its reader produces**, per provider. The
  size is load-bearing in three places (the pre-flight projection, `unchangedFrom`,
  the stored `size_bytes`), and a size that disagreed with the bytes would corrupt
  all three quietly — a refusal for a folder that would have fit, or a skipped
  re-embed of a file that did change.
- **A file that changes between snapshot and read is reported, not silently
  truncated.** Streaming opens a window between deciding to sync and reading, which
  materialized content did not have.
- **`knowledge.read` through the origin**, per source type, including the cases the
  old snapshot read hid: a source that has drifted since indexing (returns current
  content, and says it drifted) and an origin that is gone (fails, rather than
  serving a stale copy). It has **no test coverage today** despite being a live Ask
  tool, so these are new tests, not modified ones.
- **The stitching invariant** — window starts strictly increase, ends never
  decrease — asserted directly against `windowSpans`, so the merge formula's
  precondition cannot rot silently.
- **Sliced vs whole-batch ingest** produce identical lattices (identical
  content-addressed node ids); a slice budget of 1 is still correct.
- **Failure injection**: an embedder failing at slice N leaves slices < N
  committed, and the retry skips them and completes.
- **Retry cap**: a permanently failing sync stops after `max_attempts` and
  reports needs-attention rather than looping.
- **`dev-test/knowledge-scale`** gains a multi-MB document asserting it is
  *indexed and retrievable*, not skipped — the textbook case end to end on real
  embeddings — plus the existing repair assertions re-run, to prove the storage
  change did not disturb them.
- **Peak-memory benchmark**, sliced vs whole-batch, so the bound is measured.

Records `0152+`, one per phase. (This line used to add "companions updated in
the same commits"; that practice was retired mid-Phase 4 and the 191 documents
are archived under `archive/companions/`.)

## Deliberately not in scope

**The memory floor within a slice stays.** Even after Phase 7, one source's
ascent holds that source's vectors plus, below the `max_pool` crossover, a
pairwise matrix over its windows — for a 5MB textbook, ~1,250 windows means
15MB of vectors and a 12.5MB matrix. Repair avoids *recomputing* that on a
re-sync; it does not avoid *holding* it on a first ingest. Bounding it further
would need incremental clustering within a level, which nothing here needs
because the commit slice already bounds how many sources are resident at once.

Also out of scope: PDF/slide/spreadsheet extraction (this plan makes the text path
able to accept them — the extractors are separate work).

Serving whole-source reads from the origin **was** listed here as out of scope, and
that was wrong: dropping `knowledge_sources.text` is exactly what requires it, and
the alternative was building a per-window line index to answer a question the origin
already answers. It is now part of Phase 4 as the `SourceReader` port.
