# 08 · Conventions

Idioms observed consistently enough to be treated as house style. Follow these when adding
code.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Directories | `kebab-case` | `derived-outputs`, `general-files`, `rich-text` |
| Files | `camelCase` in layered capabilities, `kebab-case` in flat ones | `documentService.ts` vs `sqlite-store.ts` |
| Factories | `create<Thing>` | `createDocumentCapability`, `createFormulaEngine` |
| `1-init` factories | `create<Thing>Instance` when the bare name is taken | `createStructuredDataInstance` |
| Runtime interfaces | `<Name>Capability` / `<Name>Service` / `<Name>Manager` | `DocumentCapability`, `ConnectorService`, `ContextManager` |
| Ports | `<Name>Store` / `<Name>Repository` | `DocumentStore`, `GeneralFileStore` |
| SQLite adapters | `SQLite<Name>Store` | `SQLiteDocumentStore` |
| Wire decoders | `decode<Thing>` | `decodeDocumentCommand` |
| Projections | `project<Thing>` | `projectDocumentOutline` |
| Errors | `<Problem>Error`, one class per failure mode | `RevisionConflictError` |
| Log events | `dot.separated.lowercase` | `document.internal-stage.retrying` |
| Wire error codes | `snake_case` | `revision_conflict`, `identity_reuse` |
| Operation/command types | `dot.separated` namespaced | `block.insert`, `prompt.create.request` |

The file-naming split is a genuine inconsistency correlated with capability age
(`camelCase` = newer layered capabilities). Match whichever the surrounding directory uses.

## Types

- **`interface` for object shapes, `type` for unions.** Discriminated unions on a `type` or
  `kind` field are everywhere: `DocumentOperation`, `DocumentCommand`, `DocumentAttempt`,
  `ContextEntry`, `CellValue`, `DerivedEvidenceSpan`.
- **`readonly` on domain value types.** Flat capabilities are stricter about this than layered
  ones — compare `structured-data/types.ts` (fully readonly) with `document/domain/model.ts`
  (mutable fields, because the reducer builds snapshots).
- **`satisfies` for exhaustive record literals**:
  ```ts
  const defaultStyleIdByBlockKind = { text: normal, code, … } satisfies Record<DocumentBlockKind, string>;
  ```
- **Total switches over unions with no `default`.** `createDocumentInternalJob` switches over
  all seven intent types with no default clause, so adding an intent is a compile error until
  wiring handles it. Prefer this over defensive defaults.
- **Conditional spread for optional properties**, not `undefined` assignment — this matters
  because `canonicalDigest` drops `undefined` keys:
  ```ts
  ...(input.compensation ? { compensation: input.compensation } : {})
  ```

## Functions

- **Arrow-function consts** for exported functions in newer code
  (`export const applyOperations = (…) => …`); `function` declarations in older flat
  capabilities. Both exist; match the file.
- **Classes are private.** Export the interface and a `create…` factory; never the class. The
  exceptions are error classes, `SQLite*Store` adapters, `JobScheduler`/`JobRegistry`, and the
  platform runtimes `Knowledge` / `Intelligence` / `ToolSet`.
- **Stores are synchronous where SQLite is synchronous.** `ContextStore`, `DataStore`,
  `GeneralFileStore`, `ConnectorStore`, and `DerivedOutputStore` are sync — with an explicit
  comment saying why. `DocumentStore`, `SlideStore`, `ActivityStore`, and `KnowledgeStore` are
  `Promise`-returning. Both are acceptable; the async ones keep the door open for a
  non-SQLite backend.
- **`const now = (): string => new Date().toISOString();`** appears in most services.
  Activity instead injects an `ActivityClock`, which is the better pattern for testability.

## Errors

- One typed class per distinguishable failure, in `domain/errors.ts` (or `types.ts` for flat
  capabilities), each setting `this.name` explicitly and carrying the relevant IDs as public
  readonly fields.
- **Domain throws typed errors; job wiring maps them to HTTP.** Domain code never mentions a
  status code.
- **Never leak internals on 500.** Log the real message, return a fixed generic one.
- **Formula is the exception**: it returns `FormulaResult` rather than throwing, because user
  expression errors are ordinary data, not exceptions.

## Logging

- Never `console.*`. There is a test enforcing this for `src/index.ts` and
  `jobs/scheduler.ts`.
- Every service takes `logger: Logger` as a constructor dependency.
- Log data is a flat object with stable keys. Include `requestId` / `jobId` for correlation,
  `durationMs` from `performance.now()`, and for errors:
  ```ts
  errorName: error instanceof Error ? error.name : "UnknownError",
  errorMessage: error instanceof Error ? error.message : String(error)
  ```
- Level discipline: `debug` for per-operation timing, `info` for lifecycle and accepted
  mutations, `warn` for expected-but-notable (capacity, unresolved bindings, retries),
  `error` for unexpected.

## Comments

The codebase comments **why**, not what, and the ratio is high in exactly the places where it
should be: concurrency, ordering, and security decisions. Representative examples worth
imitating:

```ts
// serialActive stays true for the entire job lifecycle, including any
// deferred work that runs after its HTTP response becomes available.

// Start recurring work only after the transport has bound successfully.
// Otherwise a listen failure would leave interval timers keeping the
// failed startup process alive.

// This historical link may be cleared by ChangeSet compaction.
// This copied source value must survive history compaction.

/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow interfaces.
 */
```

Section dividers `// ─── Name ───` are used in flat-shape files. Layered files rely on file
boundaries instead.

## Testing

- `node:test` + `node:assert/strict`. No test framework dependency.
- One file per capability *layer*, not per capability: `document-domain`,
  `document-application`, `document-persistence`, `document-wire`.
- `test/helpers/testDoubles.ts` provides `CapturingLogger`, `ZERO_USAGE`,
  `TEST_FORMULA_LIMITS`. Doubles are hand-written; there is no mocking library.
- **Architectural regression tests are legitimate.** `runtime-wiring.test.ts` asserts on
  `package.json` contents, greps source files for `console.*`, and checks that
  `syncScheduler.start()` appears after `await app.listen` in `startBackend.ts`. Use this
  technique for invariants that types cannot express.
- Test names are full sentences describing the guarantee:
  *"rename makes an old bound Formula reference stale and never retargets it to a new owner"*.
- `--test-concurrency=1` is required (shared SQLite files).

## Documentation

When adding a module, add a `docs/` package beside it with the six standard files:
`README.md` (status + implementation map), `concepts.md`, `types.md`, `runtime.md`,
`flows.md`, `invariants.md`.

The convention that makes these valuable is the **"Status and authority"** section: state
plainly what is implemented, what is not, and which older design page must *not* be read as
describing current behaviour. Several existing packages do this well — copy their tone.

## Things the codebase deliberately does not do

Knowing the non-goals prevents well-meant regressions:

- No dependency-injection container, service locator, or decorators. Composition is explicit
  function calls in `startBackend.ts`.
- No ORM. Hand-written SQL in `better-sqlite3`.
- No validation library (no zod/ajv). Hand-written decoders.
- No mocking library.
- No path parameters in routes. IDs travel in query or body.
- No shared `Database` abstraction. Each capability owns its file and schema.
- No premature type sharing — see the duplicated `PROSE_TEXT_EXTENSIONS` and its comment.
- No raw `fetch` outside a platform provider boundary.
