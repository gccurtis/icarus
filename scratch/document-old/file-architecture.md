# Document capability — file architecture

## Placement

Document is a project-scoped capability. `createDocumentCapability` receives an
already-scoped store; none of the files below place a project or user ID in a
Document domain value or request DTO.

```text
apps/backend/src/
  3-capabilities/
    document/
      domain/
        snapshot.ts
        content.ts
        styles.ts
        prompt.ts
        formulaItems.ts
        operations.ts
        reducer.ts
        inverses.ts
        textRanges.ts
        validation.ts
        canonical.ts
        errors.ts
      application/
        capability.ts
        commands.ts
        queries.ts
        callLogging.ts
        create.ts
        admission.ts
        history.ts
        compensation.ts
        promptRefresh.ts
        formulaEvaluation.ts
        sourceSnapshot.ts
        activityContributions.ts
      ports/
        documentStore.ts
      persistence/
        migrations/
          001-document.ts
        sqliteDocumentStore.ts
        sqliteMappers.ts
      indexes/
        summaries.ts
        outline.ts
        searchText.ts
        promptDependencies.ts
        formulaDependencies.ts
      index.ts

  1-init/create/
    document.ts

  4-job-wiring/
    document/
      registerDocumentEndpoints.ts
      createDocumentJobs.ts
      documentJobPayloads.ts
```

Formula lives under `0-platform/formula/` as described by the
[Formula design](../formula-design.md). Document receives its public `Formula`
interface after Formula has already been constructed with Name Manager,
configuration, and Logger. Document imports Formula value, wire, expression,
and diagnostic types; it does not assemble name environments.

## Module responsibilities

| File | Main contents / functions |
| --- | --- |
| `domain/snapshot.ts` | `DocumentHead`, `DocumentSnapshot`, global `DocumentPageLayout`, Base/ChangeSet types. |
| `domain/content.ts` | `DocumentRow`, Row tracks, closed Block union, inline content, lists, tables, media, references. |
| `domain/styles.ts` | style registry types, style inheritance validation, range-style normalization. |
| `domain/prompt.ts` | `PromptDefinition`, Document-owned `{ id, kind }` context values, Knowledge scope/grounding results, and patch types. |
| `domain/formulaItems.ts` | `FormulaItem`, exact evaluation snapshots, Formula type imports, item validation. |
| `domain/operations.ts` | closed `DocumentOperation` union and operation DTO validators. |
| `domain/reducer.ts` | `applyOperations(snapshot, operations)`, row/block/inline traversal, touched-ID calculation. |
| `domain/inverses.ts` | `invertOperations(before, operations, after)`; produces compensation operations from exact state. |
| `domain/textRanges.ts` | selection normalization, `validateTextRange`, splice/split/join endpoint transforms. |
| `domain/validation.ts` | `validateSnapshot`, row-track/list/table/style/invariant validation, limits. |
| `domain/canonical.ts` | canonical JSON encoding, `digestSnapshot`, normalization entry point. |
| `application/capability.ts` | `createDocumentCapability(store, dependencies, options)` and its `command`/`query` dispatch surface. |
| `application/commands.ts` | command digest/receipt idempotency and dispatch of the closed `DocumentCommand` union to separate serial handlers. |
| `application/queries.ts` | dispatches the closed `DocumentQuery` union to bounded concurrent read handlers. |
| `application/callLogging.ts` | wraps every public call and internal stage with structured start/terminal logging. |
| `application/create.ts` | create, duplicate, ID remapping, and Activity contribution drafts. |
| `application/admission.ts` | submit CAS, idempotency, retained-history semantic rebase, load/replay, reducer invocation, ChangeSet append. |
| `application/history.ts` | exact retained-revision load, ChangeSet listing, Base compaction. |
| `application/compensation.ts` | Activity-requested compensation using stored inverse operations and current-head validation. |
| `application/promptRefresh.ts` | request/freeze, scoped Knowledge retrieval, Intelligence resolution, protected-token/minimal-patch planning, stale settlement/recovery. |
| `application/formulaEvaluation.ts` | Formula calls inside a concurrent job, display-text derivation, frozen result admission, mark transforms, and serial settlement. |
| `application/sourceSnapshot.ts` | immutable native-resource package for Sources and Import/Export handoff. |
| `application/activityContributions.ts` | prepares durable activity-outbox contributions; it does not choose global undo/redo order. |
| `ports/documentStore.ts` | scoped transaction port, Base/ChangeSet/attempt/outbox repository contracts. |
| `persistence/*` | Document-owned SQLite schema and scoped-store implementation. |
| `indexes/*` | rebuildable backend summaries, search data, and dependency indexes; never canonical state. |

## Dependency direction

```text
transport / jobs / initialization
              ↓
        application services
          ├─ domain logic
          ├─ DocumentStore ── persistence
          ├─ scoped Knowledge
          ├─ platform Intelligence
          ├─ platform Formula
          └─ platform Logger
```

Domain files are pure and deterministic. They neither query SQLite nor call
Knowledge, Formula, or a model. Application services own sequencing,
idempotency, and the short transactions that admit changes. Persistence only
implements the scoped `DocumentStore` contract. Job wiring only maps endpoints
to queues and invokes application services. The logger wraps application
boundaries and is never passed into domain functions.

## Construction and job wiring

```ts
interface DocumentDependencies {
  knowledge: Knowledge;
  intelligence: Intelligence;
  formula: Formula;
  logger: Logger;
}

// 1-init/create/document.ts
export function createProjectDocumentCapability(
  projectId: string,
  db: Database,
  dependencies: DocumentDependencies,
  options: DocumentOptions,
) {
  const store = resolveDocumentStore(projectId, db);
  return createDocumentCapability(store, dependencies, options);
}
```

`projectId` is consumed while constructing the scoped store. It does not cross
into the returned capability.

`4-job-wiring/document/createDocumentJobs.ts` creates handlers for:

- serial `documents.command.v1` and concurrent `documents.query.v1`;
- Document Base compaction;
- Prompt refresh resolution and settlement;
- Formula evaluation and settlement.

Endpoint mapping belongs in `registerDocumentEndpoints.ts`, following the
existing capability convention. It registers `POST
/documents/command` and `POST /documents/query`, resolves the project runtime,
then calls the already-constructed Document capability. Domain and application
files do not know HTTP, queue names, or request envelopes.
