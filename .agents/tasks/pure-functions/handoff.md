# pure-functions

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Never copy credentials into this file.

## Snapshot

- Updated: 2026-09-11T18:18:04-04:00
- Status: PF-01 through PF-16 checker layer implemented; client configuration
  is the first end-to-end migrated model and has two served reference pages
- Worktree: `/home/jakul/cyberia/icarus-worktrees/pure-functions`
- Branch: `work/pure-functions`
- Current implementation head: `0186484b13d5d9717faa65ba14c40f16fe1647ef`
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

The initial delivery was checker-only. The subsequent request explicitly
authorized one complete model migration, beginning with the small read-only
client configuration model. Existing findings outside that slice remain the
migration roadmap and remain unbaselined.

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
- Client configuration now has flat field-only state, a closed 13-key numeric
  contract, state-first free operations, and a runtime-owned read-only adapter
  with fresh acquire/commit/release leases and workspace close.
- The split client composition root constructs and binds configuration once,
  translates it into downstream-owned settings records, and releases its lease
  in `finally`. Server layout admission publishes one exact finite-number
  allowlist.
- `/demo/pure-functions` documents the complete contract and all 16 enforcement
  layers. `/demo/pure-functions/configuration` documents the migrated model and
  embeds exact live worktree source, including server-only source loaded across
  a server data boundary.
- The prior 86-file TypeScript Wiki application was moved byte-for-byte to
  `docs/archive/wiki/`. The replacement Markdown Wiki begins with the reusable
  `wiki/templates/model.md` contract and the comprehensive
  `wiki/models/configuration.md` instance.

## Verification

Run from `app/` unless noted:

| Check | Result |
| --- | --- |
| `node --check` over every changed checker/test module | passed |
| `node --test --test-isolation=none scripts/test/pure-functions.test.mjs` | 16/16 passed |
| `node --test --test-isolation=none scripts/test/checker-catalog.test.mjs` | 1/1 passed |
| `node --test --test-isolation=none scripts/test/lint.test.mjs` | 286/286 passed |
| `pnpm test` | 2,086 passed; 2 existing skips |
| `pnpm typecheck` | 0 errors; 0 warnings |
| Focused PF-01 through PF-07 scan of `client/configuration` and its runtime builder | all 7 clean |
| Focused legacy runtime/ownership architecture checks | 6/6 clean |
| Chromium `pure-functions-reference.spec.ts` | 3/3 passed at desktop and 390px; 6 Mermaid diagrams, exact source, diagnostics, navigation, and overflow checked |
| Replacement Wiki structure | all 86 previous Wiki files detected as 100% Git renames; template has balanced fences; configuration reference has four Mermaid blocks |
| Configuration Wiki source audit | all 11 embedded production source blocks matched their current files exactly |
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
- `cc39cab` — migrate client configuration end to end and add the served contract/model references
- `0186484` — archive the prior Wiki and add the model template plus configuration reference
- Branch push is authorized to `origin/work/pure-functions`; no integration,
  rebase, deployment, or push to `main` is authorized.

## Remaining work and next step

- The rest of the product and generators do not yet conform; architecture lint
  is expected to stay red without a baseline until migration completes.
- Runtime descriptor/lifecycle, concurrency, rollback, durable recovery, and
  authority-race behavior still require executable product implementations and
  their focused tests. Static checks deliberately do not claim those runtime
  properties by themselves.
- An isolated disposable review server is intentionally left running on port
  `3197`; it owns no development Store data and should be stopped through its
  recorded helper session when review is complete. Chromium used the configured
  system executable; no providers were called.
- Next executable step: review the configuration slice and contract pages, then
  choose the next client model. A staged mutable model should follow soon enough
  to prove commit isolation, rollback, and conflict behavior rather than
  generalizing only from this read-only slice.
