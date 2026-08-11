# Orientation: resilient ingest, and the storage correction

**Read [`README.md`](README.md) in this folder first** — it orients you to the
repository. Read this second if you are picking up the **resilient-ingest** work, or
if you are about to change **anything under `core/capability/knowledge/`**.

It exists to survive a context reset. The plan itself is
[`docs/superpowers/specs/2026-07-29-resilient-ingest-design.md`](../superpowers/specs/2026-07-29-resilient-ingest-design.md);
this document is the state around it — what has landed, what is verified, what is
dangerous, and the mistakes already made so nobody makes them twice.

---

## 1. Why this is the part to be careful in

The knowledge lattice is the load-bearing system in this repository. Three
properties make its failures unusually expensive:

**Failures are silent, not loud.** The lattice's characteristic bug is not a crash —
it is *retrieving nothing*, or retrieving the *wrong span*, while every test passes
and every response is a 200. Vectors from two embedding models "do not fail, they
silently retrieve nothing." A citation whose byte range points at restructured text
resolves to the wrong place without complaint. A window whose text and range disagree
produces plausible prose attached to the wrong source.

**Embeddings cost real money and cannot be recomputed for free.** Everything else in
the lattice is rebuildable projection state — nodes are dropped and recomputed when
their shape changes. Embeddings are the one thing migrated in place rather than
rebuilt (see `backfillVectorBlobs`). A change that invalidates them bills the user to
recover.

**The write path fans out.** One connector sync can touch every source in a project;
one source write drops and rebuilds the project's whole corpus tier. A per-item cost
becomes a per-project cost quickly, which is how a 2-second timer turned into
unbounded spend (record 0152).

So: **small steps, real tests, and no assumption left unverified.** Two of the
factual claims in the plan turned out to be wrong when checked against the code
(section 5). Check the rest.

## 2. Working rules specific to this work

Beyond [`AGENTS.md`](../../AGENTS.md), which always applies:

- **The repo is being modified by others.** Commit often and keep each commit small.
  Order is **commit → `git pull --rebase origin main` → push**; pulling with unstaged
  changes fails. Check `git rev-list --left-right --count HEAD...origin/main` before
  you start.
- **Be extremely careful with `sed`/`perl` in-place edits**, and prefer not to use
  them here at all. If one is genuinely the right tool: commit and push first so
  `HEAD` is the rollback point, restrict the pattern to an exact match, review the
  full `git diff` *before* committing, and make sure the **compiler** can catch a bad
  substitution (see record 0155 for the one case where that was done deliberately —
  appending `err` to a call means any out-of-scope site fails to build).
- **Never mock intelligence.** Model-backed behaviour is validated only in live
  `dev-test/` suites that report their token cost. Unit tests cover deterministic
  plumbing.
- **Run the live suites before committing anything on the production path**, and
  report the cost. The relevant ones here: `dev-test/knowledge`,
  `dev-test/knowledge-scale` (needs `assemble.sh` once), `dev-test/connectors`,
  `dev-test/chat-attachments`.
- **Companion docs are retired.** They are archived under
  [`archive/companions/`](../../archive/companions/README.md), mirroring their old
  paths. Don't update them; the ones for this area describe the code as of Phase 4
  and stop there. Change records are now the only prose obligation.

## 3. What has landed

Phases 1–5 and 7 are complete. **Phase 6 (streamed ingest) is what remains.**

Phase 7 landed before Phase 6 deliberately: the design doc ordered it last
because Phases 4 and 5 change what a window is and how commits slice, and both
of those had landed. Phase 6 changes how bytes *reach* the windower and leaves
the ascent's inputs — ids and unit vectors — untouched, so it does not gate the
collapse.

| Phase | Commit | Record | What it fixed |
| --- | --- | --- | --- |
| 1 | `dca0408` | [0152](../records/0152-a-failing-sync-remembers.md) | Connector sync had no memory of failing, so the detector re-read and re-embedded the whole connector every 2s, forever |
| 2 | `e76e436` | [0153](../records/0153-patience-is-a-budget.md) | 7s of rate-limit patience against per-minute windows; `Retry-After` discarded; provider timeouts aborting instead of retrying |
| 3a | `79ee190` | [0154](../records/0154-a-limit-says-what-it-was.md) | Three bounds speaking three vocabularies, none reporting its arithmetic; one dropping files in silence |
| 3b | `b8ba4aa` | [0155](../records/0155-failures-say-why-everywhere.md) | 66 5xx responses discarding their cause across 19 handler packages |
| 4-A1 | `67cb84d` | — | Windows gained their own `Text` and `Blocks`; reuse map re-keyed onto them; resumable backfill |
| 4-A2 | `2690397` | — | Regions stitch from window text instead of slicing the source; the flaky scale assertion fixed |
| 4-C1 | `af6aa82` | — | `SourceReader` port; `readTool` reads the origin, not a copy in the lattice |
| 4-C2 | `4a5710b` | [0156](../records/0156-a-window-is-the-artifact.md) | Source metadata columns; source text stops being written, and existing rows are blanked |
| 5 | `ef04a11` | [0157](../records/0157-a-sync-commits-in-slices.md) | Peak memory O(sync) and a failure discarding all of it; the embedding identity pinned across the sync |
| 7 | `88b0ea5`, `c71b9c6` | [0158](../records/0158-one-ascent-and-the-crossover-measured.md) | Two ascent loops of the same shape; and the crossover deciding incrementality without ever having been timed |

Record 0156 covers the whole of Phase 4; 4-A1, 4-A2 and 4-C1 have no record of
their own, and their reasoning is in their commit messages, which are unusually
full for that reason.

Design updates: `d1d4c2f` (original), `f621e9d` (Phase 7 added), `fc757aa` (the byte
cap deleted rather than raised), `93cd569` (whole-source reads come from the origin).

### What Phase 4 left in place

`knowledge_windows` has `text` and `blocks`, written by `addPlan.cluster` from the
same snapshot that produced the spans, and backfilled for old rows by
`backfillWindowText`. `mergeWindows` assembles region text from those windows;
`resolveRegion` is gone. `planAdd`'s reuse map keys on `w.Text`.

Whole-source reads go to the origin: `knowledge.SourceReader` is implemented in
wiring by `sourceOriginReader`, which dispatches document → `docs.Get` +
`FlattenDocument`, attachment → the file store, connector → the provider.
Knowledge still holds the source *row* — that is where scope and the id↔label
pairing live — but asks the origin for bytes.

`knowledge_sources.text` is **no longer written**, and existing rows are blanked by
`blankSourceText` on startup, gated per source on every one of that source's
windows already carrying its own text. The column itself remains: this store's
migrations are additive, so a real `DROP COLUMN` is optional cleanup rather than a
load-bearing step. What replaced the text is `size_bytes`, `line_count` and
`content_hash` — `listTool` reads the first two, `unchangedFrom` compares the
third.

**The live suites after the phase.** All four pass. `dev-test/knowledge-scale`
re-ran the 596-file corpus: 32s first sync, 1,207,594 tokens ($0.024), 665
frontier entries → 172 nodes, pinned threshold 0.563 (the same value record 0151
saw), and the one-file re-sync repaired at 454 tokens — `+1 −1 of 665, drift
0.0002`. Descent carried **3 of 3** topical queries, where record 0151 saw one
fall back. Note what this did *not* exercise: the suites build a fresh database,
so `backfillSourceMetadata` and `blankSourceText` are covered only by
`source_backfill_test.go`, never live.

## 4. Invariants you must not break

These are load-bearing and mostly implicit in the code. Each one, if broken, fails
silently.

**Window starts strictly increase; window ends never decrease.** `windowSpans`
guarantees it (a window admits its first sentence unconditionally, then accumulates
under target, so re-opening at `next > i` always reaches at least the previous
window's last sentence). Region merging's stitch formula depends on it. A window with
`End < end` would panic; it cannot occur.

**A source's windows always come from one consistent windowing pass.** `planAdd`'s
reuse inherits **ids and vectors, never ranges**. This is why there is no
mixed-revision range in a source. Preserve it.

**Window ids are stable across a re-sync when the text is unchanged.** Minting fresh
ids made a one-character edit replace the identity of every artifact in the source.
Stable ids are the precondition for every incremental scheme, including the corpus
tier's repair path (records 0140, 0144–0146). Note *how* they are stable: by lookup,
in `planAdd`'s reuse map, within one database — not by construction. Two ingests of
the same bytes into two databases share no ids at all.

**An id may be reused once; a vector may be reused freely.** An id is a primary key;
a vector is a pure function of its text. `planAdd` keeps two maps for this reason —
three identical windows becoming four means three keep ids and all four share one
embedding.

**One project never holds vectors from two embedding spaces.** `embedPending`'s
`restale` path re-embeds a source in full when the identity changed. Mixing spaces
retrieves nothing, with no error. Phase 5 must pin the identity across a whole sync
for this reason.

**Never produce an empty window.** An embeddings provider that rejects an empty
string answers the *whole batch* with an empty result, so one blank window zeroes
every vector beside it. This is why `windowSpans` filters blanks — and why windows
do not perfectly tile a source (section 6).

**Mechanics do not carry flags.** Construction is chosen by pool size, probing by
index presence, retrieval is always descent. Comparisons against a reference
algorithm live in tests (`RetrieveExact`, and the frozen loops in
`ascent_differential_test.go`) or in git history — not in config (records
0148–0149). Configuration holds numbers only: caps, limits, budgets.

**`max_pool` is a crossover, not a ceiling.** Below it, clustering builds the exact
n×n matrix; at or above it, a k-NN graph. No pool is ever refused. The sparse path
approximates only *which pairs are examined* — every similarity it keeps is an exact
full-dimension dot product.

**The two decisions above must not collide.** Pool size chooses the
construction; index presence chooses repair-versus-consolidate. Phase 7 settled
what happens where they meet: an **exact level neither persists nor consults an
index** (record 0158). Letting one divert a sub-crossover level onto the k-NN
graph would make the construction depend on history — the same pool clustered
one way on the build that mints the index and another on the repair that reads
it — and content-addressed ids would churn at each transition. Measured, the two
constructions agree on 0.987–1.000 of level-1 clusters, which is what makes this
failure quiet rather than what makes it tolerable: falsifying the gate by
widening the sparse branch on index presence produced *identical nodes* and
showed up only in the index and the outcome it leaked.

**There is ONE ascent.** `ascend` (lattice.go) builds both a source's forest and
the corpus tier, parameterized by `ascentScope`. It was two copies of the same
loop until Phase 7, and only one of them knew indexes existed. Do not add a
second; if a new tier needs an ascent, give it a scope.

**A window's text is exactly its range, and clustering is a pure function of its
inputs.** The first is guaranteed because both halves are written in the same pass
from the same snapshot, and the reuse path inherits ids and vectors but never ranges.
The second is guaranteed by fixed seeds and a private xorshift — `neighbors.go` says
"no clock and no global rand" — and record 0141 explains why it matters: node ids are
content-addressed from member sets, so clustering that is not deterministic churns
every id on every rebuild and silently undoes record 0140.

Purity is not the same as reproducibility, and the difference has bitten once
already: the function is deterministic, but the frontier it is handed is ordered by
random ids, and one step reads that order. See section 5.

## 5. What is NOT reproducible across fresh ingests, and whose fault it is

Clustering is a pure function of its inputs. **One of those inputs arrives in a
random order, and that is ours** — not the provider's. An earlier version of this
section blamed provider float noise; that was never tested and is not the cause.

The chain, each link checked against the code:

1. `newID()` is 16 bytes of `crypto/rand`, so a fresh ingest mints a **random id for
   every window**. Node ids are content-addressed, but from their members' ids, so
   they inherit the randomness rather than escaping it.
2. Both frontier queries order by id — `EntryFrontier` reads nodes `ORDER BY n.id`
   and orphan windows `ORDER BY w.id`. A fresh ingest of identical content therefore
   presents the frontier as **a fresh random permutation**.
3. `sampledSims` draws pairs by *index* under a fixed seed (`i := rng.intn(n)`), so
   the same seed selects the same positions holding different vectors. Different
   pairs → a different percentile → a different pinned threshold.

Step 3 only bites above `thresholdSampleBudget` (200,000 pairs, i.e. n > 633); at or
below it every pair is used and the distribution is exact. `dev-test/knowledge-scale`
lowers `max_pool` to 256 so its corpus tier runs sparse, and that corpus has **664
frontier entries — 220,116 pairs, just over the line.** That is why this surfaces
there and essentially nowhere else. A scratch experiment made the last link explicit:
the same vectors in two orders gave 0.779328 and 0.788097.

So record 0151's pinned threshold moving between fresh ingests (0.563 vs 0.564) is
ours. A near-`descent.threshold` query then flips between descending and falling
back, which is what makes 0.35 look marginal on real prose.

**What it does and does not affect.** Within one database ids are stable, so
re-sync, repair and retrieval are unaffected — record 0151's `+1 −1 of 664, drift
0.0003` is real. Across fresh ingests of identical content the lattice differs
slightly. This is a reproducibility and debuggability problem, not a correctness one,
which is why it is worth fixing but was never urgent.

**The fix under discussion** is content-addressed window ids — `sha256` over
`(localRefID, text, occurrence index among identical texts)`, keeping the 32-hex
shape `encodeEdges` requires. Keying on text rather than ordinal is the whole point:
an ordinal shifts when a paragraph is prepended and churns every id, whereas
occurrence-among-identical-texts reproduces exactly what `planAdd`'s `priorIDs` queue
does today by lookup — and would let that queue be deleted. Not yet decided; see the
open questions.

The consequence for testing is unchanged and still the practical point: **never
assert a per-query retrieval mode against a freshly ingested corpus.** Assert that a
query *grounds* — returns the document that answers it — and assert descent works in
aggregate.

## 6. Mistakes already made, so they are not repeated

**Claimed no handler set `endpoint.Response.Err`.** Wrong: `chatErr` had set it since
`3350dc0` (record 0130). The practice existed and never spread. Corrected in record
0154 and the design doc. *Lesson: grep before asserting an absence.*

**Planned to reassemble whole-source reads from window text.** Wrong shape — a
whole-source read is the **origin's** data, and reading it out of the lattice is the
second-copy mistake rebuilt one layer down. Windows also cannot serve it reliably
(section 6). Corrected in `93cd569`. *Lesson: when a fix requires new machinery
inside the lattice, check whether the question belongs to the lattice at all.*

**Planned to raise `max_file_bytes` to 25 MiB.** It should be deleted. It looks like a
resource ceiling and is not one: the bound is per file while the exposure is the whole
snapshot (596 × 1 MiB passes at ~600MB resident; one 2 MiB file is refused), and both
of its stated reasons were dead — one cited the `max_pool` refusal deleted in
`5591a44`. Corrected in `fc757aa`.

**Cited line numbers in the plan.** They drifted within days, from my own migration
edits. Cite symbols.

**Embedded a struct and assumed `errors.As` would find it.** Embedding promotes
`Error()` and `Body()`, so the value prints like the embedded type while `errors.As`
fails — the concrete type differs and there is no chain to walk. An explicit `Unwrap`
is required. Caught only because the test asserted both identities together
(record 0154).

**Asserted a per-query retrieval mode in a live suite — then misattributed the
flake.** `dev-test/knowledge-scale` required `"mode":"descent"` on one query. It
failed on one run and passed on the next with **byte-identical code and the same
corpus**. Removing the assertion (`2690397`) was right. The explanation attached to
it was not: I reasoned by elimination — the diff touched only `regionsFor`, which
runs *after* the mode is decided; the corpus was frozen; our clustering is seeded —
concluded "provider float noise", and never tested it. It was ours (section 5).
*Two lessons. When a live test flakes, establish whose nondeterminism it is before
touching either the code or the test; re-running identical code is the cheapest
decisive experiment. And elimination names a suspect, not a cause — "nothing else
could explain it" is where the work starts, not where it ends.*

**Nearly trusted an unfalsified differential test.** The region gate passed
immediately, which is not evidence it works. Deliberately breaking the stitch by one
byte made it fail in 10 places, and restoring it made it pass again. *Lesson: a gate
that has never failed is decoration until you prove otherwise.*

**Falsified the Phase 7 ascent gate and found the hole in the FIXTURE.** The
first deliberate break — making the sparse branch read member vectors at pool
positions instead of index positions, the single likeliest mistake in the
collapse — *passed*. The repair fixture stored a prefix of the same pool, so the
repaired index's positions happened to line up and the two coordinate systems
never disagreed. Offsetting the stored index from the pool (ten artifacts leave
as tombstones, ten arrive as appends) made the same break fail at once.
*Lesson: falsification does not only tell you whether the gate is wired up — it
tells you whether the fixture reaches the state the bug lives in. Ask what the
inputs make DIFFERENT, not just what they cover.*

## 7. Facts verified against the code

Confirmed by reading, not assumed. Useful because the next phase rewrites them.

Marked **[fixed]** where a later step has since changed it — kept rather than deleted,
because knowing what the shape *was* is how the remaining work is understood.

- `knowledge_sources.text TEXT NOT NULL` was a full second copy of every source.
  The column remains (migrations here are additive) but is written empty and
  blanked on startup; `knowledge_windows` carries `text` and `blocks` instead
  **[fixed in 4-A1 and 4-C2]**.
- `resolveRegion` sliced `src.Text[start:end]` behind an `end <= len(src.Text)` guard
  — a guard that existed *because* ranges and stored text could disagree. Both are
  gone **[fixed in 4-A2]**.
- `unchangedFrom` compared full text strings, and `AddBatch` loaded every item's
  previous source — text included — before any skip decision. It now compares
  `content_hash` **[fixed in 4-C2]**.
- `planAdd` rebuilt each prior window's text as `prev.Text[w.Start:w.End]`, which
  silently dropped from the reuse map any window whose range no longer fit — meaning
  its embedding was silently paid for again **[fixed in 4-A1]**.
- `listTool` loaded **every source in the project in full** to report a byte count
  and a line count. It reads `size_bytes`/`line_count` **[fixed in 4-C2]**.
- `AddResult.Source.Text` was `json:"text"`, so every add serialized the whole
  source back to the client. The field is gone **[fixed in 4-C2]**.
- `splitOversized` builds a per-rune offset table: ~40MB for a 5MB single sentence.
- `AddBatch` embeds everything, then writes everything in one `ReplaceSources`, then
  queues one deferred corpus rebuild.
- `sentenceSpans` tiles the text exactly; consecutive windows overlap or abut. So
  windows *do* cover a source — **except** that all-whitespace windows are dropped,
  which can leave a silent hole, and a whitespace-only source produces no windows.
  This is why reassembly from windows was rejected.
- `knowledge.read` is a live Ask tool (`ask.go`) that had **no test coverage**; it
  has seven tests now **[fixed in 4-C1]**.
- Two ascent loops of the same shape existed: `ascend` (lattice.go) and
  `buildCorpusIndexed` (repair.go) **[fixed in Phase 7]**. They differed in one
  thing and it was never scope: only the corpus copy knew a persisted index
  could be repaired.
- The index tables are keyed `(project_id, level)`, so a **source** ascent has
  nowhere to keep an index even though it now produces one. Source-tier
  incrementality is a storage question, not a clustering question.
- The `max_pool` default of 4,000 came from a memory budget (128MB of matrix)
  and had never been timed. `BenchmarkCrossover` timed it: the crossover is
  **~2,000** at dim 1,536 — exact 1.83s vs sparse 1.70s at n=2,000, and 8.34s
  vs 3.03s at n=4,000. The default is unchanged pending a live run (below).

Arithmetic worth keeping to hand: a vector is 1536 dims → **12KB in memory**
(float64) and **6KB on disk** (float32 BLOB), so ~200k artifacts ≈ 2.4GB resident. A
5MB text is ~1,400 windows. Window stride is `target − overlap` = 3600 runes.
Embedding costs ~$0.02 per 1M tokens ≈ **$4/GB** of text.

## 8. What remains

Full detail in the design doc; this is the shape and the risk.

### Decisions Phase 4 took that later phases inherit

Revisit them only with a reason:

1. **The watcher protocol is not touched.** Reading one connector file needs a
   per-file provider read, and `Provider` only has `Snapshot()`. Rather than add an
   endpoint to `cmd/connector-watcher` — a separate binary whose wire protocol others
   may be mid-flight on — the connector adapter snapshots and picks. Correct, slow,
   and made cheap for free by Phase 6, which already plans NDJSON-per-file.
2. **No `DROP COLUMN`.** This store's migration model is additive: nothing is
   renamed or dropped in place. `knowledge_sources.text` stays and is *blanked*.
   Same storage outcome, invariant intact, and a real drop stays optional.
3. **Blanking is gated per source** on every one of that source's windows having
   non-empty text, so a half-finished window backfill can never erase text whose
   replacement does not yet exist — and one stale window cannot pin the whole
   project's copy in place.
4. **`FlattenDocument` lives in wiring**, exported, so the adapter that reads a
   document back and the handler that admits one share a single definition of what
   a document's text is. (`wiring` may import `handlers`, not the reverse.)

**The irreversible part, stated plainly.** Blanking destroyed data recoverable only
from the origin. Where an origin is gone — a deleted document, a removed file — the
lattice's copy was the last one, and `knowledge.read` on that source now fails
rather than serving a stale copy. That is the accepted premise (`93cd569`), not an
oversight.

**Phase 6 — streamed ingest.** `FileEntry` drops `Content` and carries a path, a
size and an opener; `localfolder.go` swaps `os.ReadFile` for `os.Open`; the HTTP
provider and watcher move to NDJSON-per-file. Incremental windowing with a
differential oracle requiring **byte-identical spans** against `windowSpans`.
`connectors.max_file_bytes` is deleted. Caps derived from RAM, logged with their
derivation. The artifact ceiling is checked **pre-flight** from a projected window
count, so slicing cannot discover it halfway and leave an arbitrary prefix indexed.

### Raised during the work, not in the design doc

The first two came out of C1 and are agreed in principle, not scheduled. Neither
is urgent enough to interleave with C2, which removes data and wants a quiet
tree. The third came out of Phase 7.

**The read tool does not belong to knowledge.** C1 moved the *content* to the origin
but left the *tool* inside the lattice, which is half a fix. `knowledge.read`
presupposes you already know the source id — it is an **addressed read**, not
retrieval — and knowledge's job is "find me the relevant windows". `knowledge.list`
is the "find the file" half of the same question and belongs beside it, not beside
`search`.

What should move out: the tool registrations, the `SourceReader` port, and
`readOrigin`'s error mapping. What should stay: knowledge remains the registry of
the id↔label pairing (a connector's path is stored on the source row), so the new
surface *reads* that registry rather than owning it, and the scope check becomes a
project-membership question rather than a lattice lookup. Output stays region-shaped
so a read is citable on the same terms as a search hit — that is a format concern,
and it was the only real argument for co-locating them.

**Content-addressed window ids.** The fix for section 5. `local_ref_id` becomes
`sha256(projectID, sourceType, sourceID)` — a surrogate for a triple that is already
unique — and a window id becomes a hash over `(localRefID, text, occurrence index
among identical texts)`, truncated to 16 bytes so the 32-hex shape `encodeEdges`
decodes stays intact. `planAdd`'s `priorIDs` queue then becomes redundant:
inheritance is what the hash *is*, rather than machinery that reproduces it.

Cost, stated up front: this is the most sensitive machinery in the repo, and
existing ids will not match newly computed ones, so the first re-sync after it churns
ids once and the corpus rebuild absorbs that. Its gate is a reproducibility test —
two ingests of identical bytes into two databases produce identical ids and an
identical pinned threshold — which does not exist today and is the reason the bug
survived this long.

**A source has nowhere to keep a level index.** Phase 7 made the repair
machinery scope-independent — `TestASourceScopedAscentRepairsLikeTheCorpusTier`
shows a source-scoped ascent repairing a stored index and reaching the same
level-1 node ids a consolidation reaches — but `knowledge_corpus_index` and
`knowledge_corpus_edges` are keyed `(project_id, level)`, so the index a sparse
source level produces is discarded. Adding `local_ref_id` to that key would
finish the job with no change to the ascent at all.

Worth doing when something needs it, and today almost nothing does: a source
level only runs sparse above `max_pool` windows, i.e. a ~17MB text at the
current 4,000. The case is a large, frequently re-synced source — a
1,250-window textbook re-clusters in ~0.7s today and would repair in
milliseconds — which is real but narrow, and gets narrower still if the
crossover moves down (then it starts at ~2,000 windows, a ~7MB text).

### Open questions

- **Should `max_pool` (4,000) move lower? — measured, and the answer is
  probably 2,000, but not yet.** `BenchmarkCrossover` (record 0158) timed both
  constructions over the same pools at dim 1,536: sparse is slower below ~2,000
  and faster above it, reaching 2.75× at n=4,000, while reproducing 0.987–1.000
  of the exact construction's level-1 clusters by content-addressed id. So the
  band between ~2,000 and 4,000 is today clustered by the *slower* construction
  **and** denied incrementality, because only sparse levels persist an index and
  an exact level must not (that half of the question is now settled — see the
  invariants).

  Why the default is still 4,000: this is one synthetic fixture on one machine,
  and it says nothing about how the constructions diverge on real prose, where
  record 0151 already saw `descent.threshold` marginal and one topical query
  falling back. **What would need to be true:** one live
  `dev-test/knowledge-scale` run at `max_pool: 2000` with the pinned threshold
  stable and all three topical queries still grounding. Then it is a one-line
  config change with evidence behind it. (This tree had no
  `etc/config.local.yaml`, so the live suites skip — which is exactly why the
  change was not made here.)
- **`descent.threshold` 0.35 is marginal on real prose.** Record 0151 saw one of
  three topical queries fall back to the exact scan. Query-to-centroid similarity runs
  lower than document-to-document. Tune against `dev-test/knowledge-scale`.
- **The ~54 bind-error sites** still discard their parse error. Deliberately deferred
  (they are 400s whose message already tells the client what is wrong); a clean
  mechanical commit whenever someone wants it.
- **Does anything else read frontier order?** Section 5 traced one consumer,
  `sampledSims`. Content-addressing the ids makes the order reproducible and the
  question moot — but until then, treat "the frontier arrives in a stable order" as
  false when reasoning about any new code that iterates it.
