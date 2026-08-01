# Spreadsheet capability — file architecture

## Placement and removal boundary

Spreadsheet is a regular, project-scoped capability. Its implementation is
self-contained under `3-capabilities/spreadsheet/`, with one concrete factory,
one Job-wiring directory, and composition in `1-init/startBackend.ts`.

The store is bound to `config.projectId` during construction. Project and user
scope never enter a Workbook domain value, command/query DTO, or store method.
Actor attribution is optional fact metadata only.

```text
apps/backend/src/
  3-capabilities/
    spreadsheet/
      application/
        createService.ts             # deterministic revision-zero Workbook
        spreadsheetService.ts        # command/query admission and durable stages
      domain/
        calculation.ts               # pure dependency planning and local bindings
        canonical.ts                 # canonical bytes and semantic digest
        errors.ts                    # typed domain/application errors
        grid.ts                      # ordered-axis coordinate and span lookup
        identities.ts                # permanent identity transitions
        inverses.ts                  # exact compensation operations
        model.ts                     # canonical, operation, history, attempt, intent types
        projection.ts                # pure structured range projection
        rebase.ts                    # touched-ID semantic rebase
        reducer.ts                   # pure normalized operation application
        validation.ts                # aggregate and operation invariants/limits
      persistence/
        sqliteMappers.ts             # validated canonical JSON ↔ domain mapping
        sqliteSchema.ts              # project-hashed table names and DDL
        sqliteSpreadsheetStore.ts    # SQLite SpreadsheetStore adapter
      ports/
        derivedOutputs.ts            # narrow exact-revision Prompt operations
        formulaResolver.ts           # immutable project Formula snapshot reader
        spreadsheetStore.ts          # project-bound persistence contract
      projections/
        dependencies.ts              # Cell/range, Formula, Data, and Prompt refs
        grid.ts                      # bounded viewport and coordinate projection
        plainText.ts                 # text/search projection
        styling.ts                   # effective cell/rule style projection
      wire/
        commandSchemas.ts            # strict public command decoding
        operationSchemas.ts          # strict operation decoding
        querySchemas.ts              # strict public query decoding
        valueSchemas.ts              # shared bounded value decoders
      docs/
        README.md
        concepts.md
        flows.md
        invariants.md
        runtime.md
        types.md
      index.ts

  1-init/
    create/
      spreadsheet.ts                 # concrete project-scoped construction
    startBackend.ts                  # existing composition root

  4-job-wiring/
    spreadsheet/
      createSpreadsheetJobs.ts       # public command/query Job definitions
      registerSpreadsheetEndpoints.ts
      registerSpreadsheetInternalJobs.ts
      spreadsheetJobPayloads.ts      # strict transport payload helpers
```

This mirrors the established Document and Slide capability shape. It avoids a
second service hierarchy, capability-specific scheduler, repository-wide path
alias, migration framework, or global Spreadsheet configuration surface.

## Module responsibilities

| File | Main responsibility |
|---|---|
| `domain/model.ts` | Defines Workbook heads/snapshots, embedded Theme/tokens and reusable Cell Styles, stable Sheets/axes/Cells/spans, ordered range Format Regions, the closed `CellContent` union and exact computed settlements, the closed RichContent target union, validation/rules/typed overlays, operations, ChangeSets/Bases/receipts, identity transitions, durable attempts/stages, committed facts, internal intents, limits, and options. |
| `domain/grid.ts` | Resolves `rowOrder`/`columnOrder` stable identities, enforces sparse occupancy, and validates rectangular contiguous non-overlapping spans. A1 labels are derived display addresses only. |
| `domain/projection.ts` | Projects structured accepted values from an anchor Cell and returns deterministic blocked/ready diagnostics. Projected coordinates never become hidden canonical Cells. |
| `domain/calculation.ts` | Builds a dependency graph from a frozen Workbook, records stable Cell/range and project-binding-ID manifests from normalized `spreadsheet-formula/v1` bindings, detects cycles, produces a deterministic plan, and composes frozen Workbook-local bindings with an immutable project Formula snapshot. It performs no I/O. |
| `domain/reducer.ts` | Applies canonical operations and emits normalized forward operations, exact inverses, touched IDs, and semantic digest. It does not call Formula or other capabilities. |
| `domain/inverses.ts` | Produces exact compensation from before/after state, including deleted Sheet/axis/Cell subtrees, merge coverage, Format Regions, rules, and overlay state. |
| `domain/identities.ts` | Claims, tombstones, and narrowly reactivates Workbook-owned stable identities. Ordinary commands cannot reuse tombstones. |
| `domain/rebase.ts` | Replays the authored revision, compares touched identities with intervening ChangeSets, and permits only disjoint semantic rebase. |
| `domain/validation.ts` | Enforces identity/order/span/projection/content invariants; typed token refs, one protected Normal Style, acyclic Style inheritance, and Style/Format-Region/rule/overlay validity; `spreadsheet-formula/v1`, ordinary Formula/v1, and closed RichContent target validity; dedicated Prompt output ownership; immutable Data/Prompt/File references; and configured size/depth/byte limits. |
| `domain/canonical.ts` | Produces deterministic canonical JSON and SHA-256 semantic digests. Operational timestamps, attempts, retry state, and outbox publication do not affect Workbook semantics. |
| `application/createService.ts` | Creates the initial Workbook with stable caller-provided identities, one default Sheet/axes, a revision-zero Base, receipt, identity claims, and creation fact in one transaction. |
| `application/spreadsheetService.ts` | Exposes command/query, reconstructs historical snapshots, performs idempotency/CAS/rebase/compensation, orchestrates Prompt/Data/Formula stages, dispatches internal intents after durable commit, recovers attempts, and performs head-guarded compaction. |
| `ports/spreadsheetStore.ts` | Defines head/Base/ChangeSet/receipt, identity, attempt/stage, Prompt ownership, compaction, and accepted-fact outbox persistence. |
| `ports/derivedOutputs.ts` | Exposes only keyed declaration, refresh, definition update, and exact output/revision reads. It exposes no deletion authority or persistence implementation. |
| `ports/formulaResolver.ts` | Exposes only `buildSnapshot()`, returning the immutable project Formula resolver view. Data attach/refresh selects a binding by stable binding ID from this snapshot; Spreadsheet never imports Structured Data. |
| `persistence/sqliteSchema.ts` | Owns trusted project-hashed names and Workbook/Base/ChangeSet/receipt/identity/attempt/stage/Prompt-ownership/outbox DDL. |
| `persistence/sqliteSpreadsheetStore.ts` | Opens `./data/spreadsheets.db`, enables pragmas, executes CAS transactions, replays retained history, and prunes only through a head-guarded compaction commit. |
| `wire/*` | Rejects unknown fields/discriminants, cyclic or non-JSON input, non-finite numbers, malformed stable refs/Formula/RichContent, and excessive counts/depth/bytes before application admission. |
| `projections/*` | Builds deterministic, discardable reads from one immutable Workbook revision. No projection becomes an alternative write authority. |
| `index.ts` | Exports the public runtime, domain contracts/errors, pure helpers, store adapter/port, wire decoders, and projections. Internal SQL helpers remain private. |

## Dependency direction

```text
2-transport / 4-job-wiring / 1-init
                    |
                    v
       Spreadsheet application runtime
          |        |        |        |
          |        |        |        +--> injected Logger
          |        |        +-----------> injected InternalJobsRuntime
          |        +--------------------> narrow Derived Outputs port
          +-----------------------------> injected Formula engine
          |
          +------------------------------> narrow FormulaResolver port
          +------------------------------> SpreadsheetStore port
          |                                      ^
          v                                      |
       pure Spreadsheet domain              SQLite adapter
          |
          +------------------------------> injected Rich Text interface
```

The dependency laws are:

- Domain code is pure and deterministic. It never imports SQLite, transport,
  the scheduler, Derived Outputs implementation, Structured Data, Activity, a
  model provider, or frontend rendering code.
- Application code sequences pure functions and injected ports. It owns retry
  and crash boundaries but does not choose queue types or parse HTTP bodies.
- Persistence implements only the Spreadsheet-owned store contract.
- Job wiring maps endpoint/internal intents to queues and status codes. It does
  not perform reduction or SQL.
- Initialization is the only place that chooses the database path, binds
  project scope, adapts shared runtimes, and supplies actor attribution.
- Spreadsheet receives Formula's project name-resolution view through a narrow
  immutable resolver port. It never reaches through Formula to Structured Data.
- Spreadsheet owns grid semantics, dependency planning, accepted results, and
  exact revision adoption. Formula owns parsing/evaluation and Rich Text owns
  RichContent operations, marks, references, and FormulaAtoms.

Within `spreadsheet/`, relative imports keep the capability self-contained.
Outside it, existing generic aliases are sufficient:

```ts
import { createSpreadsheetInstance } from "#init/create/spreadsheet.js";
import { registerSpreadsheetEndpoints } from "#job-wiring/spreadsheet/registerSpreadsheetEndpoints.js";
import type { SpreadsheetInternalJobIntent } from "#capabilities/spreadsheet/index.js";
```

No `#spreadsheet` TypeScript/package alias is required.

## Runtime contracts

```ts
interface SpreadsheetDependencies {
  richText: RichText;
  formula: FormulaEngine;
  formulaResolver: SpreadsheetFormulaResolver;
  derivedOutputs: SpreadsheetDerivedOutputs;
  jobs: InternalJobsRuntime<SpreadsheetInternalJobIntent>;
  logger: Logger;
  attribution?: { actorId: string };
}

interface SpreadsheetCapability {
  command(request: SpreadsheetCommandRequest): Promise<SpreadsheetCommandResult>;
  query(request: SpreadsheetQueryRequest): Promise<SpreadsheetQueryResult>;

  computeCalculation(attemptId: string): Promise<void>;
  settleCalculation(attemptId: string): Promise<void>;
  computeRichFormulaEvaluation(attemptId: string): Promise<void>;
  settleRichFormulaEvaluation(attemptId: string): Promise<void>;

  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  computeDataCellAttach(attemptId: string): Promise<void>;
  settleDataCellAttach(attemptId: string): Promise<void>;
  computeDataCellRefresh(attemptId: string): Promise<void>;
  settleDataCellRefresh(attemptId: string): Promise<void>;

  recoverPendingAttempts(): Promise<number>;
  compact(workbookId: WorkbookId): Promise<boolean>;
}

interface SpreadsheetFormulaResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}

function createSpreadsheetCapability(
  store: SpreadsheetStore,
  dependencies: SpreadsheetDependencies,
  options: SpreadsheetOptions = DEFAULT_SPREADSHEET_OPTIONS,
): SpreadsheetCapability;
```

Formula is required for whole-Cell Formula source and FormulaAtoms embedded in
RichContent. The resolver supplies project bindings for both Formula evaluation
and direct Data Cell attach/refresh. Derived Outputs supplies one dedicated
output per Prompt Content Cell. There is no concrete Structured Data,
General Files, Activity, renderer, or export constructor dependency.

## Concrete construction

```ts
// 1-init/create/spreadsheet.ts
const SPREADSHEET_DB_PATH = "./data/spreadsheets.db";

export const createSpreadsheetInstance = (
  config: BackendConfig,
  richText: RichText,
  formula: FormulaEngine,
  formulaResolver: FormulaNameResolver,
  derivedOutputs: SpreadsheetDerivedOutputs,
  jobs: InternalJobsRuntime<SpreadsheetInternalJobIntent>,
  logger: Logger,
): SpreadsheetCapability => {
  const store = new SQLiteSpreadsheetStore(
    config.projectId,
    SPREADSHEET_DB_PATH,
  );

  return createSpreadsheetCapability(store, {
    richText,
    formula,
    formulaResolver,
    derivedOutputs,
    jobs,
    logger,
    attribution: { actorId: config.userId },
  }, DEFAULT_SPREADSHEET_OPTIONS);
};
```

`SpreadsheetOptions` owns local history/terminal-attempt retention and bounded
limits for Sheets, sparse Cells, axes, spans, projections, Formula source,
RichContent, styles, rules, and overlays. Defaults are an immutable exported
value. They do not require additions to global backend configuration.

## Public endpoint wiring

`registerSpreadsheetEndpoints.ts` owns exactly two mappings:

| Method and path | Job name | Queue | Response mode |
|---|---|---|---|
| `POST /spreadsheets/command` | `spreadsheets.command.v1` | serial | inline |
| `POST /spreadsheets/query` | `spreadsheets.query.v1` | concurrent | inline |

The command Job decodes the body before calling `spreadsheet.command`.
Creation returns `201`; durable Formula, Prompt, and Data attempt admission
returns `202`; ordinary accepted commands return `200`. Query returns `200`.

Typed failures map consistently with Document and Slide:

| Status | Error families |
|---|---|
| `400` | wire, validation, Formula source/binding, RichContent, stable coordinate, span, projection, operation, identity-reuse, and stale-attempt errors |
| `404` | missing Workbook/Sheet/axis/Cell/attempt, unavailable exact Prompt output, or missing project binding |
| `409` | Workbook already exists, revision conflict, idempotency mismatch, compensation conflict, span overlap, projection blocked, or external definition conflict |
| `410` | requested revision or retained compensation target has been pruned |
| `500` | unexpected failures; response is generic and shared logging records safe diagnostics |

Handlers never expose SQL messages, provider bodies, Prompt text, Formula
binding values, or internal stack traces.

## Internal Jobs and durable workflows

`registerSpreadsheetInternalJobs.ts` registers the closed intent vocabulary on
one `SchedulerInternalJobsRuntime<SpreadsheetInternalJobIntent>`:

| Intent | Queue | Capability method |
|---|---|---|
| `spreadsheet.compact` | serial | `compact(workbookId)` |
| `spreadsheet.calculation.compute` | concurrent | `computeCalculation(attemptId)` |
| `spreadsheet.calculation.settle` | serial | `settleCalculation(attemptId)` |
| `spreadsheet.rich-formula.evaluate.compute` | concurrent | `computeRichFormulaEvaluation(attemptId)` |
| `spreadsheet.rich-formula.evaluate.settle` | serial | `settleRichFormulaEvaluation(attemptId)` |
| `spreadsheet.prompt-content.create.compute` | concurrent | `computePromptCreation(attemptId)` |
| `spreadsheet.prompt-content.create.settle` | serial | `settlePromptCreation(attemptId)` |
| `spreadsheet.prompt-content.refresh.compute` | concurrent | `computePromptRefresh(attemptId)` |
| `spreadsheet.prompt-content.refresh.settle` | serial | `settlePromptRefresh(attemptId)` |
| `spreadsheet.data.attach.compute` | concurrent | `computeDataCellAttach(attemptId)` |
| `spreadsheet.data.attach.settle` | serial | `settleDataCellAttach(attemptId)` |
| `spreadsheet.data.refresh.compute` | concurrent | `computeDataCellRefresh(attemptId)` |
| `spreadsheet.data.refresh.settle` | serial | `settleDataCellRefresh(attemptId)` |

Every intent carries a caller-namespaced stable idempotency key. Dispatch
returns after scheduler admission. Durable attempt/stage state remains the
authority if the process stops. Queue-capacity failures receive bounded
in-process redrive; persistent workflow failure is recorded on the attempt.

### Grid calculation

Serial admission freezes the exact Workbook revision, normalized
`spreadsheet-formula/v1`
source, content fingerprints, stable Cell/range manifests, and stable project
binding IDs. Concurrent compute builds one project resolver snapshot, resolves
project dependencies by `binding.reference.bindingId` without falling back to
a display name, composes frozen Workbook-local
bindings, creates a deterministic dependency plan, evaluates independent
components, and durably proposes bounded settlement operations. Serial settle
rechecks each source/dependency fingerprint and adopts only candidates that are
still valid through one ordinary ChangeSet. Partial staleness does not permit a
candidate to overwrite newer authoring.

The resolver snapshot used to admit symbolic names is retained only as
operational receipt/attempt evidence. Canonical Formula source identity depends
on the captured stable binding IDs, not on a whole-project resolver digest;
accepted settlement records the evaluation resolver digest separately.

A whole-Cell formula may bind a Prompt Content Cell. In that case compute uses
the frozen exact `outputId@appliedRevision`; the candidate dependency identity
records that exact ref and the local Cell content fingerprint guards settlement.
Calculation never substitutes the Derived Output's current head.

A grid binding to RichContent uses its deterministic plain-text projection from
the same frozen Workbook revision. The candidate retains the full content
fingerprint and projected-value digest, so retry or settlement cannot observe a
later RichContent value.

Automatic mode creates calculation attempts atomically with an accepted source
mutation. Manual mode creates the same attempt through an explicit command.
There is one calculation engine and one settlement path.

### RichContent FormulaAtoms

An accepted RichContent edit that introduces a FormulaAtom or changes its
expression creates a per-atom attempt in the same transaction as its ChangeSet.
The attempt persists the complete closed locator plus atom identity:

```ts
type SpreadsheetRichContentTarget =
  | { kind: "cell-content"; sheetId: SheetId; cellId: CellId }
  | { kind: "validation-message"; sheetId: SheetId; cellId: CellId }
  | { kind: "validation-list-option"; sheetId: SheetId; cellId: CellId; optionId: string }
  | { kind: "chart-title"; sheetId: SheetId; overlayId: SheetOverlayId }
  | { kind: "chart-axis-title"; sheetId: SheetId; overlayId: SheetOverlayId; axis: "category" | "value" }
  | { kind: "chart-series-name"; sheetId: SheetId; overlayId: SheetOverlayId; seriesId: string };
```

Compute evaluates the frozen expression against one immutable project resolver
snapshot. Settlement reloads the exact target/atom and uses Rich Text's Formula
settlement operation only if the expression digest still matches. RichContent
FormulaAtoms retain ordinary Formula/v1 semantics: they receive project
bindings only and cannot use A1, range, or sheet-qualified grid references.
Spreadsheet does not parse `{{ ... }}` itself; Rich Text owns the
delimiter-to-FormulaAtom operation.

### Prompt Content

A Prompt Content Cell cannot be introduced by a generic Cell operation and
cannot attach a caller-supplied output. Its creation command may target a new or
existing Cell; it freezes the exact target/precondition and definition, then
concurrent compute declares and initially refreshes one fresh dedicated Derived
Output. Serial settlement creates/replaces the content with the exact output ref
and changes local ownership from pending to attached in the same transaction.
When replacing existing Prompt Content, its attached output remains attached
while the one new candidate is pending. Settlement atomically makes the old row
historical and promotes the candidate; stale/failure handling makes only the
candidate historical and preserves the existing attachment.

Refresh freezes output identity and applied revision, computes through Derived
Outputs, and conditionally adopts the exact newer revision.
Definition/stabilization updates first persist a delegated-command claim, call
Derived Outputs with the claim's stable idempotency key, and atomically retain
the completed receipt. They append no Workbook ChangeSet because canonical
Workbook state did not change. Replacing Prompt Content or deleting its
Cell/axis/Sheet marks ownership historical; Spreadsheet never deletes the
output.

### Direct Data Cells

Data attach/refresh also use compute/settle because the resolver snapshot is
external to Workbook persistence. Attach freezes the selected stable binding
ID and exact target/precondition. Compute selects exactly one binding from an immutable
project Formula snapshot and persists its owner revision, value digest, and
exact Formula-wire-serializable non-function candidate value. A scalar has no
orientation and does not spill; a table, record, or list requires an orientation
and produces a rebuildable, noncanonical range projection. Settle creates or
replaces the Data Cell content and exact settlement only if the target remains
valid. Refresh
freezes the existing reference and conditionally adopts a newer exact binding
revision.

Spreadsheet never calls Structured Data directly for these reads. A historical
Workbook displays its embedded accepted value; it never follows a binding to
“latest” during load.

## Startup and recovery

After Formula, the shared project Formula resolver, Rich Text, Derived Outputs,
scheduler, and registry have been constructed, `startBackend.ts` adds:

```ts
const spreadsheetJobs =
  new SchedulerInternalJobsRuntime<SpreadsheetInternalJobIntent>(scheduler);

const spreadsheet = createSpreadsheetInstance(
  config,
  richText,
  formula,
  formulaResolver,
  derivedOutputs,
  spreadsheetJobs,
  logger,
);

registerSpreadsheetInternalJobs(spreadsheetJobs, spreadsheet);
registerSpreadsheetEndpoints(registry, spreadsheet, logger);

const recoveredSpreadsheetAttempts = await spreadsheet.recoverPendingAttempts();
logger.info("spreadsheet.attempts.recovered", {
  count: recoveredSpreadsheetAttempts,
});
```

The readiness log adds `spreadsheetReady`. Recovery runs after internal intent
factories and endpoint mappings are registered and before the HTTP listener
binds. It makes interrupted running stages retryable, lists non-terminal
attempts, and redispatches compute or settle according to durable state.

This order avoids a capability/scheduler construction cycle: the dispatch-only
Jobs runtime exists before Spreadsheet; factories that call Spreadsheet are
registered immediately after Spreadsheet construction.

## Rebuildable projections

| Projection | Frozen key | Purpose |
|---|---|---|
| viewport grid | Workbook revision + Sheet + stable rectangle | sparse Cells, merged coverage, and projected values |
| coordinate lookup | Workbook revision + Sheet | stable axis intersection → empty/Cell/projected target |
| dependency graph | Workbook revision | Formula Cell/atom dependencies and cycles |
| calculation plan | Workbook revision + resolver digest | deterministic evaluation components/order |
| range projection | Workbook revision + anchor Cell | structured accepted value extent/status |
| effective style | Workbook revision + coordinate | Theme/Normal → Sheet → Column → Row → Format Regions → Cell → conditional rules |
| external dependencies | Workbook revision | exact Data, Prompt, and immutable File refs |

These may be cached by revision but are always discardable. Spreadsheet
persists no viewport cache, dependency-index authority, rendered Chart, image
thumbnail, or calculated duplicate Cell table.

## Permanent backend boundary

Spreadsheet owns the semantic facts required to describe and calculate a
Workbook: stable axes and ordering, sparse Cell occupancy, merged spans, exact
Cell content/settlements, Formula dependency manifests, structured projection
semantics, embedded Theme/tokens and reusable Styles, ordered Format Regions,
rule/overlay definitions, and revision history.

The following are permanently outside the Spreadsheet backend capability:

- grid painting, canvas/DOM layout, pixels, DPI, and viewport virtualization;
- font shaping, glyph measurement, row auto-fit pixel measurement, and text
  clipping/wrapping layout;
- hit testing, selection handles, drag/fill interaction, edit cursors, and
  formula-autocomplete UI;
- Chart, Image, and sparkline rasterization, thumbnails, render caches, and
  renderer artifact persistence; and
- Activity feeds, Presence, realtime cursors, and collaboration transport.

Frontend or export integrations consume immutable semantic projections. Their
rendering artifacts do not become Workbook state.

Spreadsheet also does not own Formula's language/evaluator, Rich Text's content
algebra, project named-value storage, Derived Output definitions/revisions, or
General Files bytes. It owns only exact references and accepted/adopted values.

## Explicitly blocked or deferred integrations

The initial capability contains no placeholder services for authority it does
not have:

- `data.promote` is blocked until Structured Data exposes keyed idempotent
  declaration (or caller-supplied stable IDs). Its current unkeyed declaration
  cannot be made crash-safe across the two SQLite files.
- XLSX/CSV import, export, and format-loss policies belong to explicit adapter
  integrations. They may emit or consume public Spreadsheet commands.
- server-side Chart/Image rendering and document embedding belong to renderer
  or composition integrations, not this capability.
- external-data subscriptions and automatic freshness triggers may dispatch
  existing Data refresh/calculation commands later; they do not change the
  canonical model.
- Activity publication and undo routing are integration wiring. Spreadsheet
  already writes accepted facts to its own transactional outbox.
- Comments, Presence, and realtime multi-user editing require separate
  capability decisions.

## Removal instructions

The capability remains easy to remove:

1. Delete `apps/backend/src/3-capabilities/spreadsheet/`.
2. Delete `apps/backend/src/4-job-wiring/spreadsheet/`.
3. Delete `apps/backend/src/1-init/create/spreadsheet.ts`.
4. Delete Spreadsheet-specific tests.
5. Revert only the Spreadsheet imports, Jobs runtime construction, capability
   construction, registrations, recovery call, and readiness field in
   `apps/backend/src/1-init/startBackend.ts`.
6. Delete `./data/spreadsheets.db` only when its persisted Workbooks are
   intentionally being discarded; otherwise retain it as recoverable data.

No Spreadsheet-specific edit is required in Formula, Rich Text, Derived
Outputs, Structured Data, the shared scheduler, TypeScript aliases, package
imports, or global configuration. If keyed Structured Data declaration is
added later for `data.promote`, that enhancement is independently removable.
