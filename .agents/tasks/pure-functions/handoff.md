# pure-functions

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Never copy credentials into this file.

## Snapshot

- Updated: 2026-09-11T16:19:50-04:00
- Status: PF-01 through PF-16 checker layer implemented and verified; product
  migration intentionally not performed in this checker-only pass
- Worktree: `/home/jakul/cyberia/icarus-worktrees/pure-functions`
- Branch: `work/pure-functions`
- Current implementation head: `4abfa144d3b1b17db305b0d6f70e489bbfac4f32`
- Integration target / recorded base: `origin/main` /
  `b152b52ddd1fef5dfdaf8e2a4b6d03796cf011fd`
- Lead: root; no delegated workers

## Request and settled contract

Create enforceable architecture checks for authority-pure capability API,
model-method, and component-procedure functions. They may call explicit ports
with mutators, but may not discover authority. Model behavior is free: a stored
field such as `runtime.body` is legal, while derived behavior is called as
`getBody(runtime)` rather than attached as a getter or method.

The normative design is [contract.md](./contract.md). It defines closed
capability islands, field-only model state, state-first free model operations,
`port.ts` acquire/commit/release lifecycles, runtime-only model construction,
exact capability transformers, a static registry and central authenticated
gateway, one staged commit owner, component adapter/effect boundaries, and
generator requirements.

The user clarified during implementation that this delivery is the checker
layer only. Do not fold product/runtime/model migration into this checkpoint.
Existing findings are the migration roadmap and remain unbaselined.

## Implemented

- PF-01/PF-02: filesystem-derived pure-island ownership, real TypeScript module
  resolution, transitive import/type closure, lexical provenance, ambient
  authority, module-state, structured-async, and port-introspection checks.
- PF-03 through PF-05: closed exports, field-only model state, and state-first
  free model operations.
- PF-06/PF-07: exact model port lifecycle and runtime-only construction/binding.
- PF-08 through PF-13: local capability contracts, exact runtime transformers,
  registry/remote bijection, sole remote gateway, unconditional reverse release,
  and one staged commit owner with named checkpoints.
- PF-14/PF-15: closed component procedures, exact owner adapters, markup wiring,
  and explicit effect/rune boundaries.
- PF-16: generators must emit the target contract and be covered by pristine
  output verification.
- Shared AST/type/registry helpers, catalog wiring, positive fixtures, and
  adversarial mutations were added. All new checks use `baseline: false`; no
  suppression or architecture baseline was added.

## Verification

Run from `app/` unless noted:

| Check | Result |
| --- | --- |
| `node --check` over every changed checker/test module | passed |
| `node --test --test-isolation=none scripts/test/pure-functions.test.mjs` | 16/16 passed |
| `node --test --test-isolation=none scripts/test/checker-catalog.test.mjs` | 1/1 passed |
| `node --test --test-isolation=none scripts/test/lint.test.mjs` | 286/286 passed |
| Direct execution of PF-03 through PF-16 against the production tree | all ran without checker errors; current architecture intentionally reports findings |
| `git diff --cached --check` before implementation commit | passed |

The current production counts observed for PF-03 through PF-16 were:

```text
PF-03 553   PF-04 50    PF-05 102   PF-06 15
PF-07 2     PF-08 307   PF-09 16    PF-10 95
PF-11 261   PF-12 1     PF-13 0     PF-14 1147
PF-15 420   PF-16 27
```

PF-13 has no current record to evaluate because PF-10 already reports the
missing canonical registry. Its duplicate/staged-owner mutation proof passes.
Earlier PF-01/PF-02 production observations were 5,864 and 3,862 findings.

## Commits and publication

- `9bef8e2` — initial explicit-dependency prototype
- `fcc92c5` — normative pure-islands runtime contract
- `b8e72c7` — resolved PF-01/PF-02 enforcement foundation
- `4abfa14` — complete PF-03 through PF-16 checker layer and tests
- Branch push is authorized to `origin/work/pure-functions`; no integration,
  rebase, deployment, or push to `main` is authorized.

## Remaining work and next step

- The product and generators do not yet conform; architecture lint is expected
  to stay red without a baseline until migration completes.
- Runtime descriptor/lifecycle, concurrency, rollback, durable recovery, and
  authority-race behavior still require executable product implementations and
  their focused tests. Static checks deliberately do not claim those runtime
  properties by themselves.
- No server, browser, Store, native-file data, or provider process was started.
- Next executable step, if requested: choose one vertical migration slice
  (recommended: one read-only model plus one read capability), make its new PF
  findings green, then prove the lifecycle behavior before broad rollout.
