# 03 · Capability Anatomy

*Verified against source at commit ef6d462, 2026-08-09.*

`src/3-capabilities/` holds **13 directories, 133 TypeScript files, 32,246 lines**. Twelve are
reachable over HTTP; `slides/` is built, typechecked and tested but nothing constructs it (see
[07-capabilities/slides.md](07-capabilities/slides.md)). This page describes the internal shape a
capability directory takes, which shape each one actually uses today, and the five patterns that
recur across the shapes: the barrel boundary, the `create` + interface factory, the `wire/`
decoder, the error→status ladder, and projections.

The superseded design page is at
[phase-1/claude-notes/03-capability-anatomy.md](../phase-1/claude-notes/03-capability-anatomy.md).
Its shape list is stale (it predates Comments, Templates, Persona, Investigation and the `slides/`
rebuild) and several of its identifier names are wrong; do not copy from it.

---

## 1 · Three shapes, and who uses which

Measured by listing each capability directory at HEAD.

| Capability | Shape | `index.ts` | `domain/` | `application/` | `ports/` | `persistence/` | `wire/` | `projections/` | other | Files / lines |
| --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- | ---: |
| **document** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | 28 / 9,721 |
| **slides** | Layered *(incomplete)* | — | ✓ | — | ✓ | ✓ | — | — | — | 15 / 6,765 |
| **templates** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | 14 / 2,436 |
| **persona** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | 15 / 1,609 |
| **comments** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | 13 / 1,588 |
| **connector** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | `providers/` | 9 / 1,535 |
| **investigation** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | 5 / 2,222 |
| **activity** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | 8 / 957 |
| **general-files** | Layered | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | 6 / 871 |
| **derived-outputs** | Hybrid | ✓ | ✓ | — | — | — | — | — | flat root files | 5 / 2,837 |
| **structured-data** | Flat | ✓ | — | — | — | — | — | — | flat root files | 6 / 1,089 |
| **context** | Flat | ✓ | — | — | — | — | — | — | flat root files | 5 / 569 |
| **built-in** | Functions | — | — | — | — | — | — | — | 4 loose files | 4 / 47 |

Nine of thirteen are layered. Four of the nine carry a `wire/` package (Document, Templates,
Persona, Comments). One carries `projections/` (Document). Two remain flat (Context, Structured
Data), one is a hybrid (Derived Outputs), and Built-in is not a capability in the structural sense
at all — four exported async functions with no state, no store and no barrel.

**Hybrid** means: flat files at the root, plus a `domain/model.ts` that holds the types and error
classes. Derived Outputs is the only one. Its four root files are `derived-outputs.ts` (1,342
lines, the service), `sqlite-store.ts` (1,034), `store.ts` (157, the port) and `index.ts` (43).
The service file is the largest file in any flat or hybrid capability; the largest non-store file
in the whole backend is Document's `application/documentService.ts` at 2,215 lines.

**Slides is layered but truncated.** It has `domain/` (11 files), `persistence/` (3) and `ports/`
(1) — and no `application/`, no `index.ts`, no `wire/`. There is nothing to construct and nothing
to import; its only consumers in the repository are two test files that import by relative path.

### Which shape to use for new work

**Layered, with a `wire/` package.** Document is the reference implementation: it is the largest,
the only one where every seam — decode, domain, application, port, adapter, projection — is a
separate file you can read on its own, and the only one with a test file per layer
(`document-domain` 1,230 lines, `document-application` 1,912, `document-persistence` 897,
`document-wire` 500 — 4,539 lines and 76 tests). Templates is the smaller worked example of the
same shape (2,436 source lines, 2,411 test lines, 114 tests) and is easier to read end to end.

The flat shape correlates with build order, not with size: Context (569 lines) and Structured Data
(1,089) are among the earliest capabilities, and Derived Outputs grew to 2,837 lines without ever
being split. The concrete cost is visible in ingress quality — every flat and hybrid capability
casts its request body (§6) — and in Derived Outputs' 1,342-line service file, which mixes prompt
construction, JSON-schema literals, validation helpers, the service class and tool builders in one
compilation unit.

---

## 2 · The layered shape, file by file

Every path below exists in at least one capability at HEAD. Nothing here is aspirational.

```text
3-capabilities/<name>/
  index.ts                 curated public barrel — the only cross-capability entry point
  domain/                  pure, deterministic, no I/O, no logger
    model.ts               canonical types, operation/command/query/intent unions, limits
    errors.ts              one typed error class per distinguishable failure
    canonical.ts           deterministic serialisation + digests
    validation.ts          structural admission of a whole snapshot or a definition
    reducer.ts             operation → new snapshot (+ inverse + touchedIds)
    inverses.ts            inverse-operation generation
    rebase.ts              touched-ID conflict decision
    identities.ts          identity collection and add/remove transitions
    tree.ts                navigation helpers over the nested aggregate
    layout.ts / geometry.ts   pure measurement
    render.ts              deterministic text rendering (Persona)
    builtin.ts             a hard-coded immutable record (Persona)
    elements.ts / presentation.ts   element vocabulary and inheritance (Slides)
    provider.ts / reader.ts   external-source ports kept in domain (Connector)
  application/
    <name>Service.ts       the runtime: commands, queries, stages, recovery, logging
    createService.ts       defaults and blank-snapshot construction (Document only)
  ports/
    <name>Store.ts         the persistence contract this capability owns
    <dependency>.ts        one narrow interface per external collaborator
  persistence/
    sqliteSchema.ts        table-name derivation + fresh-schema DDL + pragmas
    sqlite<Name>Store.ts   the better-sqlite3 adapter
    sqliteMappers.ts       row ⇄ domain conversion
  wire/                    strict decoders for untrusted input (4 capabilities)
    valueSchemas.ts commandSchemas.ts querySchemas.ts operationSchemas.ts common.ts
  projections/             rebuildable, never canonical (Document only)
    plainText.ts outline.ts styling.ts dependencies.ts
  providers/               concrete external adapters (Connector only)
  docs/                    README concepts types runtime flows invariants
```

### Deviations the shape does not enforce

Nothing checks any of this; it is convention, and it is applied unevenly.

| Deviation | Where | Detail |
| --- | --- | --- |
| Errors not in `domain/errors.ts` | Investigation | The four error classes live in `domain/model.ts:281-315`. Investigation's whole domain is one 313-line `model.ts`; there is no `errors.ts`, `canonical.ts` or `validation.ts`. |
| Wire error not in `domain/` | Document | `DocumentWireError` is declared in [`wire/valueSchemas.ts:38`](../../apps/backend/src/3-capabilities/document/wire/valueSchemas.ts). Templates, Persona and Comments declare theirs in `domain/errors.ts`. |
| Port file named `repository.ts` | Connector, General Files | `ports/repository.ts`, not `ports/<name>Store.ts` — although the exported interface is `ConnectorStore` / `GeneralFileStore`. |
| Adapter file named `…Repository.ts` | Connector, General Files | `persistence/sqliteConnectorRepository.ts` exports `SQLiteConnectorStore`; `persistence/sqliteGeneralFileRepository.ts` exports `SQLiteGeneralFileStore`. File name and class name disagree. |
| No `sqliteSchema.ts` | Connector, General Files, Investigation | DDL is inline in the adapter. |
| No `sqliteMappers.ts` | everything except Document, Slides, Templates | Row mapping is inline. |
| Two files in `application/` | Document | `documentService.ts` + `createService.ts`. Every other layered capability has exactly one. |

---

## 3 · The barrel is the boundary

Every capability except `built-in` and `slides` has an `index.ts`. Cross-capability imports go
through the bare subpath alias (`#document`, `#templates`, `#context`, …), never through a deep
path — `grep -rnE 'from "\.\./\.\./\.\.' src` returns zero hits, and there are 13 bare module
aliases in `package.json`'s `imports` map (32 entries total).

Barrels are hand-enumerated, not `export *` over the directory. Sizes:

| Barrel | Lines | Style |
| --- | ---: | --- |
| `document/index.ts` | 67 | named exports, plus `export *` from `domain/model` and `domain/errors` |
| `derived-outputs/index.ts` | 43 | fully named |
| `connector/index.ts` | 32 | fully named |
| `persona/index.ts` | 29 | named + 2 `export *` |
| `templates/index.ts` | 29 | named + 2 `export *` |
| `comments/index.ts` | 23 | named + 2 `export *` |
| `general-files/index.ts` | 20 | fully named |
| `structured-data/index.ts` | 15 | fully named |
| `activity/index.ts` | 13 | named + 2 `export *` |
| `context/index.ts` | 6 | fully named |
| `investigation/index.ts` | 4 | **four `export *` lines and nothing else** |

Investigation's barrel is the exception that proves the rule: it re-exports the whole of
`domain/model.js`, `ports/investigationStore.js`, `persistence/sqliteInvestigationStore.js` and
`application/investigationRuntime.js`, so it draws no boundary at all.

### What deliberately leaks

Reading `document/index.ts` tells you exactly what the capability considers public:

| Leaked | Why | Consumer |
| --- | --- | --- |
| **Error classes** | job wiring maps them to status codes | `4-job-wiring/*/register*.ts` |
| **Wire decoders** | job wiring calls them on `request.body` | same |
| **The `SQLite*Store` class** | `1-init` opens the file and constructs the adapter | `1-init/create/<name>.ts` |
| **Port *types*** | `1-init` needs them to type what it passes in | same |
| **Pure domain functions** | tests and, for Document, other capabilities' reasoning | tests |
| **Projections** | nothing in production — see §8 | tests only |

### What does not leak

The service class. `grep -rh "^export class" src/3-capabilities` returns **92** exported classes:
**79 error classes and 12 `SQLite*Store` adapters** — and one exception,
`DerivedOutputServiceImpl` at
[`derived-outputs/derived-outputs.ts:578`](../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts),
which is `export class` in its own module but is *not* re-exported from the barrel. So the rule
holds at the boundary even where it is broken inside the module.

Also not leaked: `sqliteMappers`, `sqliteSchema`, reducer internals not explicitly listed, and
every `application/` file other than the factory and its interfaces.

---

## 4 · The `create` + interface pattern

Nothing exports a class as its public runtime. The invariable idiom is: an exported interface, an
unexported class, and an exported `create…` arrow or function returning the interface.

```ts
// 3-capabilities/document/application/documentService.ts:2211-2215
export const createDocumentCapability = (
  store: DocumentStore,
  dependencies: DocumentDependencies,
  options: DocumentOptions
): DocumentCapability => new DocumentService(store, dependencies, options);
```

`store` is separated from `dependencies` because it is the capability's *own* persistence, not an
external collaborator. That three-argument signature is exact for Document only; the others vary,
and the variance is worth knowing before you copy one:

| Capability | Factory | Signature |
| --- | --- | --- |
| document | `createDocumentCapability` | `(store, dependencies, options)` |
| comments | `createCommentsCapability` | `(store, dependencies, options = {}, clock = systemClock, createId = randomUUID)` |
| activity | `createActivityCapability` | `(store, dependencies, options = {}, clock = systemClock)` |
| templates | `createTemplateCapability` | `(store, dependencies, clock = systemClock, createId = randomUUID)` — **no `options`** |
| persona | `createPersonaCapability` | `(store, dependencies)` — clock is inside `dependencies` |
| context | `createContextManager` | `(store, config, logger)` |
| structured-data | `createStructuredData` | `(store, config, logger)` |
| general-files | `createGeneralFileService` | `(store, knowledge, logger)` |
| connector | `createConnectorService` | `(store, knowledge, providers, logger)` |
| investigation | `createInvestigationRuntime` | `(store, knowledge, logger, context)` |
| derived-outputs | `createDerivedOutputService` | `(store, knowledge, intelligence, resourceReader, config, logger)` |

Five of the eleven (Document, Comments, Activity, Templates, Persona) bundle collaborators into a
single `Dependencies` object. The other six pass them positionally; Derived Outputs takes six
positional arguments. **Bundle them.** A positional list is why `createDerivedOutputService` cannot
gain a collaborator without touching every call site by hand.

### `1-init/create/<name>.ts` is the thin wrapper

`src/1-init/create/` holds 23 files. A capability factory there opens the SQLite file, builds any
translation adapters, and pulls limits out of `BackendConfig`:

```ts
// 1-init/create/document.ts:22, 54-75
const DOCUMENT_DB_PATH = "./data/documents.db";

export const createDocumentInstance = (
  config: BackendConfig, richText, formula, formulaResolver,
  derivedOutputs, activity, jobs, logger
): DocumentCapability => {
  const store = new SQLiteDocumentStore(config.projectId, DOCUMENT_DB_PATH);
  return createDocumentCapability(store, {
    richText, formula, formulaResolver, derivedOutputs,
    activityPublisher: createDocumentActivityPublisher(activity),
    jobs, logger,
    attribution: { actorId: config.userId }
  }, config.document);
};
```

The database path is a **cwd-relative literal** in each factory, not a configuration value. See
[09-configuration.md](09-configuration.md) for what that means when the process is started from a
different directory.

Naming: the factory is `create<Thing>Instance` where the bare name is already taken by the
capability's own factory (`createDocumentInstance`, `createTemplatesInstance`,
`createStructuredDataInstance`, `createContextManagerInstance`, …), and `create<Thing>` where it is
not (`createFormula`, `createKnowledge`, `createIntelligence`, `createLogger`, `createApp`).

---

## 5 · Ports, and the structural seam

A port is a narrow interface declared by the *consumer*, in that consumer's `ports/` directory.
There are two kinds.

**Store ports** — one per capability, the persistence contract. Seven are synchronous
(`ConnectorStore`, `ContextStore`, `DataStore`, `DerivedOutputStore`, `GeneralFileStore`,
`InvestigationStore`, `TemplateStore`) with the reason stated in the file header —
`context/store.ts:2`: *"All methods are synchronous (SQLite is synchronous)."* Five return
`Promise` (`ActivityStore`, `CommentStore`, `DocumentStore`, `PersonaStore`, `SlidesStore`).
`DocumentStore` declares 49 `Promise`-returning methods and `SlidesStore` 40.

**Collaborator ports** — one file per external dependency, deliberately tiny. The three
`ports/activityPublisher.ts` files are 11, 6 and 6 lines and are three separate declarations of
the same idea:

```ts
// comments/ports/activityPublisher.ts — the whole file
/** Narrow source-side Activity port; Comments never imports the Activity runtime. */
export interface CommentActivityPublisher {
  publish(transaction: CommentCommittedTransaction): Promise<void>;
}
```

### Two ports are satisfied *structurally*, with no adapter

This is the codebase's sharpest composition idea and it is documented in the source itself.
[`templates/ports/templatableResource.ts:3-19`](../../apps/backend/src/3-capabilities/templates/ports/templatableResource.ts):

> What a resource capability must be able to do for Templates to make templates out of it. **Not an
> adapter: there is no object implementing this by hand in `1-init`.** The resource capability's own
> runtime satisfies it **structurally**, and composition is one line —
>
> ```ts
> templateResources.register(document);
> ```
>
> The interface exists so that line typechecks. Without it the registry would be
> `Record<string, any>` and a missing or renamed method would surface at runtime as "undefined is
> not a function" inside a serial job. Typing the registry as `DocumentCapability` is the other
> alternative and fails twice over: Templates would import a capability, and the registry could
> never hold a second kind.
>
> Same pattern as `ContextManager` satisfying `PersonaContextPort`.

And at the composition site, [`1-init/startBackend.ts:116-119`](../../apps/backend/src/1-init/startBackend.ts):

```ts
// One line, no adapter: DocumentCapability satisfies TemplatableResource
// structurally. This is the only place that sees both, which is what keeps
// Templates and Document from importing each other.
templateResources.register(document);
```

The second instance is Persona → Context.
[`persona/ports/personaContext.ts:1-16`](../../apps/backend/src/3-capabilities/persona/ports/personaContext.ts)
declares three methods (`declare`, `delete`, `purge`) and explains every omission, including why
there is no `update`.

**The failure mode is the same in both places, and it is live.** Structural satisfaction means the
port has no runtime object of its own, so tests substitute a double and never exercise the real
collaborator. Both seams currently harbour a defect that this hides:

- **Templates → Document.** `DocumentTemplateRuntime.logicalDelete`
  ([`documentService.ts:777-787`](../../apps/backend/src/3-capabilities/document/application/documentService.ts))
  builds `command: { type: "document.delete", documentId: input.resourceId }` with **no
  `expectedRevision`** and casts the envelope `as DocumentCommandRequest`. `deleteDocument`
  (`documentService.ts:910-912`) does `if (head.revision !== expectedRevision) throw new
  RevisionConflictError(...)`, which with `undefined` is always true for a live document.
  `templateService.ts:555` calls `resource.logicalDelete(...)` and does not catch. Document is the
  only registered kind, so **`template.delete` on any Document-backed template throws before the
  catalog row is removed.** `templates.test.ts` uses a fake `TemplatableResource`; nothing covers
  it.
- **Persona → Context.** `personaService.ts:393` declares the replacement wrapper while the old
  wrapper of the same name is still live; `context.ts:115-116` throws `ContextConflictError`, which
  is not on Persona's error ladder, so changing a persona's context reference returns **HTTP 500**.
  Both Persona suites substitute a `PersonaContextPort` double whose `declare` never checks names.

Both are recorded in [11-known-issues.md](11-known-issues.md). Use the pattern — it is genuinely
better than a hand-written adapter — but write at least one test that wires the real objects
together.

---

## 6 · The `wire/` decoder pattern

Untrusted input is decoded exactly once, at the job-wiring boundary, into fully typed domain
values. Four capabilities do this properly, in a `wire/` package: **Document, Templates, Persona,
Comments**.

| Capability | `wire/` files | Lines | Entry points | Error class | Limits |
| --- | --- | ---: | --- | --- | --- |
| document | `valueSchemas` `operationSchemas` `commandSchemas` `querySchemas` | 1,362 | `decodeDocumentCommand`, `decodeDocumentQuery`, `decodeDocumentOperation` | `DocumentWireError` (in `wire/`) | `DOCUMENT_WIRE_LIMITS`, 9 keys |
| templates | `valueSchemas` `commandSchemas` `querySchemas` | 495 | `decodeTemplateCommand`, `decodeTemplateQuery` | `TemplateWireError` (in `domain/`) | `TEMPLATE_WIRE_LIMITS`, 9 keys |
| persona | `common` `commandSchemas` `querySchemas` | 215 | `decodePersonaCommand`, `decodePersonaQuery` | `PersonaWireError` (in `domain/`) | in `domain/validation.ts` |
| comments | `common` `commandSchemas` `querySchemas` | 154 | `decodeCommentCommand`, `decodeCommentQuery` | `CommentWireError` (in `domain/`) | in `domain/validation.ts` |

### `exactKeys` — reject unknown keys, not just missing ones

All four declare their own copy. Persona's carries the rationale
([`persona/wire/common.ts:11-12`](../../apps/backend/src/3-capabilities/persona/wire/common.ts)):

```ts
/** Rejects unknown keys, not just missing ones. A client typo is a 400, not a
 *  silently dropped field. */
export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new PersonaWireError(`${label} contains unexpected field '${unexpected[0]}'`);
  }
};
```

Document's variant reports *every* unknown key rather than the first
(`valueSchemas.ts:138-148`). Neither is shared; there are four copies.

The rule has teeth at the command level too — `commandSchemas.ts:36-38`:

```ts
case "document.create":
  // No documentId: the service allocates it. Supplying one is an unknown key
  // and therefore a 400, rather than a value that looks accepted and is not.
  exactKeys(raw, ["type", "title", "pageLayout", "styles"], type);
```

### The primitive validator vocabulary

Document's `wire/valueSchemas.ts` (870 lines) is the fullest version:

| Validator | Rejects |
| --- | --- |
| `requireRecord` | non-objects, arrays, and anything whose prototype is not `Object.prototype` or `null` |
| `requireText` | non-strings; strings over `maxStringBytes` (262,144) |
| `requireString` | as above, plus the empty string |
| `requireIdentifier` | as above, plus over `maxIdentifierBytes` (512) |
| `requireBoolean` | anything but a literal boolean |
| `requireFiniteNumber` | non-numbers, `NaN`, `±Infinity` |
| `requireInteger` | anything failing `Number.isSafeInteger` |
| `requireNonNegativeInteger` / `requirePositiveInteger` | as above, plus sign |
| `requireEnum` | anything outside an explicit `readonly T[]` |
| `requireArray` | non-arrays; arrays over `maxCollectionItems` (10,000) |
| `exactKeys` | unknown keys |

Templates' vocabulary is shaped differently — its helpers take `(record, key, label)` rather than
`(value, label)` — and adds `optionalText`, `requireName`, `requireIdentifierList`,
`requireRevision`. Three of its decisions are recorded verbatim in
[`templates/wire/valueSchemas.ts`](../../apps/backend/src/3-capabilities/templates/wire/valueSchemas.ts):

- `requireName` (`:70-79`): *"Trimmed at ingress so trailing whitespace cannot produce two catalog
  entries that read identically. The command digest is taken over the decoded value, so it sees
  the trimmed form and an exact retry still replays."*
- `requireIdentifierList`: *"Duplicates are rejected rather than de-duplicated, on the same
  principle as `exactKeys`: a request that asks for the same kind twice means something the caller
  did not intend, and silently tidying it hides that."*
- `requireRevision`, matched almost word for word by Persona's `revisionField`
  (`persona/wire/common.ts:45-51`): *"Deliberately strict: coercing a missing value with `Number()`
  yields `NaN`, which compares unequal to every stored revision and surfaces a malformed request as
  a misleading revision conflict. A client retrying on 409 would retry forever."*

### Wire limits

Two capabilities put limits in `wire/`; two put them in `domain/validation.ts`.

`DOCUMENT_WIRE_LIMITS` (`wire/valueSchemas.ts:45-56`):

| Key | Value |
| --- | ---: |
| `maxPayloadBytes` | 1,048,576 |
| `maxStringBytes` | 262,144 |
| `maxIdentifierBytes` | 512 |
| `maxVariableNameBytes` | 512 — *"Context Variable names. Short by nature: a template binding types them."* |
| `maxCollectionItems` | 10,000 |
| `maxOperations` | 1,000 |
| `maxRichTextOperations` | 1,000 |
| `maxDepth` | 32 |
| `maxNodes` | 100,000 |

`TEMPLATE_WIRE_LIMITS` (`templates/wire/valueSchemas.ts:7-19`): `maxIdentifierBytes` 512,
`maxNameBytes` 512, `maxDescriptionBytes` 4,096, `maxBindings` 256, `maxBindingNameBytes` 512,
`maxSearchBytes` 512, `maxCursorBytes` 1,024, `maxKinds` 64 (*"Filtering by more kinds than exist
is a malformed request, not a broad one."*), `maxPageLimit` 200.

Document applies its budget **before** structural decoding, in `assertDocumentWireInput`
(`valueSchemas.ts:60-125`), which walks the value once and rejects cycles, symbol keys, non-plain
prototypes, non-finite numbers, over-deep nesting, over-wide collections, non-JSON-serialisable
values, and over-large encoded payloads. Every top-level decoder calls it first. Templates,
Persona and Comments have no equivalent whole-payload scan; they apply per-field limits only.

### The `OPERATION_KEYS` parity trick

[`document/wire/operationSchemas.ts:50`](../../apps/backend/src/3-capabilities/document/wire/operationSchemas.ts):

```ts
const OPERATION_KEYS: Record<DocumentOperation["type"], readonly string[]> = {
  "document.rename": ["type", "title"],
  …
  "visual.set-dimensions": ["type", "blockId", "dimensions"],
};
```

Because the object is typed as a `Record` keyed by the operation union, TypeScript requires an
entry for **every** one of Document's 39 operation variants and rejects any key that is not one.
Adding a 40th operation to `domain/model.ts` without adding a decoder entry is a compile error, and
vice versa.

Be precise about what this buys: it guarantees *one entry per operation type*. It does **not**
verify that the listed field names match the variant's actual fields — those lists are
hand-maintained and unchecked — and the `switch` inside `decodeDocumentOperation` is not
exhaustiveness-checked either, because `type` was cast. A variant with an `OPERATION_KEYS` entry
but no `case` would pass `exactKeys` and be admitted with no per-field validation.

### What the other nine do instead

| Capability | Ingress | Consequence |
| --- | --- | --- |
| investigation | 11 hand-written `decode*` functions inside the 846-line wiring file | strict, but not reusable and not on any barrel |
| activity | 3 `decode*` functions inside the 173-line wiring file | same |
| structured-data | `request.body as Record<string, unknown>` at 11 sites; a 272-line `validation.ts` in the capability does ingress canonicalisation | validation happens, one layer later |
| context | `as Record<string, unknown>` at 7 sites, with `String(…)`/`Number(…)` coercion | a missing `expectedRevision` becomes `NaN` and yields **409 `stale_revision`** instead of 400; a missing `displayName` becomes `""` and **is accepted** |
| derived-outputs | `as Record<string, unknown>` at 4 sites | — |
| connector | `service.register(request.body as any)` at `registerConnectorEndpointMappings.ts:56`, plus 8 `(request.body ?? {}) as {…}` destructures | the service is the only validator; unknown keys are ignored |
| general-files | `service.upload(request.body as any)` at `registerGeneralFileEndpointMappings.ts:43`, plus 5 destructures | same; `filters` reach the SQL builder, and an unknown `filter.kind` is **silently ignored** |
| built-in | none — `/echo` reflects its body verbatim | — |
| slides | none — unreachable | — |

Those two `as any` casts are the *only* two in `src/` (`grep -rn "as any" src --include=*.ts` → 2).
They are the weakest point in the ingress story and both feed a service method directly.

---

## 7 · The error → status ladder

Domain code throws typed errors and never mentions a status code. Job wiring owns the HTTP
vocabulary: each wiring file declares one `errorResponse(error): { statusCode, body }` function
that is an `instanceof` ladder, and the response body is always `{ error: "<snake_case_code>",
message }` (some rungs add fields — Templates' `binding_mismatch` carries `missing` and
`unexpected`; Context's `context_invalid` carries `field`).

Document's ladder, in source order
([`registerDocumentEndpoints.ts:33-85`](../../apps/backend/src/4-job-wiring/document/registerDocumentEndpoints.ts)):

| Error | Status | Code |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `DocumentNotFoundError`, `DocumentAttemptNotFoundError` | 404 | `not_found` |
| `DerivedOutputNotFoundError` | 404 | `derived_output_not_found` |
| `HistoryPrunedError` | 410 | `history_pruned` |
| `InvalidDocumentCursorError` | 400 | `invalid_cursor` |
| `RevisionConflictError` | 409 | `revision_conflict` |
| `StaleDefinitionRevisionError` | 409 | `definition_revision_conflict` |
| `IdempotencyMismatchError`, `DerivedOutputDefinitionUpdateIdempotencyConflictError` | 409 | `idempotency_mismatch` |
| `CompensationConflictError` | 409 | `compensation_conflict` |
| `DocumentPlacementError` | 400 | `invalid_placement` |
| `DocumentStyleReferenceError` | 400 | `invalid_style` |
| `DocumentIdentityReuseError` | 400 | `identity_reuse` |
| `DocumentWireError`, `DocumentValidationError`, `DocumentOperationError`, `DocumentStaleAttemptError` | 400 | `validation_error` |
| *(anything else)* | 500 | `internal_error`, message `"Document operation failed"` |

### The one cross-capability HTTP contract

`ResourceNotDeletedError` → **409 `not_deleted`** and `ResourceHistoryNotFoundError` → **404
`not_found`** are mapped identically in **all ten** wiring files that handle them: comments:26,
connector:31, context:15, derived-outputs:16, document:34, general-files:18, investigation:411,
persona:21, structured-data:18, templates:24. Both classes are declared once, in
[`0-utils/persistence/resourceHistory.ts:23-41`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts).
Activity and Built-in have no retention port and therefore no rung. This is the only HTTP contract
shared across capabilities and it exists purely by repetition — nothing enforces it.

### The ladders are not uniform, and the differences matter

| Wiring file | Fallback | Leaks internal message? |
| --- | --- | --- |
| document | 500 `internal_error` "Document operation failed" | no |
| templates | 500 `internal_error` "Template operation failed" | no |
| persona | 500 `internal_error` "Persona operation failed" | no — with the comment *"Internal errors never leak detail to the client; the real message is logged."* |
| comments | 500 `internal_error` "Comment operation failed" | no |
| activity | 500 `internal_error` "Activity query failed" | no |
| investigation | 500 `internal_error` "Investigation request failed" | no |
| connector | 500 `internal_error` | **yes** — `message` is `e.message` |
| general-files | 500 `internal_error` | **yes** — `message` is `e.message` |
| context | **400 `bad_request`** | **yes** |
| structured-data | **400 `bad_request`** | **yes** |
| derived-outputs | **400 `bad_request`** | **yes** |

Three capabilities have no 500 rung at all: an unrecognised exception becomes a 400 with the raw
message. That is the opposite of the convention stated in
[08-conventions.md](08-conventions.md#errors), and it means an internal SQLite failure in Context,
Structured Data or Derived Outputs is reported to the client as a client error.

Four Context endpoints (`GET /contexts`, `GET /contexts/entry`, `GET /contexts/by-name`,
`POST /contexts/resolve`) have **no `try/catch` at all**, so their errors bypass the ladder
entirely and surface as Fastify's generic 500 body.

### Success status is a small pure function

```ts
// registerDocumentEndpoints.ts:88-92
const commandStatus = (result: DocumentCommandResult): number => {
  if (result.type === "document.created") return 201;
  if (result.type.endsWith("requested")) return 202;   // async attempt accepted
  return 200;
};
```

Templates, Comments and Persona have the one-line version (`201` on `*.created`/`*.registered`,
else `200`). Document is the only capability that returns 202, and only for the three
`*.requested` results that start an async attempt — see
[05-async-attempt-pipeline.md](05-async-attempt-pipeline.md).

### Logging in the ladder

Only `statusCode >= 500` is error-logged; expected 4xx outcomes are not. The helper is duplicated
per wiring file and logs **`errorName` only, not `errorMessage`**:

```ts
// registerDocumentEndpoints.ts:94-100
const logUnexpected = (logger, event, requestId, error): void => {
  logger.error(event, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
};
```

Connector and General Files log both name and message. Context's wiring receives **no `Logger` at
all** — `registerContextEndpoints(registry, ctx)` takes two arguments.

---

## 8 · Projections are explicitly non-canonical

`document/projections/` is the only projections package in the tree: four files, 170 lines, five
exported functions — `projectDocumentPlainText`, `projectDocumentOutline`,
`projectDocumentDependencies`, `projectDocumentBlockStyle`, `projectDocumentTextStyling`.

Each takes a `DocumentSnapshot` (and, where text is involved, the `RichText` platform runtime) and
returns a fresh derived value. None is persisted: there is no projection table in
`data/documents.db`, no cache, and no invalidation path. They are pure functions over the canonical
snapshot and can be recomputed at any time.

**They currently have no production caller.** `grep -rn "projectDocument" src` returns hits only in
`projections/` itself and in `document/index.ts`; the only consumers anywhere are
`test/capabilities/document-domain.test.ts`. They are exported, typechecked and tested, and no
request reaches them.

The rule they encode is worth keeping even so: a derived view never becomes canonical authority.
If you add a projection, keep it pure, keep it out of `persistence/`, and do not let anything read
it back as truth.

---

## 9 · The per-module `docs/` package

**19 modules carry a six-file `docs/` package** — `README.md`, `concepts.md`, `types.md`,
`runtime.md`, `flows.md`, `invariants.md` — which is 19 × 6 = **114 `.md` files**, matching
`find src -name '*.md' | wc -l` exactly. They sit under `0-platform/{database, formula,
intelligence, knowledge, observability, rich-text, web-retrieval}` and
`3-capabilities/{activity, built-in, comments, connector, context, derived-outputs, document,
general-files, investigation, persona, structured-data, templates}`.

**`3-capabilities/slides/` is the only module with no `docs/`.** There are 20 module directories
under `0-platform` + `3-capabilities` and 19 packages.

The convention that makes them valuable is the opening **"Status and authority"** section, which
states plainly what is *not* implemented and which older design page must not be read as current.
`0-platform/database/docs/README.md:7` is the model:

> There is no shared `Database` interface, migration runner, `create/database.ts` factory, migration
> ledger, capability repository registry, or process-wide connection. Several capabilities open
> their own SQLite databases outside this directory. The older Database platform design describes
> an intended broader boundary; it must not be read as implemented behavior.

These packages vary widely in accuracy — `structured-data`, `formula`, `knowledge`, `web-retrieval`
and `built-in` are reliable; `observability` and `templates` are badly stale. The per-package
verdicts are in [10-verified-status.md](10-verified-status.md).

---

## 10 · Summary: what to copy

| Do | Because |
| --- | --- |
| Layered directories, one concern per file | the only shape where each seam is independently readable |
| A hand-enumerated `index.ts` | it is the capability's public contract; `export *` (Investigation) draws no boundary |
| `create<Name>Capability(store, dependencies, options)` returning an interface | keeps the class private and makes collaborators additive |
| A `wire/` package with `exactKeys` and explicit limits | unknown keys become 400s instead of silent drops |
| Typed errors in `domain/errors.ts`, mapped in job wiring | domain code stays transport-agnostic |
| A fixed generic message on the 500 rung | internal detail never reaches the client |
| A narrow port per collaborator, in the consumer's `ports/` | this is what keeps capabilities from importing each other |
| A six-file `docs/` package with a "Status and authority" section | it is the only place non-implementation is recorded |

| Do not | Because |
| --- | --- |
| `request.body as any` / `as Record<string, unknown>` | the two `as any` casts and the coercion sites in Context are where malformed requests turn into misleading 409s and accepted empty names |
| Positional collaborator arguments | `createDerivedOutputService` takes six and cannot grow |
| A `bad_request` fallback rung | it reports server failures as client errors (Context, Structured Data, Derived Outputs) |
| Ship a structural port without one real-object test | both structural seams in the tree currently hide a defect |
| Skip the `docs/` package | Slides is the counter-example: 6,765 lines and nothing describing them |
