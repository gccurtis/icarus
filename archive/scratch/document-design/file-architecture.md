# Document capability — file architecture

## Placement

Document is a regular project-scoped capability. Initialization consumes
`projectId` while constructing its SQLite store. No file below accepts user
scope or lets a request select project scope.

```text
apps/backend/src/
  3-capabilities/
    document/
      domain/
        model.ts              # snapshot, styles, Rows, Blocks, placement, operations
        errors.ts             # typed domain and application errors
        reducer.ts            # pure operation application
        inverses.ts           # exact compensation generation
        validation.ts         # recursive invariants, dimensions, limits
        canonical.ts          # deterministic encoding and semantic digest
        rebase.ts             # touched IDs and conservative rebase
      application/
        documentService.ts    # runtime, admission, reads, stages, compensation
        createService.ts      # blank creation and default styles
      ports/
        documentStore.ts      # project-bound persistence contract
        derivedOutputs.ts     # narrow public Derived Outputs runtime port
        formulaResolver.ts    # immutable project resolver-snapshot reader
      persistence/
        sqliteDocumentStore.ts
        sqliteMappers.ts
        sqliteSchema.ts
      wire/
        commandSchemas.ts     # strict DTO decoders
        querySchemas.ts
        operationSchemas.ts
        valueSchemas.ts
      projections/
        plainText.ts
        outline.ts
        dependencies.ts
        styling.ts
      index.ts

  1-init/create/
    document.ts

  0-utils/jobs/
    internalRuntime.ts        # typed non-HTTP Job dispatch and registration

  4-job-wiring/document/
    registerDocumentEndpoints.ts
    createDocumentJobs.ts
    registerDocumentInternalJobs.ts
    documentJobPayloads.ts
```

Exact pagination has no initial module, endpoint, SQL table, or Job. Page layout
is canonical in `domain/model.ts`; future pagination can be added as a
projection without changing the capability boundary.

## Module responsibilities

| File | Main contents |
|---|---|
| `domain/model.ts` | `DocumentHead`, `DocumentSnapshot`, Style Registry, Row/Block model, lists, tables, visual dimensions, placement, operations, ChangeSets, attempts, and internal intents. |
| `domain/errors.ts` | Not found, revision conflict, idempotency mismatch, validation, history pruned, compensation conflict, style reference, placement, and stale-attempt errors. |
| `domain/reducer.ts` | Pure copied-state reduction, Row cleanup after final-Block removal, track maintenance, Rich Text delegation, and canonical forward operations. |
| `domain/inverses.ts` | Exact inverse operations from before/after state. Automatically created/deleted Rows are included in the inverse. |
| `domain/validation.ts` | Recursive identity uniqueness, non-empty Rows, track membership/order, style graph, Rich Text validation, list/table rules, dimensions, nesting, and configured limits. |
| `domain/canonical.ts` | Deterministic canonical JSON bytes and SHA-256 semantic digest. |
| `domain/rebase.ts` | Touched-ID calculation and disjoint stale-edit admission. |
| `application/documentService.ts` | Factory and public `command`/`query` interface. No transport or scheduler imports. |
| `application/documentService.ts` | Command/query dispatch, receipts, authored snapshot reconstruction, semantic rebase, compare-and-swap commits, compensation, prompt/Formula stage orchestration, recovery, compaction, and committed-fact construction. |
| `ports/documentStore.ts` | Project-bound head, Base, ChangeSet, receipt, identity ledger, attempt, stage, compaction, and outbox persistence. |
| `ports/derivedOutputs.ts` | Narrow interface implemented by the existing Derived Outputs runtime object. |
| `ports/formulaResolver.ts` | Narrow `buildSnapshot()` interface implemented by the existing Formula resolver adapter. |
| `persistence/sqliteDocumentStore.ts` | Opens `./data/documents.db`, hashes project ID, enables pragmas, applies owned schema, and implements the store. |
| `wire/*` | Rejects unknown fields, invalid discriminants, malformed IDs, non-finite numbers, and oversized payloads before application dispatch. |
| `projections/*` | Rebuildable plain text, outline, and external dependency lookups. |

## Dependency direction

```text
2-transport / 4-job-wiring / 1-init
                    ↓
          Document application runtime
             ├─ pure Document domain
             ├─ DocumentStore port ← SQLite adapter
             ├─ RichText runtime
             ├─ FormulaEngine
             ├─ FormulaResolver
             ├─ DerivedOutputs runtime
             ├─ InternalJobs runtime
             └─ Logger
```

Domain files are deterministic and side-effect free. Application services own
sequencing and cross-capability calls. Persistence implements only the
project-bound Document store. Job wiring owns endpoint mapping, queue choice,
response mode, and typed internal Job registration.

Document never imports Fastify, queue arrays, `JobScheduler`, SQLite from its
domain/application files, or provider SDKs. Its application layer sees only a
narrow dispatch interface from the generic Jobs utility.

## Runtime interfaces

```ts
interface DocumentCapability {
  command(request: DocumentCommandRequest): Promise<DocumentCommandResult>;
  query(request: DocumentQueryRequest): Promise<DocumentQueryResult>;

  /** Internal stage entry points used only by Job wiring. */
  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  computeFormulaEvaluation(attemptId: string): Promise<void>;
  settleFormulaEvaluation(attemptId: string): Promise<void>;
}

interface DocumentDependencies {
  richText: RichText;
  formula: FormulaEngine;
  formulaResolver: FormulaResolver;
  derivedOutputs: DocumentDerivedOutputs;
  jobs: InternalJobsRuntime<DocumentInternalJobIntent>;
  logger: Logger;
  attribution?: { actorId: string };
}

interface FormulaResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}

interface DocumentDerivedOutputs {
  declare(
    request: DeclareDerivedOutputRequest,
    options: { idempotencyKey: string },
  ): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(id: string, revision: number): Promise<DerivedOutputRevision | null>;
  updateDefinition(
    id: string,
    request: UpdateDefinitionRequest,
    options: { idempotencyKey: string },
  ): Promise<DerivedOutput>;
  refresh(
    id: string,
    options: { idempotencyKey: string },
  ): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
}
```

Document receives the constructed Derived Outputs object directly; no
transport call or Knowledge adapter is inserted between them. Its current
runtime supplies keyed declaration, keyed refresh, and keyed definition
updates. These are narrow upstream contracts rather than a Document-owned
wrapper around Derived Outputs.

The Rich Text runtime supplies Formula atoms, their edit/result operations, and
the deterministic `formulaFromDelimitedRange` authoring helper. The helper
converts a completed `{{ ... }}` range into an ordinary atomic Rich Text
operation. Document calls that API; it never parses the delimiter itself.

## Construction

```ts
interface DocumentOptions {
  history: {
    retainedBaseCount: number;
    retainedChangeSetCount: number;
    retainedTerminalAttemptCount: number;
  };
  limits: {
    maxRowsPerDocument: number;
    maxBlocksPerRow: number;
    maxStylesPerDocument: number;
    maxNestingDepth: number;
    maxAtomsPerBlockContent: number;
    maxTableRows: number;
    maxTableColumns: number;
  };
}

export function createDocumentCapability(
  store: DocumentStore,
  deps: DocumentDependencies,
  options: DocumentOptions,
): DocumentCapability;
```

```ts
// 1-init/create/document.ts
const DOCUMENT_DB_PATH = "./data/documents.db";

export function createDocumentInstance(
  config: BackendConfig,
  richText: RichText,
  formula: FormulaEngine,
  formulaResolver: FormulaNameResolver,
  derivedOutputs: DerivedOutputService,
  jobs: InternalJobsRuntime<DocumentInternalJobIntent>,
  logger: Logger,
): DocumentCapability {
  const store = new SQLiteDocumentStore(config.projectId, DOCUMENT_DB_PATH);

  return createDocumentCapability(
    store,
    {
      richText,
      formula,
      formulaResolver,
      derivedOutputs,
      jobs,
      logger,
      attribution: { actorId: config.userId },
    },
    config.document,
  );
}
```

`config.userId` supplies optional attribution only. It does not select a table,
database, Document view, or domain scope. If attribution later comes from an
authenticated request principal, the factory contract can replace this source
without changing project storage.

## Startup order

In `1-init/startBackend.ts`:

```text
config → logger → intelligence
       → context → knowledge
       → formula → structured data → formula resolver
       → rich text
       → derived outputs
       → scheduler + registry
       → internal Jobs runtime
       → document
       → Document internal Job registrations
       → document endpoints
       → HTTP transport
```

The scheduler-backed internal Jobs runtime is created before Document and has
no Document dependency. Document receives its dispatch-only face. After the
Document object exists, Job wiring registers handlers that close over it. No
Job can be dispatched during construction, and all registrations complete
before HTTP transport starts accepting work. This ordering avoids a
construction cycle while preserving one-way dependency injection.

Document starts only after its other injected runtime objects exist. It
receives no General Files or Connector dependency.

## HTTP Job wiring

```ts
export function registerDocumentEndpoints(
  registry: JobRegistry,
  document: DocumentCapability,
  logger: Logger,
): void {
  registry.register(
    { method: "POST", path: "/documents/command" },
    request => ({
      name: "documents.command.v1",
      queueType: "serial",
      responseMode: "inline",
      work: async () => {
        const input = decodeDocumentCommand(request.body);
        const result = await document.command(input);
        return {
          statusCode: statusFor(result),
          body: result,
        };
      },
    }),
  );

  registry.register(
    { method: "POST", path: "/documents/query" },
    request => ({
      name: "documents.query.v1",
      queueType: "concurrent",
      responseMode: "inline",
      work: async () => ({
        statusCode: 200,
        body: await document.query(decodeDocumentQuery(request.body)),
      }),
    }),
  );
}
```

The command result is already the public wire value. After committing an
attempt or candidate, the Document application service dispatches its next
typed internal intent through the injected Jobs runtime.

## Internal Jobs runtime and registration

`0-utils/jobs/internalRuntime.ts` adds a generic non-HTTP seam over the existing
scheduler. Its capability-facing side is dispatch-only; its wiring-facing side
registers an intent discriminator with a Job factory. Document receives only:

```ts
interface InternalJobsRuntime<TIntent extends { type: string }> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}
```

`registerDocumentInternalJobs.ts` owns the mapping from Document intent to
fresh Job:

```text
document.compact           → serial Job
prompt.create.compute    → concurrent Job
prompt.create.settle     → serial Job
prompt.refresh.compute   → concurrent Job
prompt.refresh.settle    → serial Job
formula.evaluate.compute → concurrent Job
formula.evaluate.settle  → serial Job
```

Each Job calls the corresponding internal Document method. The method persists
its candidate or settlement before it returns; after a candidate commit it
uses the same injected runtime to dispatch the next serial intent. Stage
receipts make every handler safely retryable.

`dispatch()` returns when a Job is admitted to a queue, not when its work
finishes. `JobScheduler.admit()` separates queue admission from the completion
promise. Queue-capacity failure is reported to Document immediately; the
durable attempt remains `requested` or `proposed`, an in-process capped-backoff
redrive resubmits it with the same idempotency key, and startup recovery covers
process interruption. Each stage action also has a small bounded retry window;
only persistent exhaustion becomes a terminal attempt failure.

The runtime is not an endpoint registry and its intents are not Activity. It
exists solely to switch queues without making Document application code depend
on scheduler mechanics. Document describes the work to continue; Job wiring
continues to own queue choice, response mode, Job IDs, and work closures.

## Error mapping

Job wiring maps typed errors consistently:

```text
DocumentNotFoundError       → 404 not_found
RevisionConflictError       → 409 revision_conflict
IdempotencyMismatchError    → 409 idempotency_mismatch
CompensationConflictError   → 409 compensation_conflict
HistoryPrunedError          → 410 history_pruned
DocumentValidationError     → 400 validation_error
DocumentPlacementError      → 400 invalid_placement
DocumentStyleReferenceError → 400 invalid_style
```

Unexpected errors are logged with safe metadata and mapped to 500. Document
bodies, Rich Content, prompt text, stabilization text, and Formula source are
not generically logged.

## Rebuildable projections

Initial projections are deliberately modest:

| Projection | What it provides |
|---|---|
| Plain text | Search/export input from Text, Quote, Code, list, and table content. |
| Outline | Text Blocks whose selected Style has protected role `heading-1` through `heading-6`; the role supplies the level. |
| Prompt references | Blocks grouped by Derived Output ID and applied revision. |
| Formula references | Formula atom IDs and expression digests. |

Future pagination, rendered geometry, page count, thumbnails, and source
publication adapters can be added without becoming canonical authority.

## Future Activity wiring

The initial Document capability writes accepted facts to its own transactional
outbox and stops there. A future Activity integration adds two generic wiring
pieces without creating an Activity/Document constructor cycle:

1. An outbox publisher Job reads unpublished Document facts and submits them to
   an Activity ingestion port. This direction is Document facts → Activity.
2. An Activity undo endpoint resolves the selected item's owner address and
   asks an integration-owned `CompensationRouter` to dispatch to the registered
   owner handler. The Document handler issues `document.compensate`; other
   capabilities register their own handlers.

Activity therefore never imports or receives Document, and Document never
imports or receives Activity. Only integration wiring knows both contracts.
