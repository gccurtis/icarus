# 06 · Platform Services (`0-platform`)

Platform services are reusable in-process runtimes injected into capabilities. The placement
rule from `repository-boundaries.md`: *"A component belongs under `0-platform` when it is a
reusable runtime interface called by capabilities and has no direct product endpoint
requirement."*

None of them registers an HTTP route, creates a Job, or imports a capability.

| Module | Lines | Status |
| --- | --- | --- |
| `formula` | 3,525 | Implemented |
| `rich-text` | 2,218 | Implemented |
| `knowledge` | 2,118 | Implemented |
| `intelligence` | 914 | Implemented (thinly tested) |
| `database` | 389 | One adapter only, not a database layer |
| `observability` | 81 | Implemented |
| `web-retrieval` | 0 | `.gitkeep` only |

## Formula

A complete expression language (`formula/v1`) with a conventional pipeline:

```text
lexer.ts → parser.ts → binder.ts → evaluator.ts
           ast.ts      resolver.ts  builtins.ts
                                    value.ts / rational.ts
```

Five public methods: `parse`, `validate`, `dependencies`, `evaluate`, `explain`. Every one
returns `FormulaResult<T> = { ok, value?, diagnostics? }` — **no throwing on user error**.
There are 17 stable diagnostic codes (`parse_error`, `unknown_identifier`, `type_error`,
`divide_by_zero`, `cycle_error`, `limit_exceeded`, `stale_binding`, …), each with a
constructor function in `diagnostics.ts`.

Notable design points:

- **Exact rational arithmetic** (`rational.ts`, `CanonicalRational`) — not IEEE floats. Bound
  by `maxIntegerBits`, `maxPowerMagnitude`, `maxRoundingPlaces`.
- **Eight value kinds**: null, number, text, logic, list, record, table, function. Functions
  are first-class (lambdas with captured lexical bindings) but **not wire-serialisable** —
  `isWireSerializable()` guards, and endpoints return 422 `non_serializable_value` for them.
- **Immutable resolver snapshot.** `FormulaResolverSnapshot` carries `bindings:
  ReadonlyMap<normalizedKey, ResolvedFormulaBinding>` plus a `snapshotDigest`. Each binding
  carries `ownerRevision` and `valueDigest`, so a rename produces a *stale binding* rather
  than silently retargeting to a new owner (there is a test for exactly this).
- **Identity digests.** Evaluation returns `dependencyDigest` + `evaluationDigest`, letting
  callers detect whether a re-evaluation would change anything.
- **All limits from config**, with per-request overrides via `mergeLimits`.

Formula does not know Structured Data exists. The `FormulaNameResolver` adapter in
`1-init/create/` bridges them (see [01](01-layers-and-boundaries.md)).

## Rich Text

Owns **inline content only**. `RichContent = { atoms, marks }` — nothing else. Its own docs
are emphatic: *"It does NOT own blocks, containers, layouts, or resources"*, and note that an
older design page describing a block-owning Rich Text is *not* the implemented model.

- **Atoms**: `text`, `formula`, `reference`, `hard-break`. Each has a stable ID.
- **Marks**: `bold`, `italic`, `underline`, `strike`, `code`, `style`, `link` — all range-based
  over `TextPosition = { atomId, offset }` (UTF-16 code units, half-open).
- **Formula atoms** carry `expression`, optional `acceptedValue: FormulaWireValue`,
  `displayText`, and optional `diagnostic`. Rich Text stores formula *results* but never calls
  the Formula engine — it depends on Formula only for the `FormulaWireValue` *type*. The
  Document service is what runs evaluation and applies an `apply-formula-settlement`
  operation.
- Modules: `operations.ts` (batch apply + inverses + footprints), `validate.ts`,
  `normalize.ts`, `styles.ts`, `formula-authoring.ts`, `codec.ts`, `clone.ts`,
  `plain-text.ts`, `id-factory.ts`.

Host capabilities (Document, Slide) own all containers and call Rich Text through their own
`rich-text.apply` operation.

## Knowledge

A vector-lattice retrieval index. Sources are **windowed, embedded, and clustered**, and
source text is never stored whole — only the verbatim window text.

```text
add(item) → windowing/{text,stream}.ts → embedder → lattice/cluster.ts → store
retrieve(query) → lattice/descent.ts (beam search) → lattice/regions.ts (merge spans)
```

Public surface: `onSourceMutation`, `add`, `remove`, `listSources`, `resolveScope`,
`retrieve`, `searchTool`.

- **Windows** — overlapping chunks (default 4000 runes, 400 overlap), ID
  `w:sha256(sourceId:text)[0..32]`, storing unit-normalised embeddings and verbatim text so
  *retrieval never reopens the source*.
- **Lattice nodes** — `n:sha256(sortedMemberIds)[0..32]`, with `centroid`, `count`, and
  `cohesion` (weakest pairwise similarity in the clique). Two tiers: source-tier and
  corpus-tier, with a cached `frontier` for descent entry.
- **Scope freezing** — `resolveScope(entries)` returns a `KnowledgeScopeManifest` with
  `resolvedSourceIds`, trusted `resources[]` descriptors, `contextDigest` and `scopeDigest`.
  Passing that manifest into `retrieve` makes membership immutable for the run.
- **Mutation events** — `onSourceMutation` fires *synchronously after* a source change fully
  succeeds; Derived Outputs subscribes for staleness propagation.
- **`searchTool()`** returns an Intelligence `ToolBinding`, i.e. Knowledge can expose itself
  to a model directly. Note its docs flag this binding as *unscoped* — Derived Outputs builds
  its own scoped tools instead.
- `lattice/knn.ts` + `lattice/math.ts` implement PCA + IVF approximate neighbours;
  `lattice/repair.ts` exists but the docs state local repair is **not** in the active
  ingestion path.

Its docs are candid that `retrieveMany`, query-time stored-level-index use, and some
atomicity claims from the design page are unimplemented. There is no dedicated Knowledge
test file.

## Intelligence

Provider-neutral model access. Seven methods:

```text
infer  inferStructured  reason  reasonStructured
reasonWithTools  reasonWithToolsStructured  embed
```

- **Cast-based routing.** A caller asks for `{ purpose, strength, speed }` (each tier
  `low|medium|high`) and a configured route map picks provider + model + effort. The default
  config populates all 9 combinations for `purpose: "general"` and — currently — points every
  inference route at `gpt-4.1-mini` and every reasoning route at `gpt-4.1`. The routing
  machinery is real even though the routing table is uniform.
- **Bounded tool loop.** `reasonWithToolsInternal` drives rounds of model → `ToolSet.execute`
  → messages, with round/call accounting returned in `ToolExecutionResponse`.
- **`ToolSet`** rejects duplicate tool names at construction and **never lets a handler
  exception escape** — it returns `{ ok: false, error: { code: "tool_failed" } }` with a
  generic message, deliberately not including the thrown text.
- **Only provider**: `OpenRouterProvider`. Its error redaction is load-bearing and tested:
  provider HTTP failures surface status and `x-request-id` but **never the response body**
  (`runtime-wiring.test.ts` asserts `assert.doesNotMatch(error.message, /sensitive provider response/)`).

Production consumers: Derived Outputs (planning + synthesis) and Knowledge (embeddings, via
`IntelligenceEmbedder`).

## Observability

81 lines, and deliberately minimal. One `Logger` interface (`debug|info|warn|error`), two
implementations:

- `NoopLogger` — returned when `logging.enabled: false`, so **no caller ever branches on
  whether logging is on**.
- `FileLogger` — level-filtered, delegating the actual write to an injected `writeEntry`
  callback. `1-init/create/logger.ts` supplies a synchronous `appendFileSync` of one JSON line
  to `logs/backend-YYYY-MM-DD.log`, with a comment noting it can be swapped for a buffered
  stream without touching the interface or any call site.

Fastify's own logger is disabled (`Fastify({ logger: false })`) so there is exactly one
correlated JSONL stream. There is a test asserting `src/index.ts` and `jobs/scheduler.ts`
contain no `console.*` calls.

Event naming is `dot.separated.lowercase`: `http.request.completed`, `job.deferred.failed`,
`document.command`, `connector.sync.scheduler.started`, `formula-resolver.snapshot.cache-hit`.
Data objects consistently carry `requestId` / `jobId` for correlation and `durationMs`
measured with `performance.now()`.

Explicit non-goals per its docs: no metrics registry, trace API, audit store, remote exporter,
redaction middleware, rotation cleanup, or flush lifecycle.

## Database — read the label

`0-platform/database/` contains exactly one file: `knowledge-store.ts`, the SQLite adapter for
`KnowledgeStore`. Its docs open by saying what it is *not*:

> There is no shared `Database` interface, migration runner, `create/database.ts` factory,
> migration ledger, capability repository registry, or process-wide connection. Several
> capabilities open their own SQLite databases outside this directory.

So the directory name over-promises relative to its contents. Every capability's SQLite
adapter lives in that capability's own `persistence/` directory; Knowledge's lives here only
because Knowledge is a platform service.

## Web Retrieval — scaffold only

`.gitkeep` and a `docs/` package. The docs page is a good example of the house style: it
documents the *intended* boundary while stating plainly that nothing exists, and closes with
a warning worth honouring — *"using raw `fetch` elsewhere would bypass the intended security
and normalization boundary."*
