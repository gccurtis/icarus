# 0158 — One ascent, and the crossover measured

Two loops of the same shape built the lattice. `ascend` (lattice.go) built a
source's own forest over its windows; `buildCorpusIndexed` (repair.go) built
the project-wide corpus tier over the frontier. Level guard, threshold draw,
clique pass, representative minting, orphan carry, progress guard: duplicated,
line for line.

They differed in exactly one thing, and it was never about scope — only the
corpus copy knew a persisted k-NN index existed and could be *repaired* rather
than rebuilt. A change to how the lattice is built could land in one tier and
miss the other, and nothing would say so.

## What changed

`ascend` takes an `ascentScope` — the project, the `localRefID` (empty is the
corpus tier), and whatever level indexes that scope persisted — and returns an
`ascentResult` of nodes, indexes to persist, and per-level repair outcomes.
`buildCorpusIndexed` is deleted. The corpus tier is the call with an empty
`localRefID` and the project's stored indexes; a source is the call with its own
`localRefID` and none.

Two smaller subtractions rode along. `buildLevelSparse` was a one-line wrapper
carrying a large comment about why the sparse path has no percentile-raising
retry ladder; the comment moved onto `(*levelIndex).cluster`, which is what it
described, and the wrapper is gone. `repair.go`'s header no longer claims to be
an ascent — it is the repair policy and the persistence form, and it says so.

**Be honest about the payoff.** The real corpus averages ~2 windows per file,
so a typical source ascent is a 2×2 matrix and this saves it nothing. The
justification is that there is one loop instead of two, and that the repair
machinery stopped being corpus-specific. No performance claim is made for the
source tier and none was measured.

## Neither branch became a flag

Records 0148–0149 removed switches from the mechanics. Two decisions choose
machinery here, and both fall out of the inputs:

- **Construction is chosen by pool size.** `maxPool` is the crossover between
  the complete matrix and the k-NN graph, per level, not a ceiling.
- **Maintenance is chosen by index presence.** `repairDecision` already
  answers "no stored index → build in full", so a scope that has never stored
  one needs no special case and a two-window source needs no size threshold.

## The decision Phase 7 forced: should an exact level persist an index?

Only the sparse path persists one today, which means the crossover silently
decides whether a project gets incremental clustering at all. A 3,000-artifact
project re-clusters from scratch on every write while repair measured 15.7× at
20,000 (record 0150). The question was deferred to this phase.

**Decided: no.** An exact level neither persists nor consults an index.

Three reasons, in ascending order of weight.

**It costs more, not less.** Persisting an index for an exact level means
*building* one — fit the PCA basis, k-means ~√n cells, run candidate search per
vertex — on top of the n×n matrix the level has already computed. Measured
below: at n=2,000 the two constructions cost 1.83s and 1.70s separately, so a
level that did both would cost ~3.5s. You pay that on every consolidation
against a repair that may never come.

**It would make the construction depend on history.** Once the index exists,
the next rebuild has to decide what it is *for*. If it clusters over it, a
sub-crossover pool is being clustered over a k-NN graph, which is precisely
what `maxPool` says does not happen. The same pool would then cluster one way
on the build that mints the index and another way on the repair that reads it —
and node ids are content-addressed, so ids churn at that transition and churn
back the next time a consolidation is forced. If it does *not* cluster over it,
the index is write-only state. Measured, the two constructions agree on
0.987–1.000 of level-1 clusters, so the churn would be small; that is what
makes it dangerous rather than what makes it acceptable. Falsifying the gate
made the point concretely — widening the sparse branch to fire on index
presence produced **identical nodes** and betrayed itself only through the
index and the outcome it leaked.

**The lever that answers the real concern is a number, not a mechanism.** If a
3,000-artifact project should get incremental clustering, lower `max_pool`
below 3,000 and it gets it — with the *same* construction on every build and
every repair, no history dependence, and no transition to churn ids at.
Configuration holds numbers only; that is exactly the shape of change records
0148–0149 permit.

## The crossover, measured

`BenchmarkCrossover` runs the same pools through both constructions at
production dimension (1,536), reporting wall time and the fraction of the exact
construction's level-1 clusters the sparse one reproduces by
content-addressed id — literally "would the ids churn?".

| n | exact | sparse | agree | level-1 nodes |
| --- | --- | --- | --- | --- |
| 500 | 0.12s | 0.70s | 1.000 | 25 |
| 1,000 | 0.42s | 1.20s | 1.000 | 50 |
| 2,000 | 1.83s | 1.70s | 1.000 | 100 |
| 3,000 | 4.46s | 2.60s | 0.987 | 156 |
| 4,000 | 8.34s | 3.03s | 1.000 | 200 |

**The time crossover is ~2,000, not 4,000.** The 4,000 default came from a
memory budget (128MB of matrix) and was never timed. So pools between ~2,000
and 4,000 are currently clustered by the *slower* construction and denied
incrementality at the same time — the open question was right to call this the
strongest consideration.

**The default is not changed here, deliberately.** The measurement is one
synthetic fixture on one machine; what it cannot tell us is how the two
constructions diverge on real prose, where record 0151 already saw
`descent.threshold` sitting marginally and one topical query falling back.
Moving the crossover moves which construction a real corpus gets, and the suite
that would catch a regression — `dev-test/knowledge-scale` — needs a provider
key this tree does not have. **What would need to be true:** one live
`knowledge-scale` run at `max_pool: 2000` showing the pinned threshold stable
and grounding unchanged on all three topical queries. Then it is a one-line
config change with evidence behind it.

## The gate

`ascent_differential_test.go` holds frozen copies of both pre-collapse loops
and requires the unified one to reproduce each: nodes (identity, membership,
level, count, cohesion, centroid), the indexes handed back for persistence, and
the outcome log. Fixtures cover an exact multi-level ascent, a level-1
crossover, the over-k fallback, degenerate pools, and every branch of
`levelIndexFor`.

It needed a new fixture to be worth anything. `clusteredVectors`' groups come
out mutually near-orthogonal, so an ascent over them stops after one level and
the half of the loop that clusters a pool of *centroids* goes untested.
`hierarchicalVectors` gives the pool two scales of structure and reaches three
levels.

**Falsified twice, and the first attempt found a hole in the gate rather than
in the code.** Making the sparse branch read member vectors at pool positions
instead of index positions *passed*: the repair fixture stored a prefix of the
same pool, so the repaired index's positions happened to line up and the two
coordinate systems never disagreed. The fixture now offsets the stored index
from the pool — ten artifacts leave as tombstones, ten arrive as appends — and
the same break fails immediately. The second break, dropping `localRefID` from
`nodeID`, passed the corpus half (it is empty there) and failed the source half
on every fixture with identical member sets under different ids: record 0140's
id churn, invisible to every other test in the package.

`ascent_scope_test.go` pins the decision itself — an exact level handed a
perfectly repairable index produces identical nodes, no index and no outcome —
and its corollary: a **source**-scoped ascent handed a stored index repairs,
and reaches the same 40 level-1 node ids a consolidation reaches. That is
record 0146's equivalence gate, now holding for a tier that had no index
awareness at all.

## What this leaves open

A source ascent's index has nowhere to go: `knowledge_corpus_index` and
`knowledge_corpus_edges` are keyed on `(project_id, level)`. Source-tier
incrementality is now purely a storage question — add `local_ref_id` to that
key and the ascent already produces and consumes the value. Worth doing when
something needs it; a 1,250-window textbook re-syncing repeatedly is the case,
and it is narrow.

The design doc's Phase 7 gate asked for "a repaired-vs-rebuilt source producing
identical node ids", which assumed a source would persist an index. It cannot
yet, so that gate is met at the ascent's boundary (the test above hands the
index in) rather than end to end through the store. Noted rather than papered
over.
