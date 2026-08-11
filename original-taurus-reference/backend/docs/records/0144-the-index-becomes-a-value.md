# 0144 — The index becomes a value

First step of the "local events + consolidations" plan: the sparse
construction now produces a `levelIndex` — edges, pinned threshold, projection
basis, IVF cells — and that value supports `insert`, `remove` and `drift` as
pure operations. Nothing is persisted yet; this record is the machinery and
its correctness gate.

## The design in one sentence

A write becomes a *local event* (repair the graph through the stored cells,
keep the pinned threshold) and the system *measures* when locality stops being
honest (`drift` re-samples the pair distribution and reports how far the pin
has strayed) — at which point a full rebuild consolidates: refit, re-quantize,
re-pin.

## Two implementation choices worth recording

**Inserts skip the approximation layer entirely.** The full build pre-scores
candidates in projected space and reranks the best 3k exactly, because the
n×candidates term is the build's bulk. One insert's candidates are a couple of
million multiplies — so the insert scores every candidate exactly from the
start. Cheaper to reason about, and it removes a whole class of divergence
from the fresh-build result.

**Removals do not backfill.** A removed vertex's neighbours lose one edge and
do not go looking for their next-best candidate. That is bounded degradation —
at most one edge per neighbour per removal — and the next consolidation heals
it. The alternative (per-removal candidate searches) would make removal cost
what insertion costs, to defend edges the threshold mostly prunes anyway.

## The equivalence gate

`TestRepairedIndexMatchesRebuilt` holds repair to the only standard that
matters: an index maintained through a re-sync-shaped batch — 50 removals and
100 inserts against a 700-artifact pool — must match a **full rebuild over the
same final pool**. In the target regime (groups under k) the agreement is
total: thresholded edge-set Jaccard **1.0000** (6,690 of 6,690 edges),
identical clusters, drift within tolerance, and the whole sequence
deterministic.

Two comparisons that had to be built honestly:

- **Only thresholded edges are compared.** A vertex's spare below-threshold
  slots are edges clustering never reads, and the two constructions
  legitimately fill them differently. Comparing raw edge sets measured noise
  (Jaccard 0.74) and would have either failed a correct implementation or
  forced a meaningless tolerance.
- **The first fixture was dishonest, and failed loudly.** At dim 64, forty
  random group centres correlate enough that cross-group similarities leak
  past the 0.30 floor — the "true" structure was genuinely messy (a fresh
  build found 501 clusters over 40 groups). The failure was the fixture
  describing a world the floor is designed to reject; at dim 256 the groups
  separate and the gate means what it says.

## What is next

Persistence (two tables, the Store port extension) and the repair-aware
corpus rebuild with the drift + changed-fraction consolidation triggers —
per the approved plan.
