# 0146 — Local events and consolidations

The rebuild becomes what the plan promised: a write is a **local event** —
repair the persisted index through its cells, keep the pinned threshold —
until the system *measures* that locality has stopped being honest, at which
point the level **consolidates**: refit the projection, re-quantize the
cells, re-pin the threshold. Nothing decides this by guesswork; two measured
bounds do:

- `repair_max_fraction` (default 0.2): the changed fraction — inserts plus
  removes over the pool, diffed **by artifact id** — a stored index may
  absorb. Past it, repairing costs what building costs.
- `repair_max_drift` (default 0.02): how far the pinned threshold sits from
  the pool's *current* percentile, re-sampled on every repair for ~0.15s.
  Past it, the pin no longer describes the pool and every similarity
  judgement it gates is suspect.

The id diff works because of record 0140: an edited source changes only its
own window ids, so its root's content-address changes while every untouched
root keeps its own — the diff stays proportional to the edit at every level
of the ascent.

## Measured

`BenchmarkLevelRepair` (20,000 artifacts, dim 1536): a 1% delta repairs in
**0.88s** against **13.9s** for the full build — 15.7×. The repair is
dominated by the fixed-size drift sample, so it is effectively flat in the
delta while the rebuild grows with the pool; at the 200k target the ratio
widens further.

## The equivalence gate, end to end

`TestRepairedRebuildMatchesConsolidation` runs the whole machine on one
store: twelve documents built in full, a thirteenth absorbed as a repair
(the log line proves the path — repair and consolidation produce identical
corpora by design, so narration is deliberately the one observable
difference), then a forced consolidation over the same frontier. The
repaired corpus and the consolidated corpus must match **node id for node
id** — content addressing makes "the same clusters" a literal string
comparison.

Unit gates beneath it: `repairDecision` (the policy as a pure function —
every refusal reason fires: no index, disabled, k changed, projection
changed, fraction over), `TestDriftRefusesARepair` (an honest pin with a
zero diff repairs; a lying pin refuses however small the diff), and
`TestStoredIndexRoundTripPreservesClusters` (the persisted form loses
nothing a clustering can see).

## Decisions worth recording

**Exact levels store no index.** A pool within `max_pool` clusters exactly
in milliseconds-to-seconds; persisting machinery for it would add rows whose
only effect is more state to keep honest.

**Removes apply before inserts.** A re-synced source removes its old root id
and inserts its new one in the same diff; ordered this way, the new artifact
never scores against a departed one.

**k or projection changes force consolidation.** A stored index built under
different machinery is not an index of this configuration's graph; the
decision refuses structurally rather than trusting a fraction to catch it.

## The known gap

The diff is by id, so an artifact whose id survived while its vector changed
is invisible to it. Today that means an embedding-identity re-route (which
re-embeds every window while ids persist) — the drift bound catches the
aggregate shift, and a per-artifact vector fingerprint in the index is the
noted hardening if identity re-routes ever become routine.
