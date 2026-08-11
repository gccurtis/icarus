# 0147 — The query probes the same index

The retrieval half of the persisted index, closing the plan. Descent's entry
scan loads and scores **every** entry-frontier artifact per query — linear in
the frontier, which at target scale means ~0.16s and a full vector load per
retrieval when the frontier is orphan-heavy. With `descent.probe: true` the
query is projected through the stored level-1 basis, placed among the IVF
cells with the same `nearestCells` the graph build uses, and only the probed
cells' members are loaded and scored.

The idea came from review — "we can kinda do the same PCA to identify at the
top who you should look into first" — and lands almost free because
everything it needs was already persisted for repair.

## The rule that keeps the probe honest

An entry artifact the index covers survives only if its cell is probed; an
artifact the index does **not** cover always survives. That remainder is
load-bearing, not defensive:

- **Corpus roots are never in the level-1 index** (the index covers the
  level-1 pool; roots are its outputs), so clustered content always retrieves
  through its roots, probe or no probe.
- **Anything written since the index was stored** is uncovered until the next
  rebuild, so a fresh add is retrievable immediately, not after a job runs.

The probe therefore narrows exactly one thing: the orphan mass — which is
precisely what makes an entry frontier large. A missing or degenerate index
falls back to the full scan; the probe is an optimization over the same
entries, never a precondition for retrieval.

`intPlaceholders` renders an empty cell list as `NULL`, so probing zero cells
returns exactly the uncovered remainder — the degenerate case the store test
pins alongside single-cell and all-cells probes.

## Verification

Store-level, both implementations: covered artifacts appear only under their
probed cells, uncovered artifacts always, all-cells equals the full frontier,
`CorpusIndexHeader` returns machinery without artifacts. End-to-end:
clustered topics retrieve through their (uncovered) roots, a lone orphan
retrieves through its probed cell, probe-on and probe-off return identical
regions on the fixture, and a project with no stored index retrieves through
the fallback.

Ships `probe: false`. The existing `descent.audit` machinery measures the
probe's recall delta on real embeddings — descent runs *inside* the audit's
comparison, so no new measurement plumbing was needed — and that number is
the gate, the same discipline as `descent.enabled` and `neighbors.enabled`
before it.

## Not done, on purpose

The probe reads the level-1 index only. Probing deeper levels would narrow
the corpus-root scan too — but roots are few by construction, and the win is
in the orphan mass. If a live profile ever shows the root scan mattering,
the same machinery extends level by level.
