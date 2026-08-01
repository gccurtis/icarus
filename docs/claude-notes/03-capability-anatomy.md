# 03 · Capability Anatomy

## Two internal shapes exist

`docs/runtime/repository-boundaries.md` sanctions both: *"Small atomic capabilities may keep
these files at the capability root. Large editor capabilities separate `domain`,
`application`, `ports`, `persistence`, and `indexes`. The ownership rule remains the same."*

### A · Layered shape — Document, Slide, Activity, Connector, General Files

```text
3-capabilities/<name>/
  index.ts                   curated public barrel — the ONLY cross-capability entry point
  domain/                    pure, deterministic, no I/O
    model.ts                 canonical types, operations, commands, queries, intents
    errors.ts                one typed error class per failure mode
    canonical.ts             deterministic serialisation + digests
    reducer.ts               operation → new snapshot (+ inverse + touchedIds)
    inverses.ts              inverse-operation generation
    rebase.ts                touched-ID conflict decision
    validation.ts            recursive structural admission
    identities.ts            identity collection + add/remove transitions
    tree.ts                  navigation helpers over the nested aggregate
    layout.ts / geometry.ts  pure measurement
  application/
    <name>Service.ts         the runtime: commands, queries, stages, recovery
    createService.ts         defaults + blank snapshot construction
  ports/
    <name>Store.ts           the persistence contract this capability owns
    <dependency>.ts          one narrow interface per external dependency
  persistence/
    sqliteSchema.ts          table-name derivation + DDL + migrations
    sqlite<Name>Store.ts     the adapter
    sqliteMappers.ts         row ⇄ domain conversion
  projections/               rebuildable, never canonical
    plainText.ts outline.ts styling.ts dependencies.ts
  wire/                      strict decoders for untrusted input
    commandSchemas.ts querySchemas.ts operationSchemas.ts valueSchemas.ts
  docs/                      README concepts types runtime flows invariants
```

### B · Flat shape — Context, Structured Data, Derived Outputs

```text
3-capabilities/<name>/
  index.ts
  types.ts          or domain/model.ts (Derived Outputs uses the latter)
  validation.ts     (Structured Data)
  store.ts          the persistence port
  sqlite-store.ts   the adapter
  <name>.ts         the runtime service
  docs/
```

Derived Outputs is a hybrid: flat files plus a `domain/model.ts`. At 1,325 lines,
`derived-outputs.ts` is the largest single non-store file in the tree and is arguably due for
the layered shape.

**Which shape to use for new work:** follow the layered shape. Document is the reference
implementation and the newest complete capability; Slide mirrors it file-for-file. The flat
shape correlates with the earliest-built capabilities.

## The barrel is the boundary

Every capability has an `index.ts` that explicitly enumerates exports. Cross-capability
imports go through the bare alias (`#document`, `#context`, `#derived-outputs`), never
through a deep path. What a barrel exports tells you exactly what the capability considers
public:

```ts
// document/index.ts — representative
export { createDocumentCapability } from "./application/documentService.js";
export type { DocumentCapability, DocumentDependencies } from "./application/documentService.js";
export * from "./domain/model.js";          // all canonical types
export * from "./domain/errors.js";         // all error classes — job wiring needs these
export { applyOperations, invertOperations, canRebase, … }   // pure domain functions
export { validateSnapshot } from "./domain/validation.js";
export type { DocumentStore, DocumentActivityPublisher, … } from "./ports/…";
export { SQLiteDocumentStore } from "./persistence/sqliteDocumentStore.js";
export { decodeDocumentCommand, decodeDocumentQuery, decodeDocumentOperation, DocumentWireError };
export { projectDocumentPlainText, projectDocumentOutline, … }
```

Note what leaks deliberately: **error classes** (job wiring maps them to status codes),
**wire decoders** (job wiring calls them), and the **SQLite store class** (`1-init`
constructs it). Note what does not: the service *class*, the mappers, the reducer internals.

## The `create` + interface pattern

Nothing exports a class as its public runtime. The invariable idiom:

```ts
export interface DocumentCapability { command(…); query(…); compact(…); … }
export interface DocumentDependencies { richText; formula; formulaResolver; derivedOutputs;
                                        jobs; logger; attribution?; activityPublisher?; }

class DocumentService implements DocumentCapability { /* not exported */ }

export const createDocumentCapability = (
  store: DocumentStore,
  dependencies: DocumentDependencies,
  options: DocumentOptions
): DocumentCapability => new DocumentService(store, dependencies, options);
```

The three-argument signature `(store, dependencies, options)` recurs across Document, Slide,
and (with variations) Activity, Context, Structured Data, Derived Outputs, Connector, and
General Files. `store` is separated from `dependencies` because it is the capability's *own*
persistence, not an external collaborator.

`1-init/create/<name>.ts` is then a thin wrapper that opens the SQLite file and pulls limits
out of `BackendConfig`:

```ts
const DOCUMENT_DB_PATH = "./data/documents.db";

export const createDocumentInstance = (config, richText, formula, formulaResolver,
                                       derivedOutputs, activity, jobs, logger) => {
  const store = new SQLiteDocumentStore(config.projectId, DOCUMENT_DB_PATH);
  return createDocumentCapability(store, {
    richText, formula, formulaResolver, derivedOutputs,
    activityPublisher: createDocumentActivityPublisher(activity),
    jobs, logger,
    attribution: { actorId: config.userId }
  }, config.document);
};
```

## Wire decoding: strict, total, and at the edge

Untrusted input is decoded exactly once, at the job-wiring boundary, into fully-typed domain
values. The Document/Slide `wire/` packages are the strongest version of this:

- **`exactKeys(record, allowed, label)`** — rejects *unknown* keys, not just missing ones.
  Every command and operation declares its exact key set, e.g.
  `OPERATION_KEYS: Record<DocumentOperation["type"], readonly string[]>`. A typo in a client
  payload is a 400, not a silently ignored field.
- **`requireIdentifier` / `requireString` / `requireText` / `requireNonNegativeInteger` /
  `requireEnum` / `requireRecord` / `requireBoolean`** — a small vocabulary of primitive
  validators in `valueSchemas.ts`.
- **`DOCUMENT_WIRE_LIMITS`** — size caps applied before structural decoding.
- A single `DocumentWireError` / `SlideWireError` for every decode failure, mapped to 400.

Contrast with the older capabilities, which cast:

```ts
// connector/registerConnectorEndpointMappings.ts
const result = await service.register(request.body as any);
// context/registerContextEndpoints.ts
const body = request.body as Record<string, unknown>;
const record = await ctx.declare(String(body.displayName ?? ""), parseEntries(body.entries), "user");
```

Context and Structured Data push validation into the service instead (Structured Data has a
272-line `validation.ts` doing ingress canonicalisation). Connector's `as any` is the weakest
spot in the ingress story. **New endpoints should use the `wire/` decoder pattern.**

## Error → status mapping lives in job wiring

Domain code throws typed errors; job wiring owns the HTTP vocabulary. Every wiring file has
one `errorResponse(error): { statusCode, body }` function that is an `instanceof` ladder:

```ts
DocumentNotFoundError | DocumentAttemptNotFoundError    → 404 not_found
DerivedOutputNotFoundError                              → 404 derived_output_not_found
HistoryPrunedError                                      → 410 history_pruned
RevisionConflictError                                   → 409 revision_conflict
StaleDefinitionRevisionError                            → 409 definition_revision_conflict
IdempotencyMismatchError                                → 409 idempotency_mismatch
CompensationConflictError                               → 409 compensation_conflict
DocumentAlreadyExistsError                              → 409 already_exists
DocumentPlacementError                                  → 400 invalid_placement
DocumentStyleReferenceError                             → 400 invalid_style
DocumentIdentityReuseError                              → 400 identity_reuse
DocumentWireError | ValidationError | OperationError
  | StaleAttemptError | InvalidDocumentCursorError      → 400
(anything else)                                         → 500 internal_error
```

Body shape is always `{ error: "<snake_case_code>", message }`. The 500 branch deliberately
returns a **generic message** (`"Document operation failed"`) and logs the real one — internal
errors never leak detail to the client. Only `statusCode >= 500` is logged; expected 4xx
outcomes are not error-logged.

Success codes are chosen by a small pure function:

```ts
const commandStatus = (result: DocumentCommandResult): number => {
  if (result.type === "document.created") return 201;
  if (result.type.endsWith("requested")) return 202;   // async attempt accepted
  return 200;
};
```

## Projections are explicitly non-canonical

`projections/` holds `plainText`, `outline`, `styling`, `dependencies` — all derived from the
canonical snapshot and all rebuildable. `backend-map.md` states the law: *"A derived index
never becomes canonical authority."* None of them are persisted.

## Per-module `docs/` packages

14 modules carry a six-file `docs/` package: `README.md`, `concepts.md`, `types.md`,
`runtime.md`, `flows.md`, `invariants.md`. Present under `0-platform/{database, formula,
intelligence, knowledge, observability, rich-text, web-retrieval}` and
`3-capabilities/{activity, built-in, connector, context, derived-outputs, document,
general-files, slide, structured-data}`.

These are worth reading before touching a module. They are unusually candid — several open
with a "Status and authority" section that names what is *not* implemented, e.g.:

- Database: *"There is no shared `Database` interface, migration runner, `create/database.ts`
  factory, migration ledger, capability repository registry, or process-wide connection."*
- Web Retrieval: *"Status: scaffold only … contains only `.gitkeep`."*
- Slide: *"Implementation status: incomplete and not runnable."*
- Formula: *"the current parser does not preserve projection fields in the projection-plus-filter
  pipe form, `toWire` throws for functions instead of returning a diagnostic result, and some
  configured limits are not enforced."*

Each also carries an "Implementation map" table linking concern → file, which is the fastest
way to find the right file in an unfamiliar capability.
