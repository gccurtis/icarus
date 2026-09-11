## Two suites

`pnpm test` is `svelte-kit sync && vitest run`: every `*.test.ts` under `src/`, 55 files, run with `environment: "node"` as [[file:app/vite.config.ts]] sets, Vitest's runner, and `node:assert/strict` for assertions. `pnpm test:scripts` is `node --test --test-concurrency=1` over `scripts/test/*.test.mjs` and `scripts/generation/*/test/*.test.mjs`: the linter's own proof that every check fires, and the generators' proof that what they write passes. They are different runners over different directories and neither invokes the other. `pnpm build` runs neither; it runs `typecheck` and then `vite build`.

Test files sit in a `test/<kind>/` directory beside the unit they exercise, where `<kind>` is `unit`, `regression` or `non-functional` ([[check:tests-are-one-of-three-kinds]]). Every test file's home is `test`, so it may import client and server code alike.

## Coverage by tree

The table below is derived: each test file's non-test imports are what it exercises, and each source file's page lists the test files that import it. A tree with many source files and few tests is visible at a glance. The `components` tree has one test file for 391 sources — the vocabulary is reviewed on demo pages rather than tested — and `surfaces` and `styles` have none.

## Gaps

Named, not implied. What is not tested is listed here from the extraction rather than from memory; the [[page:/gaps#test-gaps|Gaps]] page repeats the list beside the other gaps.
