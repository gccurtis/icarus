# 00 · Orientation

## Repository map

```text
icarus/
  apps/backend/          @icarus/backend — the subject of these notes
  apps/frontend/         Vite client (not read for these notes)
  packages/shared/       Cross-runtime DTOs. Currently ONE interface: ApiHealth.
  infra/devshell/        Nix flake dev environment
  docs/                  Architecture + per-topic design pages
  scratch/               Live design drafts, ahead of the code
```

The monorepo is pnpm workspaces (`apps/*`, `packages/*`) with a shared
`tsconfig.base.json` (ES2022, NodeNext, `strict: true`, `skipLibCheck: true`).

`packages/shared` is nearly empty by design — the shared-contract rule
(`docs/runtime/repository-boundaries.md`) says a type stays capability-owned unless two or
more runtime *or frontend* consumers need the same semantic contract. In practice almost
nothing has met that bar yet.

## Backend layout

```text
apps/backend/
  etc/configuration.yaml   All tuning values and limits (see below)
  data/*.db                SQLite files, one per capability, gitignored
  logs/backend-YYYY-MM-DD.log
  src/
    0-platform/     database formula intelligence knowledge observability rich-text web-retrieval
    0-utils/        config jobs types
    1-init/         create/ startBackend.ts
    2-transport/    registerHttpTransport.ts
    3-capabilities/ activity built-in connector context derived-outputs document
                    general-files slide structured-data
    4-job-wiring/   activity connector context derived-outputs document general-files
                    internal slide structured-data
    index.ts
  test/
    capabilities/*.test.ts   16 files, 155 tests, node:test
    helpers/testDoubles.ts
    smoke/http-smoke.mjs     Live HTTP smoke runner (separate script)
```

Source volume by layer (approximate, excluding tests):

| Layer | Lines | Share |
| --- | --- | --- |
| `3-capabilities` | 22,752 | 62% |
| `0-platform` | 9,245 | 25% |
| `4-job-wiring` | 1,945 | 5% |
| `1-init` | 1,363 | 4% |
| `0-utils` | 1,149 | 3% |
| `2-transport` | 125 | <1% |

The shape is deliberate: transport is 125 lines because it does nothing but normalise and
delegate; the weight sits in capability domain logic. Document alone is 8,416 source lines
plus 3,850 lines of tests.

## Toolchain

| Task | Command | Notes |
| --- | --- | --- |
| Dev | `pnpm dev:backend` | `tsx --conditions=development watch src/index.ts` |
| Test | `pnpm --filter @icarus/backend test` | `tsx --test --test-concurrency=1 test/capabilities/*.test.ts` |
| Typecheck | `pnpm --filter @icarus/backend typecheck` | `tsc --noEmit` |
| Build | `pnpm --filter @icarus/backend build` | `tsc -p tsconfig.json` → `dist/` |
| Smoke | `pnpm --filter @icarus/backend test:smoke` | Requires a running server |

Environment is Nix (`nix develop`). Node is not on `PATH` outside the dev shell; inside a
bare shell you can reach it via the store path, e.g.
`/nix/store/*-nodejs-slim-24.18.0/bin/node`.

`--test-concurrency=1` is not incidental. Several capability suites open real SQLite files
under `data/` with project-hashed table prefixes; running them in parallel would have them
contend on the same database files.

## The `--conditions=development` mechanism

`package.json` `imports` map each `#alias` to a **three-way conditional**:

```json
"#document": {
  "development": "./src/3-capabilities/document/index.ts",
  "types":       "./src/3-capabilities/document/index.ts",
  "default":     "./dist/3-capabilities/document/index.js"
}
```

So `dev` and `test` scripts pass `--conditions=development` to resolve aliases to **source**,
while `pnpm start` (plain `node dist/index.js`) resolves them to **built output**. There is a
regression test asserting the dev script keeps that flag
(`runtime-wiring.test.ts` → "the backend dev command selects TypeScript source imports
instead of stale dist files"), because dropping it silently runs stale `dist/`.

## Configuration

Everything tunable lives in `apps/backend/etc/configuration.yaml`, parsed by
[`loadBackendConfig.ts`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts) into a
single `BackendConfig`. The loader has a complete `DEFAULT_CONFIG` and merges the YAML over
it field by field with typed parsers, so a missing or malformed key degrades to the default
rather than crashing.

Config sections: `server`, `workerPool`, `queue`, `logging`, `intelligence`
(providers/inference routes/reasoning routes/embedding), `formula` (13 limits),
`structuredData`, `richText`, `context`, `derivedOutputs`, `document` (structural history
limits + 7 content limits), `retention` (revision age + sweep cadence), plus top-level
`projectId` and `userId`.

Two notable rules:

- **No magic numbers in engines.** `formula/limits.ts` carries the comment "all values come
  from config, none hardcoded in the engine". The Formula engine takes `FormulaLimits` at
  construction and accepts per-request overrides.
- **One env override only.** `OPENROUTER_API_KEY` replaces the YAML value, and only when the
  YAML still holds the literal placeholder `replace-with-openrouter-api-key`. `.env` is
  loaded from cwd and then from the repo root by `src/index.ts`.

`projectId` and `userId` are bound **once at startup** and never travel over HTTP — see
[04-state-and-persistence.md](04-state-and-persistence.md#project-scoping) and
`docs/platform/runtime-scope.md`.
