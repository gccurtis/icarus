# Verified status

*Verified against source at commit ef6d462, 2026-08-09.*

Every number on this page is the output of a command that was run against
`ef6d462cc8811383d47b45b9bd22503b220a7961` on 2026-08-09. Nothing here is copied from another
document, and nothing is estimated. Where a claim rests on something that was not re-measured,
the page says so.

The `apps/` tree at measurement time was clean; the only pending changes anywhere were the
owner's uncommitted edits under `scratch/`, the untracked `.claude/worktrees/`, the
`docs/phase-1/` move, and this new `docs/phase-2/` directory. Running the suite does not touch
the repository: `git status --porcelain` was unchanged before and after, because every
SQLite-touching test writes into `os.tmpdir()` or an in-memory database.

Every command was run with the dev-shell Node on `PATH`:

```bash
export PATH="/nix/store/l7b3cb5p19qnlykasxwqdggck3ijilqq-nodejs-22.23.1/bin:$PATH"
cd /home/jakul/cyberia/icarus/apps/backend
```

---

## 1. The three gates

There are exactly three automated gates in this repository. Two of them are `package.json`
scripts; the third is one assertion inside the test suite. **Nothing runs any of them
automatically** — see [§7](#7-there-is-no-ci).

| Gate | Command | Result on 2026-08-09 |
| --- | --- | --- |
| Typecheck | `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **exit 0, no output**, 1.769 s |
| Tests | `./node_modules/.bin/tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts` | **444 tests, 444 pass, 0 fail** |
| Module graph | `node --conditions=development --import tsx -e 'import("#init/startBackend.js")…'` | **`OK function`**, exit 0 |

### 1.1 Typecheck — real output

```console
$ { time ./node_modules/.bin/tsc --noEmit -p tsconfig.json ; } 2>&1

real    0m1.769s
user    0m5.146s
sys     0m0.181s
$ echo $?
0
```

`tsc` printed nothing, which is the pass condition. It covers `src/**/*.ts` only — 236 files,
47,936 lines. It does **not** cover `test/`; that is [§6](#6-verification-gaps).

### 1.2 Tests — real output

```console
$ ./node_modules/.bin/tsx --conditions=development --test --test-concurrency=1 \
    test/capabilities/*.test.ts 2>&1 | tail -12
  duration_ms: 16.055506
  type: 'test'
  ...
1..325
# tests 444
# suites 0
# pass 444
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5295.055157
```

**444 tests, 325 top-level, 119 nested subtests, 0 suites, 0 skipped, 0 todo, 0 failures.**
`# suites 0` is literal: nobody in this repository uses `describe`. Every test is a top-level
`test(...)` call, and the 119 subtests come from `t.test(...)` inside five files.

`--test-concurrency=1` is what `pnpm test` passes. It is **not required by anything in the
tree**. No test opens a database under `apps/backend/data/`; every SQLite-touching test uses
`mkdtempSync(join(tmpdir(), …))` or `new Database(":memory:")`
([`resource-retention.test.ts:26`](../../apps/backend/test/capabilities/resource-retention.test.ts)).
Dropping the flag on this 8-core machine gave `444 pass / 0 fail` on three consecutive runs at
`duration_ms` 1505.7, 1567.4 and 1500.4 — against 5218.7, 5295.1 serial. **The flag costs about
3.4× wall clock and buys nothing that was measurable.** The rationale printed in the archived
notes — shared SQLite files under `data/` — is false; the superseded page is at
`phase-1/claude-notes/08-conventions.md`. A defensible *replacement* rationale is timing
determinism for the tests that use real timers and assert on `durationMs`, but that is a
different claim, and nothing flaked in the parallel runs above.

### 1.3 Module graph — real output

```console
$ node --conditions=development --import tsx \
    -e 'import("#init/startBackend.js").then(m=>console.log("OK",typeof m.startBackend))'
OK function
$ echo $?
0
```

This is the same check the suite performs at
[`runtime-wiring.test.ts:56`](../../apps/backend/test/capabilities/runtime-wiring.test.ts).
What it proves and what it does not is [§4](#4-what-the-module-graph-check-proves).

---

## 2. Test inventory — 26 files, 16,054 lines, 444 tests

Measured by running each file on its own with
`tsx --conditions=development --test --test-concurrency=1 <file>`. `tests` is the `# tests`
counter; `top` is the final `1..N` plan; `sub` is the difference. The per-file sums equal the
aggregate run exactly (444 / 325), so no test is double-counted or lost to the glob.

| # | File | Lines | Tests | Top | Sub | What it covers |
| --: | --- | --: | --: | --: | --: | --- |
| 1 | `templates.test.ts` | 2,248 | **107** | 16 | 91 | Templates domain, catalog, sealing, orphan sweep, config parsing |
| 2 | `document-application.test.ts` | 1,912 | 26 | 20 | 6 | Document service, attempts/stages, template contract |
| 3 | `slides-domain.test.ts` | 1,774 | **61** | 61 | 0 | Slides reducer, inverses, rebase, geometry, group-cycle guard |
| 4 | `document-domain.test.ts` | 1,230 | 34 | 20 | 14 | Document ChangeSets, operations, identity rules |
| 5 | `derived-outputs.test.ts` | 1,169 | 17 | 17 | 0 | Definitions, revisions, idempotency claims, invalidation |
| 6 | `document-persistence.test.ts` | 897 | 7 | 7 | 0 | Document SQLite store, head CAS, identity ledger |
| 7 | `slides-persistence.test.ts` | 806 | 26 | 26 | 0 | Slides SQLite store and its `CHECK` constraints |
| 8 | `investigation.test.ts` | 781 | 11 | 11 | 0 | Questions/Hypotheses/Findings, Knowledge reconciliation, all 26 routes |
| 9 | `persona.test.ts` | 669 | 32 | 32 | 0 | Persona commands, queries, CAS, built-in immutability |
| 10 | `structured-data-formula.test.ts` | 559 | 18 | 18 | 0 | Structured Data + the Formula resolver seam |
| 11 | `document-wire.test.ts` | 500 | 9 | 9 | 0 | Document wire decode/encode |
| 12 | `connector.test.ts` | 441 | 9 | 9 | 0 | Connector registration, readers, deterministic IDs |
| 13 | `persona-wiring.test.ts` | 402 | 11 | 11 | 0 | Persona endpoint queues and error ladder |
| 14 | `comments.test.ts` | 398 | 7 | 7 | 0 | Comments commands, queries, outbox |
| 15 | `context.test.ts` | 315 | 11 | 11 | 0 | Context declare/update/purge, set operations |
| 16 | `general-files.test.ts` | 291 | 11 | 11 | 0 | Content-addressed upload/update/delete chain |
| 17 | `internal-jobs.test.ts` | 261 | 7 | 7 | 0 | `SchedulerInternalJobsRuntime`, admission, capacity failure |
| 18 | `rich-text-formula.test.ts` | 257 | 4 | 4 | 0 | Formula-atom authoring and settlement in Rich Text |
| 19 | `runtime-wiring.test.ts` | 222 | 8 | 8 | 0 | Architectural regressions — see [§5](#5-what-runtime-wiringtestts-pins) |
| 20 | `activity.test.ts` | 198 | 4 | 4 | 0 | Append-only ledger, monotonic sequence |
| 21 | `templates-wiring.test.ts` | 163 | 7 | 3 | 4 | Templates endpoint queues and 409 codes |
| 22 | `comments-wiring.test.ts` | 159 | 3 | 3 | 0 | Comments endpoint queues |
| 23 | `resource-retention.test.ts` | 143 | 3 | 3 | 0 | The 30-day boundary, sweep isolation, coalescing |
| 24 | `activity-wiring.test.ts` | 127 | 3 | 3 | 0 | Activity endpoint queues, the 501 |
| 25 | `observability.test.ts` | 67 | 3 | 3 | 0 | `FileLogger` level filtering, `NoopLogger` |
| 26 | `logging-detail.test.ts` | 65 | 5 | 1 | 4 | The `shape`/`content` detail label |
| | **Total** | **16,054** | **444** | **325** | **119** | |

Plus two files that are not `*.test.ts` and are therefore **not** in the 444:

| File | Lines | Status |
| --- | --: | --- |
| `test/helpers/testDoubles.ts` | 52 | The entire double library: `CapturingLogger`, `ZERO_USAGE`, `TEST_FORMULA_LIMITS` |
| `test/smoke/http-smoke.mjs` | 396 | Plain-`node` script, separate `test:smoke` script, requires a listening backend |

The five files that use nested subtests are `templates.test.ts`, `document-domain.test.ts`,
`document-application.test.ts`, `templates-wiring.test.ts`, `logging-detail.test.ts`.

### 2.1 Test weight by area

| Area | Tests | Share |
| --- | --: | --: |
| Templates | 114 (`templates` 107 + `templates-wiring` 7) | 25.7% |
| Slides — **unreachable at runtime** | 87 (`slides-domain` 61 + `slides-persistence` 26) | 19.6% |
| Document | 76 (application 26, domain 34, persistence 7, wire 9) | 17.1% |
| Persona | 43 (`persona` 32 + `persona-wiring` 11) | 9.7% |
| Structured Data / Formula | 18 | 4.1% |
| Derived Outputs | 17 | 3.8% |
| Context | 11 | 2.5% |
| General Files | 11 | 2.5% |
| Investigation | 11 | 2.5% |
| Comments | 10 (`comments` 7 + `comments-wiring` 3) | 2.3% |
| Connector | 9 | 2.0% |
| Runtime wiring | 8 | 1.8% |
| Observability | 8 (`observability` 3 + `logging-detail` 5) | 1.8% |
| Internal jobs | 7 | 1.6% |
| Activity | 7 (`activity` 4 + `activity-wiring` 3) | 1.6% |
| Rich Text | 4 | 0.9% |
| Retention | 3 | 0.7% |

**One fifth of the suite tests code no HTTP request can reach.** Slides is built, typechecked and
covered by 87 passing tests, and nothing constructs it — see
[07-capabilities/slides.md](07-capabilities/slides.md) and
[12-build-order.md](12-build-order.md).

### 2.2 Framework and import style

- `node:test` + `node:assert/strict` only. **No test framework, no mocking library, no assertion
  library** in `devDependencies`.
- Every test file imports source by **relative path** (`../../src/…`). `grep -rn 'from "#' test/`
  returns nothing. The one exception is the *dynamic* import at
  [`runtime-wiring.test.ts:57`](../../apps/backend/test/capabilities/runtime-wiring.test.ts) —
  the only place in the whole suite that exercises the `package.json` `imports` map.
- Most-imported modules: `test/helpers/testDoubles.js` (23 files),
  `src/0-utils/jobs/registry.js` (11), `src/0-utils/persistence/resourceHistory.js` (10),
  `src/0-utils/jobs/scheduler.js` (9).

---

## 3. What `pnpm test` and `pnpm typecheck` actually run

| Script | Where | Expands to |
| --- | --- | --- |
| `pnpm test` (root) | `package.json` | `pnpm -r --if-present test` — only `@icarus/backend` has a `test` script, so this **is** the backend suite |
| `pnpm typecheck` (root) | `package.json` | `pnpm -r typecheck` — backend, frontend, and `packages/shared`, each `tsc --noEmit -p tsconfig.json` |
| `pnpm --filter @icarus/backend test` | `apps/backend/package.json` | `tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts` |
| `pnpm --filter @icarus/backend typecheck` | `apps/backend/package.json` | `tsc --noEmit -p tsconfig.json` |
| `pnpm --filter @icarus/backend test:smoke` | `apps/backend/package.json` | `node test/smoke/http-smoke.mjs` — **not** part of `pnpm test` |

`pnpm test` does **not** run the typecheck, and `pnpm typecheck` does **not** run the tests.
Neither runs the smoke script. Nothing runs any of them on a push, a branch, or a merge.

---

## 4. What the module-graph check proves

The assertion is four lines. Its value is entirely in the comment above it, quoted verbatim from
[`runtime-wiring.test.ts:40-55`](../../apps/backend/test/capabilities/runtime-wiring.test.ts):

```text
// Every other test in the suite imports concrete modules directly, so a broken
// composition root is invisible to them: the tree can fail `tsc` and fail to boot
// while the suite stays green. That is exactly what happened while Slide carried a
// barrel re-exporting a service file that was never written.
//
// The import is dynamic rather than top-level on purpose. A static import that
// failed would take the whole file down with it, hiding the other assertions here
// behind a module-load error; this way a broken graph is one failing test with a
// readable message.
//
// Known limit, verified by deliberately breaking startBackend both ways: this
// catches an unresolvable import whose binding is *used* at runtime, but not one
// that is unused or type-only — esbuild elides those before Node ever resolves
// them. `tsc` is what covers that case, which is the argument for running
// `pnpm typecheck` alongside `pnpm test` rather than treating this as a
// substitute for it.
```

**Proves:**

| Claim | Why |
| --- | --- |
| Every runtime import reachable from `startBackend.ts` resolves | Node actually resolves and loads the graph |
| Every module in that graph executes its top-level body without throwing | ESM evaluation runs on import |
| `startBackend` is exported and is a function | The assertion itself |
| The `#…` alias map resolves under the `development` condition | The specifier is `#init/startBackend.js` |

**Does not prove:**

| Not covered | Why |
| --- | --- |
| Type-only or unused imports resolve | esbuild (via `tsx`) elides them before Node sees them. This is the explicit argument in the comment for running `tsc` too |
| The backend boots | `startBackend()` is never called. No config is read, no SQLite file is opened, no port is bound |
| Any endpoint is registered | Registration happens inside `startBackend()`, at `startBackend.ts:176-186` |
| `dist/` builds or is current | The check runs `--conditions=development`, which resolves `./src/**`. `dist/` is never consulted |
| Anything about `test/` | The graph is rooted at `src/1-init/startBackend.ts` |

---

## 5. What `runtime-wiring.test.ts` pins

222 lines, 8 top-level tests, no subtests. Three of the eight are **source-scanning** regression
tests: they `readFileSync` a repository file and assert on its text rather than calling code.
Assertion by assertion, with the regression each one guards.

### 5.1 `"General Files and Connector aliases are available to the built runtime"` (L19)

Reads `apps/backend/package.json` and asserts six keys exist in `imports`: `#general-files`,
`#general-files/*`, `#connector`, `#connector/*`, `#templates`, `#templates/*`.

*Guards:* a capability added under `src/` but never given a `package.json` subpath alias. It
resolves fine in development (tests import by relative path) and **fails only in the built
`dist/` runtime**.

*Gap:* `#activity`, `#comments`, `#persona`, `#investigation`, `#document`, `#context`,
`#structured-data`, `#rich-text`, `#formula`, `#derived-outputs` are **not** in this list. Three
of them are covered by their own wiring tests (`activity-wiring.test.ts:26`,
`comments-wiring.test.ts:26`, `persona-wiring.test.ts:64`); the rest are covered by nothing.

### 5.2 `"the backend dev command selects TypeScript source imports instead of stale dist files"` (L33)

`assert.match(backendPackage.scripts?.dev ?? "", /--conditions=(?:types|development)/)`.

*Guards:* dropping `--conditions=development` from the `dev` script. Every `#alias` would then
resolve through the `"default"` condition to `./dist/**`, and `pnpm dev` would silently run
compiled output while appearing to work.

*This failure mode is live.* The newest file in `apps/backend/dist/` is dated
**2026-08-02T11:31:35**; **63 of the 236 source files are newer than it**, and
`dist/3-capabilities/` contains no `slides`. `pnpm start` (`node dist/index.js`, no conditions)
runs that tree. The test guards **only** the `dev` script — not `test`, not `start`.

### 5.3 `"the composition root's module graph resolves"` (L56)

Covered in full in [§4](#4-what-the-module-graph-check-proves).

### 5.4 `"the job runtime logs queue timing and deferred failures through Logger"` (L66)

Builds a real `JobScheduler({concurrentWorkers:1, serialQueueMaxSize:2, concurrentQueueMaxSize:2},
CapturingLogger)`, enqueues a `responseMode: "deferred"` job whose `deferredWork()` returns 202
and whose `work()` throws. Asserts the response is 202, that `requestId` round-trips, that all
four of `job.enqueued`, `job.started`, `job.responded`, `job.deferred.failed` were logged, and
then **deep-equals** the failure record's `data` against
`{jobId, requestId, jobName, queueType, responseMode, queueWaitMs, durationMs,
errorName: "Error", errorMessage: "expected deferred failure"}`.

*Guards:* a deferred job that fails **after** its HTTP response has already been sent going
silent. The exact payload shape is frozen by `deepEqual`, so adding or removing a field fails the
test.

### 5.5 `"HTTP requests and jobs share request correlation in the application Logger"` (L127)

Builds a real Fastify app via `createApp()`, registers a `GET /logging-probe` job returning 204,
injects the request, and asserts that `http.request.completed` carries a truthy `requestId` and
`jobId` and a `durationMs >= 0`, **and** that `job.started`'s `requestId` equals
`http.request.completed`'s.

*Guards:* losing the transport → job correlation ID, which is the only thing that makes a log
file traceable across the queue boundary.

### 5.6 `"provider HTTP failures do not leak response bodies into diagnostics"` (L173)

Monkey-patches `globalThis.fetch` to return a 400 with body `"sensitive provider response"` and
header `x-request-id: provider-request-1`, calls
`new OpenRouterProvider({…}).embed(undefined, {model, inputs: ["private input"]})`, and asserts
the thrown error message **matches** `/400/` and `/provider-request-1/` and **does not match**
`/sensitive provider response/`. `globalThis.fetch` is restored in a `finally`.

*Guards:* a provider error handler that interpolates the raw response body into the error,
leaking prompt or completion text into the log file.

*This is the only direct test of the Intelligence platform anywhere in the suite* — see
[§6.1](#61-coverage-holes).

### 5.7 `"startup and deferred job failures do not bypass the shared Logger"` (L202) — source scan

Reads `src/index.ts` and `src/0-utils/jobs/scheduler.ts` as text and asserts
`assert.doesNotMatch(source, /console\.(?:debug|info|log|warn|error)\s*\(/)` on each.

*Guards:* a stray `console.*` in the two places most tempted to use one — the process entry point
and the scheduler's deferred-failure path — which would write to stdout instead of the structured
daily log file.

*Gap:* the scan covers **exactly two files**. The other 234 source files are unchecked by it. Any
doc that describes this as "a workspace test bans `console.*`" overstates it.

### 5.8 `"recurring Connector sync starts only after the HTTP listener binds"` (L212) — source scan

Reads `src/1-init/startBackend.ts` as text, computes `source.indexOf("await app.listen")` and
`source.indexOf("syncScheduler.start()")`, and asserts the first is `>= 0` and the second is
strictly greater, with the failure messages `"startup no longer binds the HTTP listener"` and
`"sync timers can survive a failed listener bind"`.

*Guards:* moving recurring timer startup above the listener bind, which would leave four
`setInterval` timers keeping a **failed** startup process alive forever. The code it guards
carries the matching comment at
[`startBackend.ts:210-212`](../../apps/backend/src/1-init/startBackend.ts):

```text
// Start recurring work only after the transport has bound successfully.
// Otherwise a listen failure would leave interval timers keeping the
// failed startup process alive.
```

*Gap:* the assertion names `syncScheduler.start()` only. `retentionScheduler.start()`
(`startBackend.ts:213`, immediately above it, also after the bind) is covered by **no** ordering
assertion. Moving it above `await app.listen` would fail nothing.

---

## 6. Verification gaps

### 6.1 Coverage holes

| Module | Direct test file | What that means |
| --- | --- | --- |
| `0-platform/knowledge` (15 files, 2,118 lines) | **none** | Wired and load-bearing — injected into Investigation, General Files, Connector and Derived Outputs — with **no test file of its own**. It is exercised only as a side effect of four capabilities' tests, which drive `add`/`remove` and never assert on lattice construction, windowing, generation rollover, or retrieval ranking |
| `0-platform/intelligence` (5 files, 914 lines) | **none** | The only direct assertion anywhere is the *negative* one at `runtime-wiring.test.ts:173` — that a provider 400 does not leak its body. Route selection, structured-output parsing, tool loops, usage accounting, cost accounting and abort handling are untested. Production callers are `embed` (through Knowledge), `reasonStructured` (`derived-outputs.ts:817`) and `reasonWithToolsStructured` (`derived-outputs.ts:939`); `infer`, `inferStructured`, `reason` and `reasonWithTools` have **zero production callers** and zero tests |
| `0-platform/formula` (18 files, 3,525 lines) | **none by that name** | Coverage is indirect and thin — see below |
| `0-platform/database` (1 file, 389 lines) | **none** | The Knowledge SQLite adapter. Reached only through Knowledge, which itself has no test file |
| `0-platform/web-retrieval` | **none** | There is nothing to test: `.gitkeep` plus a six-page `docs/` package, **0 TypeScript files** |
| `3-capabilities/built-in` (4 files, 47 lines) | **none** | `/health`, `/health/queues`, `/echo`, `/audit` have no `node:test` coverage. `/health` is touched by the smoke script; `/health/queues`, `/echo` and `/audit` are touched by nothing |

**Formula's direct language coverage is thin.** There is no `formula.test.ts`. The 22 tests that
touch it (`structured-data-formula.test.ts` 18, `rich-text-formula.test.ts` 4) import only
`engine.js`, `resolver.js`, `wire.js` and `index.js` — never `parser.ts`, `lexer.ts`,
`binder.ts`, `ast.ts`, `display.ts` or `value-identity.ts`. So the lexer, the operator-precedence
table, index and slice expressions, cardinality, and set operations are covered only incidentally
by whatever expressions those 22 tests happen to spell. That is how
[`parser.ts:335-347`](../../apps/backend/src/0-platform/formula/parser.ts) survives — the
projection pipe silently discards the projection, with the author's own note in place:

```text
    // Check for pipe — projection pipe
    if (check(ctx, "pipe")) {
      advance(ctx); // consume |
      const condition = parseConditionQuery(ctx);
      // projection pipe is a condition-query with projected fields noted on the SetOperationNode
      // We encode this as: first project (separate node), then filter
      // For simplicity, encode as condition-query and let the evaluator handle projection+filter
      // Actually, the design says to handle it natively. Let's encode as a combined body.
      // We'll extend SetOperationBody to support both:
      return { kind: "condition-query", condition };
      // NOTE: The projected fields are lost here — this is a simplification.
      // A full implementation would carry both. For now, condition-only.
    }
```

`people.{name, score | score > 80}` parses, evaluates, and returns filtered rows with **every**
column. No diagnostic, no warning. See [11-known-issues.md](11-known-issues.md).

Two further untested paths worth naming:

- **The transport's 429.** `registerHttpTransport.ts:96-111` maps `QueueCapacityError` to HTTP
  429. `internal-jobs.test.ts:83` tests capacity failure at the *scheduler* level; no test drives
  the HTTP response.
- **The structural seams.** `ContextManager` satisfying `PersonaContextPort`, and
  `DocumentCapability` satisfying `TemplatableResource`, are both substituted by doubles in
  every test that crosses them. Both currently harbour a real defect that the doubles hide
  ([11-known-issues.md](11-known-issues.md)).

### 6.2 `test/` is never typechecked

[`apps/backend/tsconfig.json:43`](../../apps/backend/tsconfig.json) — `include` is exactly:

```json
"include": ["src/**/*.ts"]
```

`test/` — 28 files, 16,502 lines — is outside the compiler's view entirely. `pnpm typecheck`
passes with an exit code that says nothing about the 16,054 lines of test code the suite runs.

**Measured.** Pointing `tsc` at `test/**/*.ts` with the same `compilerOptions` the real project
uses (`strict`, `ES2022`, `NodeNext`, `types: ["node"]`) reports **37 errors across 9 of the 26
test files**:

| File | Errors | Representative codes |
| --- | --: | --- |
| `slides-domain.test.ts` | 9 | TS2322 ×6, TS7022 ×2, TS1355 |
| `templates-wiring.test.ts` | 8 | TS2741, TS2554, TS2339 ×6 |
| `document-application.test.ts` | 7 | TS2353 ×5, TS2322, TS2345 |
| `document-wire.test.ts` | 5 | TS18046 ×5 |
| `document-domain.test.ts` | 3 | TS2322 ×3 |
| `derived-outputs.test.ts` | 2 | TS2741 ×2 |
| `observability.test.ts` | 1 | TS2339 |
| `structured-data-formula.test.ts` | 1 | TS18048 |
| `templates.test.ts` | 1 | TS2352 |

Some of those are ordinary looseness a running test does not care about (`TS18046 'response' is
of type 'unknown'`, from reaching through the `JobDefinition` union without narrowing on
`responseMode`). Others are **real drift between a double and the interface it claims to
implement**. Four concrete ones:

**(a) `createTemplatesDouble` no longer satisfies `TemplateCapability`.**
[`templates-wiring.test.ts:23`](../../apps/backend/test/capabilities/templates-wiring.test.ts) is
annotated `: TemplateCapability` and supplies `command`, `query`, `publishPendingActivity`,
`pruneHistory`, `purgeExpired` — but not `collectOrphanedResources`, which `eebc1d6` added to the
interface and which `startBackend.ts:134-137` binds as the `templates-orphans` retention port:

```text
test/capabilities/templates-wiring.test.ts(23,76): error TS2741: Property
'collectOrphanedResources' is missing in type '{ command: …; query: …;
publishPendingActivity: …; pruneHistory: …; purgeExpired: … }' but required in
type 'TemplateCapability'.
```

The suite is green regardless: the seven tests in that file never call the missing method.

**(b) `CapturingLogger` implements the stale two-parameter `Logger` — and this produces *no*
error, which is worse.**
[`testDoubles.ts:11-29`](../../apps/backend/test/helpers/testDoubles.ts) declares
`debug/info/warn/error` as `(message: string, data?: unknown): void`. The real interface at
[`logger.ts:44-55`](../../apps/backend/src/0-platform/observability/logger.ts) gained a third
parameter in this very commit:

```ts
export interface Logger {
  debug(message: string, data?: unknown, options?: LogOptions): void;
  info(message: string, data?: unknown, options?: LogOptions): void;
  warn(message: string, data?: unknown, options?: LogOptions): void;
  error(message: string, data?: unknown, options?: LogOptions): void;
  /**
   * Flush and release any buffered writes. Optional because most Logger
   * implementations (NoopLogger, test doubles) hold nothing to flush.
   * Shutdown calls this on whatever Logger was constructed.
   */
  close?(): Promise<void>;
}
```

Fewer parameters is assignable, so `tsc` would **not** complain even if it ran. The double
therefore **silently discards every `detail` label**. That is why `logging-detail.test.ts` has to
construct a raw `FileLogger` instead of using the standard double, and it is why no capability
test can assert that a `content` record was labelled. 23 of the 26 test files use
`CapturingLogger`.

**(c) `new JobRegistry(new JobScheduler(…))`.**
[`templates-wiring.test.ts:39`](../../apps/backend/test/capabilities/templates-wiring.test.ts)
passes a scheduler to `JobRegistry`, which has **no constructor at all**
([`registry.ts:4-8`](../../apps/backend/src/0-utils/jobs/registry.ts)):

```text
test/capabilities/templates-wiring.test.ts(39,36): error TS2554: Expected 0 arguments, but got 1.
```

All 14 other `new JobRegistry(...)` sites in the suite pass nothing. The `JobScheduler` this line
builds is constructed and thrown away.

**(d) Two `ConnectorEntry` literals are missing a required field.**
`derived-outputs.test.ts:864` and `:876` build connector entries with `id`, `kind`,
`providerKind`, `locator`, `label`, `revision`, `syncConfig`, `syncing`, `knowledgeSourceIds`,
`createdAt`, `updatedAt` — but not `ingestionState`, which
[`connector/domain/model.ts:55`](../../apps/backend/src/3-capabilities/connector/domain/model.ts)
declares as `readonly ingestionState: ConnectorIngestionState` with no `?`:

```text
test/capabilities/derived-outputs.test.ts(864,38): error TS2741: Property 'ingestionState'
is missing in type '{ id: string; kind: "connector::file::text"; … }' but required in type
'ConnectorEntry'.
```

The tests pass because the code path under test never reads that field.

A fifth, smaller one: `observability.test.ts:66` calls `logger.close?.()` on a `NoopLogger`,
which does not declare `close` (`TS2339`). At runtime `undefined?.()` is a no-op, so the test
named *"a disabled logger writes nothing and close is a safe no-op"* asserts nothing.

A second `tsconfig` covering `test/` would have caught (a), (c), (d) and the `NoopLogger` case
the day each landed. It would **not** have caught (b), which is the one that actually costs
coverage — a double with *fewer* parameters than its interface is assignable, and silence is
exactly the wrong signal there.

### 6.3 What is verified about the frontend and shared package

| Package | Files | Typecheck | Tests |
| --- | --: | --- | --- |
| `apps/frontend` | 5 tracked (`src/main.ts` is 24 lines) | `tsc --noEmit -p tsconfig.json` — exit 0 | **none** — no `test` script |
| `packages/shared` | 3 tracked (`src/index.ts` is 5 lines: one `ApiHealth` interface) | `tsc --noEmit -p tsconfig.json` — exit 0 | **none** — no `test` script |

Neither is covered by `pnpm test`, because `pnpm -r --if-present test` skips packages with no
`test` script.

---

## 7. There is no CI

```console
$ git ls-files | grep -iE '\.github|\.gitlab|circleci|jenkins|azure-pipelines|\.travis|buildkite'
$ ls -a /home/jakul/cyberia/icarus
.agents  apps  .claude  .codex  docs  .env  flake.lock  flake.nix  .git  .gitignore
infra  logs  node_modules  package.json  packages  pnpm-lock.yaml  pnpm-workspace.yaml
README.md  scratch  tsconfig.base.json
```

**No `.github/`, no pipeline file of any kind, tracked or untracked.** Nothing enforces
`pnpm test`. Nothing enforces `pnpm typecheck`. Every number on this page describes a state that
one commit can silently break, and the only thing that would notice is a human running the
commands by hand.

The archived note at `phase-1/claude-notes/09-verified-status.md` recorded "add `pnpm typecheck`
to whatever gate runs `pnpm test`" as still open. It is still open, and the sharper statement is
that there is no gate to add it to.

---

## 8. Quick re-verification

Everything on this page is reproduced by the following. Expect the numbers in the right column.

```bash
export PATH="/nix/store/l7b3cb5p19qnlykasxwqdggck3ijilqq-nodejs-22.23.1/bin:$PATH"
cd /home/jakul/cyberia/icarus/apps/backend

# 1. typecheck (src only)                      expect: exit 0, no output
./node_modules/.bin/tsc --noEmit -p tsconfig.json

# 2. full suite                                expect: # tests 444 / # pass 444 / # fail 0
./node_modules/.bin/tsx --conditions=development --test --test-concurrency=1 \
  test/capabilities/*.test.ts 2>&1 | tail -12

# 3. composition root resolves                 expect: OK function
node --conditions=development --import tsx \
  -e 'import("#init/startBackend.js").then(m=>console.log("OK",typeof m.startBackend))'

# 4. source volume                             expect: 236 files, 47936 lines
find src -name '*.ts' | wc -l
find src -name '*.ts' -exec cat {} + | wc -l

# 5. test volume                               expect: 26 files, 16054 lines
ls test/capabilities/*.test.ts | wc -l
cat test/capabilities/*.test.ts | wc -l

# 6. endpoint call sites                       expect: 85 (→ 89 endpoints; 3 sites are loops)
grep -rho 'registry.register(' src/4-job-wiring | wc -l

# 7. SQLite files opened                       expect: 12
grep -rn '\.db"' src/1-init/create | wc -l

# 8. module docs packages                      expect: 19 directories, 114 markdown files
find src -type d -name docs | wc -l
find src -name '*.md' | wc -l

# 9. no CI                                     expect: no output
git -C /home/jakul/cyberia/icarus ls-files | grep -iE '\.github|\.gitlab|circleci|jenkins'
```

Two things this block deliberately does **not** run: the smoke script (`pnpm test:smoke` needs a
backend already listening on `127.0.0.1:4000`, and it cleans up nothing), and `pnpm start`
(it runs `dist/`, which is stale — see [§5.2](#52-the-backend-dev-command-selects-typescript-source-imports-instead-of-stale-dist-files-l33)).

---

## Related pages

- [11-known-issues.md](11-known-issues.md) — the defects these gates do not catch
- [12-build-order.md](12-build-order.md) — what is built, what is not, and in what order
- [08-conventions.md](08-conventions.md) — the testing conventions themselves
- [09-configuration.md](09-configuration.md) — what the loader accepts and what it does not validate
