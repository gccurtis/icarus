# 0143 — Clusters bigger than k

Record 0142 named the sparse path's divergent regime — a natural cluster
larger than k — flagged it for live validation, and recorded a candidate fix
(a degree-based final attempt in the retry ladder). This record replaces that
answer with a better one, and the better one came from a design question asked
in review: *"if the cluster is larger than k, can we just select the top k and
make that a cluster itself?"*

Almost. A raw top-k neighbourhood is star-shaped — everything is similar to
the seed, not necessarily to each other — so it cannot carry the guarantee a
KLR cluster makes (every pair above threshold). But a *verified* neighbourhood
can: grow the cluster through the seed's strongest neighbours and admit a
member only if it clears the threshold against every member already admitted.
Exact dot products, at most degree² of them. The emitted cluster then
guarantees exactly what a clique guarantees; what it gives up is maximality
and overlap — which is precisely the part that explodes.

## The test that killed the first design

The first implementation kept the percentile retry ladder and fell back to
verified neighbourhoods only when all eight attempts exploded. A new test —
groups of 100 under k=16, asserting that *some* node eventually reassembles
each group — failed spectacularly: best-node F1 of **0.077**.

The failure taught the real lesson. In the over-k regime the ladder does not
fail; it "succeeds" — it raises the threshold into the top sliver of the
within-cluster similarity distribution and gets an acceptable clique *count*
with garbage *structure*: tiny cliques, mass orphans. And because a uniform
cluster looks the same at every threshold, the next level reproduces the same
confetti, and the ascent never converges. The fallback never fired because its
trigger — ladder exhaustion — almost never trips.

## The fix: switch construction, not threshold

The ladder exists in the dense path because raising the threshold was its only
lever against clique explosion. The sparse path has a second construction, so
it does not need the lever:

- **One attempt** at the base percentile threshold. If the cliques are
  acceptable, this is the regime where the sparse path matches the exact path
  bit for bit (the pinning test from 0141 still passes).
- **If they explode, that is the dense-regime signal.** Switch to verified
  neighbourhoods at the *same* threshold. No raised threshold, no confetti.

The k-cap fragmentation heals one level up: a cluster of 100 shatters into a
handful of degree-sized fragments whose centroids are near-identical, so the
next level cliques the fragments back together. That claim is now held to a
number rather than asserted: `TestOverKClustersReassembleUpTheLattice` — six
groups of 100, k=16, sparse forced at every sizable level — requires a node
per group at F1 ≥ 0.9 and no node mixing groups. Result: **F1 1.000 for every
group**, against 0.077 under the ladder.

The target regime is unchanged: the recall harness still recovers 60 of 60
exact clusters (recall 1.000), the bit-exact overlap test still passes, and
the benchmark moved within noise (2.70s at 4,000; 14.9s at 20,000).

## What this closes and what it leaves

Closed: 0142's open question. The over-k regime no longer degrades to "a level
that yields nothing" or to confetti; it degrades to fragments-then-reassembly,
with the mutual-similarity guarantee intact throughout.

Left open, deliberately: the fallback's clusters do not overlap, where true
KLR cliques may. Overlap only mattered in the regime the exact path also
handles badly (clique count past the pool size), and non-overlap is what makes
the greedy construction deterministic and linear. If live validation shows
overlapping membership pulling real retrieval weight, that is the place to
revisit.
