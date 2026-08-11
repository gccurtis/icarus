# 0149 — Retrieval is descent

The last two mechanics flags are gone: `descent.enabled` and `descent.audit`.
Record 0148 stated the principle; this record finishes applying it. Config now
holds only numbers — caps, limits, calibration — and every mechanism decision
in the knowledge capability is made by the system itself: clustering
construction by pool size, entry probing by index presence, and now retrieval
by nothing at all, because there is only one retrieval path.

## What each flag mapped to, and what replaced it

**`descent.enabled`** chose between the exact scan (rank every window) and
directed descent (walk the lattice). The shipped config already said which was
the design — "an exact scan over every window is a fallback, not a design" —
so the flag was a stale hedge. `Retrieve` now descends, always. The exact scan
survives in exactly two places, neither of them a mode: the in-production
fallback when descent surfaces no candidates (presence-based, like everything
else), and **`RetrieveExact`** — a separate, exported, named function that is
the reference algorithm.

**`descent.audit`** ran the exact scan alongside descent on every request and
reported the recall delta. The config comment already convicted it: "nothing
should ship comparing two paths on every request. It belongs in a test." It
now does: `TestDescentMatchesExactOnCohesiveCorpus` and the probe tests hold
`Retrieve` to `RetrieveExact` on deterministic fixtures, and the live suite
asserts outcome quality directly (the right source, in descent mode) instead
of shipping the comparison. `RetrieveResult` lost its `Audit` payload;
`RetrieveAudit` is deleted.

`RetrieveExact` is the user's stated pattern verbatim: when comparing our
algorithm against another, "the other algorithm is a separate function" that
tests call — not a production toggle that keeps both alive forever and asks an
operator to know which is which.

## What config says now

```yaml
descent:
  beam: 3        # node-children followed per expansion
  threshold: 0.35 # minimum query similarity to follow or collect
```

Two numbers. The knowledge block's preamble now states the rule once: tuning
lives in configuration; mechanics do not.

## Tuning across combinations

With mechanics fixed, the remaining question is calibration — k, pca_dims,
percentile, beam, threshold, the repair bounds. The in-tree harnesses are the
sweep surface (the recall harness, the reassembly test, the repair
equivalence gate all take their numbers from `clusterConfig`), and a
combination sweep over them is cheap because none needs a provider. That is
follow-on work; this record only fixes where such experiments live: in tests,
against named oracles, never behind production flags.
