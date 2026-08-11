# On-demand normalization: normalizeStoredBase no longer mutates on read

Part 2 (option b) of the concurrency/execution-model work (plan:
[`docs/superpowers/plans/2026-07-26-document-concurrency-and-job-model.md`](../superpowers/plans/2026-07-26-document-concurrency-and-job-model.md)).
Record 0092 stopped the store from *sharing* loads; this stops the read path from
*mutating* the base it loads.

## The smell

`normalizeStoredBase(base *Base, …)` wrote layout defaults, row track weights, and
block styles **in place** at ~9 load sites. It was only safe because record 0092
made each load a private copy — but "a load mutates the thing it loaded" is the
anti-pattern that produced the original race. Normalization is *derived* data; a
load should be read-only.

## What changed

- **`normalizeStoredBase(base Base, pageLayout, rules) Base`** — now takes the
  base by value, clones it, normalizes the clone, and returns it. Pure: it never
  writes through to the caller's `Base`.
- **All 8 call sites** (`service.go` ×7, `template.go` ×1) changed from
  `normalizeStoredBase(&x.Base, …)` to `x.Base = normalizeStoredBase(x.Base, …)`.

No API/contract change: `Get`/list responses still carry normalized tracks, so
the frontend is unaffected. Deriving track weights on demand and dropping
read-path normalization entirely (option a) remains a deliberate follow-up gated
on a frontend check — see Task 2.2 in the plan.

## Verification

- New internal `TestNormalizeStoredBaseIsPure`: a multi-block row is normalized in
  the result (tracks `[50,50]`, layout defaulted) while the input's tracks stay
  `nil` and its page layout stays zero. Fails before (in-place mutation), passes
  after.
- Full `go test ./core/capability/document/` green; `-race` clean; companions at
  zero drift.

## Settled

- The read path is pure — normalization returns a copy, nothing is mutated on
  load. ✓
- `Get` still returns normalized tracks (no contract change). ✓
- Treating track weights as fully derived (option a) is a future document-model
  change, not done here.
