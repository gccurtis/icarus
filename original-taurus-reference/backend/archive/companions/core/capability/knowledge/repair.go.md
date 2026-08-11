# repair.go

`repair.go` is the index-aware corpus ascent — the driver that makes the
"local events + consolidations" design real. Per level, a rebuild either
**repairs** the persisted k-NN index (apply the id diff through the stored
cells, keep the pinned threshold — a local event) or **consolidates** (build
the level in full: refit the basis, re-quantize the cells, re-pin the
threshold — a global reorganization). The constructions themselves live in
[`neighbors.go`](neighbors.go.md); this file owns the *decision* and the
plumbing between pool positions, index positions and artifact ids.

The decision is measured, not guessed. A level repairs only when **both**
hold:

- the changed fraction (inserts + removes over the pool) is under
  `repair_max_fraction` — past that, repairing costs what building costs;
- the pinned threshold's measured drift from the pool's current percentile is
  under `repair_max_drift` — past that, the pin no longer describes the pool
  and every similarity judgement it gates is suspect.

Everything leans on content-addressed ids (record 0140): an edited source
changes only its own window ids, so its root's id changes while every
untouched root keeps its own — the frontier diff is proportional to the edit,
at every level of the ascent.

Measured (`BenchmarkLevelRepair`, 20,000 artifacts, dim 1536): a 1% delta
repairs in **0.88s** against **13.9s** for the full build — and the repair is
dominated by the fixed-size drift sample, so it is effectively flat in the
delta while the rebuild grows with the pool.

## Code breakdown

### `repairOutcome` — the operator's narration

One value per sparse level saying what happened and why: `repaired (+i −r of
n, drift d, threshold t)` or `built in full (reason)`. `RebuildCorpus` logs
one line per outcome — repair and consolidation produce identical corpora by
design, so the log line is deliberately the one observable difference, and
the end-to-end test asserts on it.

### `repairDecision` — the policy, apart from the machinery

A pure function from (stored index, pool ids, config) to (insert count,
remove count, reason-not-to-repair). Beyond the changed fraction it refuses
for structural reasons: no stored index, repair disabled (non-positive
fraction bound), a changed `k`, or a changed projection configuration — a
stored index built under different machinery is not an index of this
configuration's graph. Drift is deliberately *not* here: it needs the
vectors, and the split keeps the policy testable with none.

### `indexFromStored` / `toStored` — the two worlds

The persisted form names everything by artifact id; the in-memory form works
in positions. `indexFromStored` rehydrates (positions follow stored artifact
order; edges naming departed ids are dropped — the diff removes those
artifacts anyway). `toStored` flattens live members only, so tombstones
compact away and every repair-or-consolidate cycle persists a clean index.
`TestStoredIndexRoundTripPreservesClusters` pins the trip: same threshold,
same clusters, member for member.

### `buildCorpusIndexed` — the ascent, with memory

The corpus analogue of `ascend`, with the same shape (level loop, clique
nodes, orphans carry up, progress guard) and three differences:

- a sparse level consults `levelIndexFor` and stores the resulting index;
  exact levels (pool within `maxPool`) are cheap enough to just redo and
  store nothing;
- positions are translated through `memberID`/`memberVec` closures, because a
  repaired index's positions are not pool positions (tombstones, appends);
- there is no refusal outcome: `maxPool` is the crossover between the
  constructions, and no pool is ever too large to cluster, only too large to
  cluster exactly.

### `levelIndexFor` — repair or consolidate, one level

Runs `repairDecision`, then the drift measurement, and only if both pass:
removes first (so a re-minted artifact never scores against a departed one),
then inserts in pool order, each seeing the pool as repaired so far. Any
refusal falls through to `buildLevelIndex` — the consolidation — and the
outcome records which happened and why.

## What a repair cannot catch (yet)

The diff is by artifact id. An artifact whose id survived but whose *vector*
changed — today that means an embedding-identity re-route, which re-embeds
every window while `keepIDs` preserves ids — is invisible to the id diff.
The drift bound catches the aggregate shift when it is large; a per-artifact
vector fingerprint in the index would catch it exactly, and is the noted
hardening if identity re-routes become routine rather than exceptional.
