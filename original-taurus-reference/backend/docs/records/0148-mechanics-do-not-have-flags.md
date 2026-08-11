# 0148 — Mechanics do not have flags

`neighbors.enabled` and `descent.probe` are gone, and with them the refusal
path they guarded. The principle, stated in review and adopted here: **the
system runs what is most efficient at each point in time — mechanics are not
a menu.** A flag that selects between two ways of doing the same job is a
comparison harness living in production; comparisons belong in tests (where
the reference algorithm is a function beside the real one — see
`TestSparseCliquesMatchDense`, `TestSparseLevelMatchesExactWhenComplete`, the
exact-scan oracle in `probe_test.go`) or across git history (branch off an
earlier commit and measure), never in configuration.

## What the mechanics now are

- **Clustering:** `max_pool` is the crossover, not a ceiling. A level whose
  pool fits inside it clusters over the complete matrix — exact, and fast at
  that size; a larger level clusters over the k-NN graph. No pool is ever
  refused, so the entire refusal apparatus went with the flag: `ascend`
  returns nodes (no `skipped`), `AddResult` lost `SourceClusterSkipped` and
  `CorpusClusterSkipped`, and the "over the clustering bound" warnings have
  nothing left to warn about. Where a flag would have said "the ceiling was
  hit", nothing needs saying — there is no ceiling.
- **Retrieval entry:** descent probes the persisted corpus index whenever one
  is stored, and scans the full entry frontier when none is. Presence of the
  index is the decision, exactly as pool size is the decision above.

What remains in `knowledge.cluster.neighbors` is tuning — `k`, `cells`,
`pca_dims`, the repair bounds — knobs that calibrate quality against cost
without selecting mechanics. (`descent.enabled`/`audit` predate this program
and still select retrieval mechanics; they are the same pattern and the same
argument applies, but retiring them is its own decision, not a rider on this
one.)

## Validated before the switch was pulled

The flags earned their removal in the order the discipline demands: the live
suite ran against real embeddings with both forced on — once with the source
tier sparse, once with the corpus tier sparse and the probe reading a stored
index — and every quality assertion held (topical retrieval lands on the
right source, descent recovers the exact scan's best hit at audited recall 1),
at ~600 tokens total. The unit gates (recall 1.000 harness, Jaccard 1.0000
repair equivalence, F1 1.000 reassembly) had already pinned the mechanics to
the exact construction wherever the two overlap.

## The comparison story going forward

Tuning replaces toggling. `k`, `pca_dims`, the percentile, the repair bounds
are measured with the harnesses in-tree; a *mechanics* question ("was the old
construction better?") is answered by branching the git history at the record
that replaced it and running the same harness there. That is deliberately
more friction than flipping a flag — a mechanics regression should be a
deliberate investigation, not a config rollback that leaves both
implementations alive forever.
