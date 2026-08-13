# Backend Directory Reorganization

## Status

**Done.** `apps/backend/src` has moved from its numbered-layer layout into the target organization.
Files moved, directories were renamed, and import paths were rewritten. No behaviour changed, no
storage engine changed, and no job system changed.

That restraint was the point. Two much larger changes are queued behind this one, and both are easier
to reason about now that the destination shape exists:

| | Change | Status |
| --- | --- | --- |
| **A** | Directory reorganization | **done — this document** |
| **B** | SQLite → Supabase, database per project | not started, much larger |
| **C** | Hand-written job system → DBOS | not started |

A was verifiable by the compiler and the existing test suite. B and C are not, which is why they were
kept out.

## Before

```text
apps/backend/src/
├── 0-platform/       52 files   9,259 lines   database, formula, intelligence, knowledge,
│                                              observability, rich-text, web-retrieval
├── 0-utils/           8 files   1,586 lines   config, jobs, persistence, types
├── 1-init/           24 files   1,658 lines   startBackend.ts + create/ (23 files)
├── 2-transport/       1 file      125 lines   registerHttpTransport.ts (Fastify)
├── 3-capabilities/  118 files  23,932 lines   12 capabilities
└── 4-job-wiring/     16 files   2,922 lines   endpoint → job registration, per capability
```

63 HTTP endpoints, 94 job registrations, ~39,500 lines of TypeScript.

## After

```text
apps/backend/
├── etc/configuration.yaml         application configuration
├── src/
│   ├── initialization/
│   │   ├── create-runtime.ts      composes the runtimes in dependency order
│   │   ├── configuration.ts       reads and validates application configuration
│   │   └── runtimes/              one initialization function per runtime (23 files)
│   ├── api/
│   │   ├── context.ts             the request's project context
│   │   ├── errors.ts              transport-safe error mapping
│   │   ├── registerHttpTransport.ts
│   │   └── routes/                thin adapters onto capability procedures
│   ├── workflows/                 the job system, plus the retention scheduler
│   ├── capabilities/              19 capabilities, endpoints or not
│   └── shared/persistence/        the cross-capability revision convention
└── test/
```

`0-platform`, `0-utils`, `1-init`, `2-transport`, `3-capabilities`, and `4-job-wiring` are gone, and no
reference to any of those names survives anywhere in `apps/backend`.

## What moved

| Target | Source | Change |
| --- | --- | --- |
| `capabilities/` | `3-capabilities/` | Rename |
| `capabilities/{formula,rich-text,intelligence,knowledge,observability,web-retrieval,database}/` | `0-platform/*` | Promote |
| `initialization/create-runtime.ts` | `1-init/startBackend.ts` | Move, rename |
| `initialization/runtimes/` | `1-init/create/` | Move, rename |
| `initialization/configuration.ts` | `0-utils/config/loadBackendConfig.ts` | Move, rename |
| `api/context.ts` | `0-utils/types/request.ts` | Move, rename |
| `api/errors.ts` | `errorFields` in `registerHttpTransport.ts` | Extract |
| `api/registerHttpTransport.ts` | `2-transport/registerHttpTransport.ts` | Move |
| `api/routes/` | `4-job-wiring/` | Move |
| `workflows/` | `0-utils/jobs/` | Move |
| `workflows/resourceRetentionScheduler.ts` | `0-utils/persistence/` | Move |
| `shared/persistence/resourceHistory.ts` | `0-utils/persistence/` | Move |

Subpath specifiers changed with their directories: `#utils/*`, `#platform/*`, `#init/*`,
`#transport/*`, and `#job-wiring/*` are retired; `#capabilities/*` stayed; `#initialization/*`,
`#api/*`, `#workflows/*`, and `#shared/*` are new. The 13 direct capability aliases (`#formula`,
`#document`, …) kept their names and only had their targets repointed, so no source file changed on
their account.

## Naming

- `initialization/runtimes/` rather than `create/`. "Create" does not say what is created; "runtimes"
  does.
- The files in `runtimes/` hold **initialization functions**, not factories. Each runtime is a
  singleton, and "factory" implies more than one instance may exist.
- `routes/` is a directory, one module per capability. `context.ts` and `errors.ts` are single files.

## Placement rationale

Each of these was measured rather than assumed.

**`observability` became a capability.** Of 47 files referencing it, 48 references are `import type` and
exactly one is a value import — the logger's own initialization function. The logger was already
constructed only by initialization and injected everywhere else, so promoting it inverted no dependency.

**`config` belongs to initialization.** `loadBackendConfig.ts` is 637 lines with 18 importers, and
`initialization/configuration.ts` is by definition the thing that reads and validates configuration.
Note that 637 lines arrived as one file.

**Request types belong in `api/context.ts`.** The old `0-utils/types` was a single 27-line file holding
`RequestEndpoint`, `IncomingRequest`, and `RequestEnvelope`, imported by three files, all of them
transport or job wiring.

## Three deviations from the plan

**1. `shared/` exists after all.** The plan said there would be none, on the grounds that the only
candidate was request types. That was right about types but wrong about
`0-utils/persistence/resourceHistory.ts` — the current/revision table convention used across 35 files.
It is TypeScript, so it cannot live in `supabase/` (see below), and it is not capability behaviour. It
sits at `shared/persistence/resourceHistory.ts` pending B.

**2. `supabase/` was not created, and `database/` stayed in `capabilities/`.** `supabase/` must be a
sibling of `src/` for the Supabase CLI's `--workdir` to find it, which puts it outside `rootDir: "src"`
and outside `include: ["src/**/*.ts"]`. Moving TypeScript there would require restructuring the build
output and the `imports` map's `./dist/*` targets — too invasive for a reorganization. So
`0-platform/database/knowledge-store.ts` moved uniformly with its six siblings into
`capabilities/database/`, and `supabase/` gets created in B when it has real SQL and a `config.toml` to
hold. What "move the persistence convention into supabase" most likely means in practice is that the
convention becomes SQL in `supabase/migrations/` rather than a TypeScript helper — which is a B
activity, not a move.

**3. `errors.ts` is smaller than intended.** Only `errorFields` was extracted — the function that
reduces an unknown thrown value to log-safe `errorName`/`errorMessage`. The status-code decisions
(404 unregistered, 429 queue capacity, 500 otherwise) are interleaved with logging and Fastify reply
calls in the handler, so pulling them out would have been a refactor with behaviour risk rather than a
move. C rewrites that handler anyway.

## `api/context.ts` has no teeth yet

`context.ts` is where the request's project context is **defined**: `userId`, `projectId`, and anything
authentication-related.

Today it holds only the framework-neutral request types it inherited. Nothing enforces project scope,
because scope currently lives in which store instance a caller holds rather than in a request. It gains
teeth in B, when requests carry `userId` and `projectId` and project membership is checked.

## How it was verified

A baseline was established before any file moved, and the same two commands were run after every step:

```sh
cd apps/backend && pnpm typecheck && pnpm test
```

Before: `typecheck` clean, 297 tests passing. After every step, and at the end: identical.

`typecheck` alone would not have been enough. It does not exercise the Node `imports` map — TypeScript
resolves `paths` and Node resolves `imports`, so a mismatch between the two maps fails at runtime, not
at compile time. `tsconfig.json` also includes only `src/**/*.ts`, so type errors in `test/` never
surface there.

Two hazards the plan had not anticipated, both caught by running the suite:

- **`test/` reaches into `src/` with relative paths** — 151 occurrences across 24 files, including one
  runtime file read (`new URL("../../src/1-init/startBackend.ts", import.meta.url)`) that no import
  analysis would have found.
- **Splitting `0-utils/persistence` broke a relative import.** `resourceRetentionScheduler.ts` imported
  `./resourceHistory.js`, and the two files went to different destinations. It now uses a subpath
  specifier.

## Follow-ups

1. **`test/` should use subpath specifiers.** 151 deep relative paths into `src/` are why this change
   touched 24 test files. `#capabilities/...` works from `test/` today and would make the next move
   cheaper.
2. **`capabilities/database/` is not a capability.** It is one 389-line file, the knowledge store, with a
   single importer. It should end up in `supabase/` or inside `capabilities/knowledge/`.
3. **Name the persistence convention.** `resourceHistory.ts` describes the current/revision table pair.
   Candidates: `resource-revisions`, `revision-ledger`, `resource-history`. Secondary to whether it
   survives B at all.
4. **`built-in` may not belong in `capabilities/`.** It is the only capability with no `index.ts`, and it
   holds health, echo, audit, and queue-status — operational endpoints rather than domain behaviour.
5. **`workflows/` does not yet match its target shape.** It holds the hand-written job system
   (`registry.ts`, `scheduler.ts`, `internalRuntime.ts`, `types.ts`) plus the retention scheduler, not
   the `queues.ts` and `worker.ts` the target names. C replaces the contents.
