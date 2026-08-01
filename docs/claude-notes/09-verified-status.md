# 09 · Verified Status

Everything here was measured on 2026-08-01, not inferred. Commands and their actual output
are given so you can re-check.

## Typecheck — FAILS (2 errors)

```text
$ tsc --noEmit -p apps/backend/tsconfig.json
src/3-capabilities/slide/index.ts(1,39): error TS2307: Cannot find module
  './application/slideService.js' or its corresponding type declarations.
src/3-capabilities/slide/index.ts(5,8): error TS2307: Cannot find module
  './application/slideService.js' or its corresponding type declarations.
exit 2
```

Both errors have the same single cause. `apps/backend/src/3-capabilities/slide/application/`
contains only `createService.ts`; `slideService.ts` does not exist.

## Boot — FAILS

```text
$ tsx --conditions=development -e 'import("#init/startBackend.js")'
IMPORT FAILED: ERR_MODULE_NOT_FOUND
Cannot find module '.../src/3-capabilities/slide/application/slideService.js'
  imported from .../src/3-capabilities/slide/index.ts
```

`startBackend.ts` imports `#capabilities/slide/index.js` (for `createSlideCapability` and
`SlideInternalJobIntent`), so the module graph cannot be loaded at all. **`pnpm dev:backend`
and `pnpm start` both fail before Fastify binds.** No endpoint is currently reachable — not
just Slide's two.

## Tests — PASS (155/155)

```text
$ tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts
ℹ tests 155   ℹ pass 155   ℹ fail 0   ℹ duration_ms 4088
```

The suite passes **despite** the broken build because no test imports
`3-capabilities/slide/index.ts` or `1-init/startBackend.ts`. `slide-domain.test.ts`,
`slide-wire.test.ts`, and `slide-persistence.test.ts` import
`../../src/3-capabilities/slide/domain/…`, `…/wire/…`, `…/persistence/…` directly, routing
around the broken barrel.

**This is the most important thing to fix about the verification setup**, independent of
Slide: a green test run currently does not imply a working service. Two cheap options:

1. Add `pnpm typecheck` to whatever gate runs `pnpm test`.
2. Add a test that imports `#init/startBackend.js` (import only, no `startBackend()` call) so
   the composition graph is exercised.

## What Slide needs

Per `slide/index.ts` lines 1–5, the missing module must export:

```ts
export const createSlideCapability: (store: SlideStore, deps: SlideDependencies,
                                     options) => SlideCapability;
export type SlideCapability;
export type SlideDependencies;
```

The contract is fully pinned down by existing code:

- `1-init/create/slide.ts` calls
  `createSlideCapability(store, { richText, derivedOutputs, jobs, logger, attribution }, DEFAULT_SLIDE_OPTIONS)`.
- `4-job-wiring/slide/registerSlideEndpoints.ts` needs `command()` and `query()`, and imports
  15 Slide error classes it expects the service to throw.
- `4-job-wiring/slide/createSlideJobs.ts` needs `compact(deckId)`,
  `computePromptCreation`, `settlePromptCreation`, `computePromptRefresh`,
  `settlePromptRefresh` — five methods, five intent types.
- `startBackend.ts` needs `recoverPendingAttempts()`.

`document/application/documentService.ts` is the direct template; the differences are that
Slide has no formula-evaluation attempt kind and no Activity publisher, so it needs roughly
five of Document's seven stage methods.

## Documentation drift

**`docs/backend-architecture.md` — stale.** It describes the pre-numbering layout
(`src/init`, `src/transport`, `src/job-wiring`, `src/capabilities`), lists aliases without
`#platform/*` or `#utils/*`, names
`src/job-wiring/internal/registerInternalEndpointMappings.ts` (the file is
`registerEndpointMappings.ts`), and says the only capability libraries are
`internal/echoCapability.ts` and `internal/auditCapability.ts` — those live in
`3-capabilities/built-in/` and there are now nine capabilities. Its description of the
request→job flow and queue semantics is still accurate.

**`docs/architecture.md` — two broken links.** It links to `capabilities/README.md`, but that
directory is now `docs/capabilities-old/`.

**`apps/backend/etc/README.md` — incomplete.** Documents only `server`, `workerPool`, and
`queue`. The YAML has ten more sections (`logging`, `intelligence`, `formula`,
`structuredData`, `richText`, `context`, `document`, `projectId`, `userId`).

**`docs/runtime/backend-map.md` and `docs/runtime/repository-boundaries.md` — accurate on
structure, aspirational on scope.** Their layer definitions, placement laws, and revision-model
table match the code exactly and are the best statement of the deliberate architecture. Their
repository-shape listings include many unbuilt capabilities (`spreadsheet`, `analysis`,
`evidence`, `research`, `project`, `workspace`, `comments`, `questions`, `persona`, `agents`,
`automation`, `sources`, `media`, `library-kernel`, `templates`, `import-export`) and use
older names (`data/` for what is now `structured-data/`, `slides/` for `slide/`,
`presence/` as a separate directory rather than part of `activity/`). One concrete divergence:
the `JobDefinition` interface shown in `repository-boundaries.md` has
`execute(signal?: AbortSignal)`; the real one in `0-utils/jobs/types.ts` has
`work()` / `deferredWork()` and no `AbortSignal`.

**Per-module `docs/` packages — current and reliable.** Where they disagree with an older
design page, they say so and are right.

## Build-order status

`docs/notes/notes-1.md` tracks the build sequence. Cross-checked against the tree:

| Group | Unit | Tracker | Actual |
| --- | --- | --- | --- |
| Foundations | Intelligence, Context, Formula, Structured Data, Rich Text | ✅ | ✅ confirmed |
| Resources | Knowledge, Document, Connector, General File | ✅ | ✅ confirmed |
| Resources | Slides | ☐ | Partially built, not runnable |
| Resources | Spreadsheet, Templates | ☐ | Absent (design in `scratch/spreadsheet-design/`) |
| Research | Analysis, Investigation, Research | ☐ | Absent |
| Project | Activity (Presence) | ✅ | ✅ ledger + Presence core; Presence writes 501 by design |
| Project | Comments, Workspace | ☐ | Absent (design in `scratch/comments-design.md`) |
| Agentic | Persona, Agents, Automation | ☐ | Absent |

Web Retrieval (`0-platform/web-retrieval/`) is a `.gitkeep` scaffold and blocks the Research
group.

## Known gaps worth tracking

Collected from source reading and the modules' own `invariants.md` pages:

1. **Slide application service missing** — blocks the whole build and boot. Highest priority.
2. **Test suite does not exercise composition** — see above.
3. **Connector `filesystemProvider` is not an authorization boundary.** It accepts any path
   readable by the backend process. Fine for local development; a containment boundary is
   needed before any multi-user deployment.
4. **Weak wire validation in older capabilities.** Connector passes `request.body as any`
   straight into `service.register()`; Context/Structured Data cast to
   `Record<string, unknown>` and coerce with `String(...)`. The Document/Slide `wire/` decoder
   pattern is the intended standard.
5. **No Knowledge test file.** Windowing, clustering, SQLite persistence, end-to-end
   retrieval, and the concrete embedder are uncovered; Knowledge behaviour is only exercised
   indirectly through Derived Outputs' in-memory double.
6. **Intelligence is barely tested.** Route selection, structured parsing, and tool-loop
   accounting have no direct coverage; only the provider error-redaction rule is tested.
7. **Some configured Formula limits are not enforced** — stated in
   `0-platform/formula/docs/README.md`, along with a parser gap in the projection-plus-filter
   pipe form and `toWire` throwing for functions instead of returning a diagnostic.
8. **`data/structured-data-project.db` and `data/structured-data-user.db` are orphans** — no
   code path references them; only `structured-data.db` is opened.
9. **Presence has no transport.** By design, until a session-aware transport exists.
10. **Logging is synchronous `appendFileSync` per entry.** Acknowledged in
    `1-init/create/logger.ts` as swappable without touching call sites; it will matter under
    load.

## Quick re-verification

```bash
cd apps/backend
pnpm typecheck                       # expect: 2 errors, both slide/index.ts
pnpm test                            # expect: 155 pass
node -e 'import("#init/startBackend.js")'   # expect: ERR_MODULE_NOT_FOUND
```
