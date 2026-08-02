# 09 · Verified Status

Measured, not inferred. Commands and their actual output are given so you can re-check.

**Re-measured 2026-08-01 after Slide was deleted.** The original snapshot recorded a tree
that did not typecheck or boot; both now succeed.

## Typecheck — PASSES

```text
$ pnpm --filter @icarus/backend typecheck
> tsc --noEmit -p tsconfig.json
(no output, exit 0)
```

## Boot — module graph loads

```text
$ node --conditions=development --import tsx -e 'import("#init/startBackend.js")'
MODULE GRAPH LOADS OK
```

This is an import-only check: it proves the composition graph resolves, not that
`startBackend()` runs to a bound listener. A full boot additionally needs `data/` to be
writable and, for Intelligence, a real `OPENROUTER_API_KEY`.

## Tests — PASS (231/231)

```text
$ pnpm --filter @icarus/backend test
# tests 231   # pass 231   # fail 0
```

### What changed, and why the count went down

Slide was **deleted**, not completed. `3-capabilities/slide/`, `4-job-wiring/slide/`,
`1-init/create/slide.ts`, and the three `slide-*.test.ts` files are gone — 39 files, roughly
9,100 lines. `slideService.ts` had never been written, and that one missing file was what
broke both the build and the boot.

The count moved 257 → 231 because Slide's three test files went with it. Everything else
stayed green.

Rationale and full scope are in `scratch/0-general-updates.md` item 1.

## The verification gap — closed

The original note flagged this:

> A green test run does not imply a working service.

**Fixed.** `runtime-wiring.test.ts` now carries *"the composition root's module graph
resolves"*, which dynamically imports `#init/startBackend.js` and asserts `startBackend` is a
function. Import only — it never calls `startBackend()`, so nothing binds a port or opens a
database.

Dynamic rather than top-level on purpose: a static import that failed would take the whole
file down and hide the other seven assertions behind a module-load error.

Verified non-vacuous by deliberately breaking `startBackend.ts` and confirming the test fails
while its file-mates still pass.

**Known limit, worth understanding.** It catches an unresolvable import whose binding is
*used* at runtime, but not one that is unused or type-only — esbuild elides those before Node
resolves them. So it would have caught the Slide breakage (`createSlideInstance` and both
`register*` functions were called values) but it is not a general substitute for `tsc`.

That makes the other half still worth doing:

1. Add `pnpm typecheck` to whatever gate runs `pnpm test` — **still open**, and now the more
   valuable of the two.

## Documentation drift

**`docs/backend-architecture.md` — stale.** It describes the pre-numbering layout
(`src/init`, `src/transport`, `src/job-wiring`, `src/capabilities`), lists aliases without
`#platform/*` or `#utils/*`, names
`src/job-wiring/internal/registerInternalEndpointMappings.ts` (the file is
`registerEndpointMappings.ts`), and says the only capability libraries are
`internal/echoCapability.ts` and `internal/auditCapability.ts` — those live in
`3-capabilities/built-in/` and there are now nine capabilities. Its description of the
request→job flow and queue semantics is still accurate.

**`docs/architecture.md` — one broken link.** It links to `capabilities/README.md`; that
directory is now `docs/capabilities-old/`. Its other seven links resolve.

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
| Resources | Slides | ☐ | **Deleted 2026-08-01** — was partially built and never runnable |
| Resources | Spreadsheet | ☐ | Absent (design in `scratch/spreadsheet-design/`) |
| Resources | Templates | ☐ | **Built** since this snapshot |
| Research | Analysis, Research | ☐ | Absent |
| Research | Investigation | ☐ | **Built** since this snapshot |
| Project | Activity (Presence) | ✅ | ✅ ledger + Presence core; Presence writes 501 by design |
| Project | Comments, Workspace | ☐ | Absent (design in `scratch/comments-design.md`) |
| Agentic | Persona, Agents, Automation | ☐ | Absent |

Web Retrieval (`0-platform/web-retrieval/`) is a `.gitkeep` scaffold and blocks the Research
group.

## Known gaps worth tracking

Collected from source reading and the modules' own `invariants.md` pages:

1. ~~**Slide application service missing** — blocks the whole build and boot.~~ **Resolved** —
   Slide was deleted rather than finished. Typecheck and the module graph both pass.
2. **Test suite does not exercise composition** — see above. Still open.
3. **Connector `filesystemProvider` is not an authorization boundary.** It accepts any path
   readable by the backend process. Fine for local development; a containment boundary is
   needed before any multi-user deployment.
4. **Weak wire validation in older capabilities.** Connector and General Files pass
   `request.body as any` into their services (which *do* runtime-validate, so this is a
   type-safety rather than a security gap); Context/Structured Data/Derived Outputs cast to
   `Record<string, unknown>` and coerce with `String(...)`, which does admit malformed input.
   The Document/Slide `wire/` decoder pattern is the intended standard. Full analysis in
   [review/001-consistency-and-doc-drift.md](review/001-consistency-and-doc-drift.md).
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
pnpm typecheck                       # expect: clean, exit 0
pnpm test                            # expect: 231 pass
node --conditions=development --import tsx \
  -e 'import("#init/startBackend.js")'      # expect: resolves, no error
```
