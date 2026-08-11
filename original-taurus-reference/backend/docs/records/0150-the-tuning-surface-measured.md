# 0150 — The tuning surface, measured

Mechanics are fixed (records 0148–0149); what remains is numbers.
`BenchmarkTuningSweep` sweeps the sparse construction's two quality knobs — k
and pca_dims — against the exact construction on the target-regime fixture
(1,200 vectors, 60 groups of 20), reporting level-1 cluster recall by
content-addressed node id. Opt-in, provider-free, deterministic.

First run (dim 256):

| k | recall | level-1 nodes (exact: 60) |
|---|---|---|
| 8 | 0.00 | 171–173 (fragments) |
| 16 | 0.27 | 88 |
| 32 | 0.98–1.00 | 60–61 |
| 64 | 1.00 | 60 |

Two readings, both expected and now measured rather than argued:

- **k must clear the natural cluster size with margin.** At or below it (8, 16
  against groups of 20) the verified-neighbourhood fallback fragments clusters
  — by design, reuniting a level up — so id-recall is the wrong gate there
  (the reassembly F1 test is). At k=32 the sparse construction reproduces the
  exact one outright; k=64 buys nothing. The default (32) holds for corpora
  whose redundancy groups stay under ~30; raise it with the data, not on
  principle.
- **pca_dims shows its cost here and its benefit only at scale.** At n=1,200,
  dim 256, full-dimension candidates (pca −1) are fastest — the basis fit
  costs more than it saves. The projection pays at production scale
  (BenchmarkAscendSparse: n=20,000, dim 1536), so do not "tune" it off from
  this table alone; the timing column of a small fixture does not generalize,
  the recall column does (64+ projected dims lose nothing; 32 lost one
  cluster).

Descent's own knobs (beam, threshold) tune against real embeddings, not this
fixture — the live suite is their surface, when that calibration is wanted.
