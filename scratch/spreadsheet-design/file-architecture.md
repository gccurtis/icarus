# Spreadsheet capability — operations

## Operation vocabulary

Every operation is reversible. The reducer produces exact inverse operations
from before/after state.

```ts
type SpreadsheetOperation =
  // ── Workbook metadata ────────────────────────────────────────────────
  | { type: "workbook.rename"; title: string }
  | { type: "workbook.set-lifecycle"; lifecycle: "active" | "archived" | "trashed" }
  | { type: "workbook.set-metadata"; metadata: WorkbookMetadata }
  | { type: "workbook.set-calculation"; calculation: CalculationSettings }

  // ── Sheets ───────────────────────────────────────────────────────────
  | { type: "sheet.insert"; sheet: SpreadsheetSheet; afterSheetId?: string }
  | { type: "sheet.move"; sheetId: SheetId; afterSheetId?: string }
  | { type: "sheet.delete"; sheetId: SheetId }
  | { type: "sheet.rename"; sheetId: SheetId; title: string }
  | { type: "sheet.set-freeze"; sheetId: SheetId; freeze: FreezeState }
  | { type: "sheet.set-defaults"; sheetId: SheetId; defaults: SheetDefaults }

  // ── Axes (rows and columns) ──────────────────────────────────────────
  | { type: "row.insert"; sheetId: SheetId; row: SheetRow; afterRowId?: string }
  | { type: "row.move"; sheetId: SheetId; rowId: RowId; afterRowId?: string }
  | { type: "row.delete"; sheetId: SheetId; rowId: RowId }
  | { type: "row.resize"; sheetId: SheetId; rowId: RowId; height?: number }
  | { type: "row.set-hidden"; sheetId: SheetId; rowId: RowId; hidden: boolean }
  | { type: "column.insert"; sheetId: SheetId; column: SheetColumn; afterColumnId?: string }
  | { type: "column.move"; sheetId: SheetId; columnId: ColumnId; afterColumnId?: string }
  | { type: "column.delete"; sheetId: SheetId; columnId: ColumnId }
  | { type: "column.resize"; sheetId: SheetId; columnId: ColumnId; width?: number }
  | { type: "column.set-hidden"; sheetId: SheetId; columnId: ColumnId; hidden: boolean }

  // ── Cells ────────────────────────────────────────────────────────────
  | { type: "cell.create"; sheetId: SheetId; cell: SpreadsheetCell }
  | { type: "cell.delete"; sheetId: SheetId; cellId: CellId }
  | { type: "cell.set-source"; sheetId: SheetId; cellId: CellId; source: CellSource }
  | { type: "cell.set-style"; sheetId: SheetId; cellId: CellId; style: CellStyle }
  | { type: "cell.set-validation"; sheetId: SheetId; cellId: CellId; validation?: CellValidation }

  // ── Rich text (text-valued cells) ────────────────────────────────────
  | { type: "rich-text.apply"; sheetId: SheetId; cellId: CellId; operations: RichTextOperation[] }

  // ── Merge / unmerge ──────────────────────────────────────────────────
  | { type: "cell.merge"; sheetId: SheetId; cellId: CellId; span: CellSpan; coveredCellPolicy: "require-empty" | "discard" | "preserve-as-reference" }
  | { type: "cell.unmerge"; sheetId: SheetId; cellId: CellId }

  // ── Accepted content (calculation settlement) ────────────────────────
  | { type: "cell.accept-content"; sheetId: SheetId; cellId: CellId; accepted: AcceptedCellContent; expectedSource: CellSourceFingerprint }
  | { type: "cell.accept-error"; sheetId: SheetId; cellId: CellId; error: CellError; expectedSource: CellSourceFingerprint }

  // ── Derived Output ──────────────────────────────────────────────────
  | { type: "derived-output.set"; sheetId: SheetId; cellId: CellId; output: DerivedOutputRef }
  | { type: "derived-output.apply"; sheetId: SheetId; cellId: CellId; output: DerivedOutputRef; accepted: AcceptedCellContent }

  // ── Projection management ────────────────────────────────────────────
  | { type: "projection.materialize"; sheetId: SheetId; anchorCellId: CellId; cells: SpreadsheetCell[] }

  // ── Sheet rules ──────────────────────────────────────────────────────
  | { type: "rule.create"; sheetId: SheetId; rule: SheetRule }
  | { type: "rule.update"; sheetId: SheetId; ruleId: string; rule: SheetRule }
  | { type: "rule.delete"; sheetId: SheetId; ruleId: string }

  // ── Overlays ─────────────────────────────────────────────────────────
  | { type: "overlay.create"; sheetId: SheetId; overlay: SheetOverlay }
  | { type: "overlay.update"; sheetId: SheetId; overlayId: string; overlay: SheetOverlay }
  | { type: "overlay.delete"; sheetId: SheetId; overlayId: string };

type CellSourceFingerprint = {
  kind: CellSource["kind"];
  digest: string;   // hash of the source content at the time evaluation was requested
};
```

### Key points

- **Axis operations**: `row.insert` / `column.insert` use `afterRowId` /
  `afterColumnId`; absence appends. Deleting a row or column validates and
  rewrites affected cell spans, ranges, and formula references.
- **Cell operations**: `cell.create` places a Cell at its anchor. `cell.delete`
  removes it and releases its span coordinates. `cell.set-source` changes what
  produces the cell's value and clears `accepted` to pending.
- **Merge**: `cell.merge` extends an existing Cell's span. The
  `coveredCellPolicy` determines what happens to Cells already occupying those
  coordinates.
- **Unmerge**: preserves the anchor Cell with `1×1` span. Remaining coordinates
  become empty.
- **Accepted content**: `cell.accept-content` and `cell.accept-error` carry
  `expectedSource` — a fingerprint of the source at the time evaluation was
  requested. This prevents a stale result from overwriting a newer edit.
- **Derived Output**: `derived-output.set` directly sets the reference.
  `derived-output.apply` is used after a refresh cycle.
- **Materialize**: converts a range projection into ordinary literal Cells.
  The anchor Cell may become a literal or be deleted.

## Pure domain functions

```ts
applyOperations(snapshot: WorkbookSnapshot, operations: SpreadsheetOperation[]): ApplyResult
invertOperations(before: WorkbookSnapshot, operations: SpreadsheetOperation[], after: WorkbookSnapshot): SpreadsheetOperation[]
validateWorkbook(snapshot: WorkbookSnapshot): ValidationResult
computeTouchedIds(snapshot: WorkbookSnapshot, operations: SpreadsheetOperation[]): string[]
canRebase(touchedIds: string[], interveningChangeSets: SpreadsheetChangeSet[]): RebaseDecision
canonicalizeWorkbook(snapshot: WorkbookSnapshot): Uint8Array
digestWorkbook(snapshot: WorkbookSnapshot): string
buildRangeProjection(snapshot: WorkbookSnapshot, cell: SpreadsheetCell): RangeProjection
resolveCoordinate(snapshot: WorkbookSnapshot, sheetId: SheetId, rowId: RowId, columnId: ColumnId): ResolvedCoordinate
```

```ts
interface ApplyResult {
  snapshot: WorkbookSnapshot;         // normalized
  forward: SpreadsheetOperation[];    // canonical forward
  inverse: SpreadsheetOperation[];    // exact inverse
  touchedIds: string[];               // sorted, deduplicated
  semanticDigest: string;
}

type ResolvedCoordinate =
  | { kind: "empty"; coordinate: StableCellRef }
  | { kind: "cell"; coordinate: StableCellRef; cellId: CellId; anchor: StableCellRef }
  | { kind: "projected"; coordinate: StableCellRef; anchorCellId: CellId; valuePath: Array<string | number> };
```

## Command and query contracts

```ts
interface SpreadsheetCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: SpreadsheetCommand;
}

type SpreadsheetCommand =
  | { type: "workbook.create"; workbookId: string; title: string }
  | { type: "workbook.submit"; workbookId: string; expectedRevision: number; operations: SpreadsheetOperation[] }
  | { type: "workbook.duplicate"; sourceWorkbookId: string; sourceRevision?: number }
  | { type: "workbook.compensate"; workbookId: string; targetChangeSetId: string; intent: "undo" | "redo"; expectedRevision: number }
  | { type: "workbook.calculate"; workbookId: string; expectedRevision: number }
  | { type: "derived-output.refresh"; workbookId: string; cellId: string; expectedRevision: number }
  | { type: "data.attach"; workbookId: string; anchor: StableCellRef; entryId: string; orientation: ProjectionOrientation; expectedRevision: number }
  | { type: "data.promote"; workbookId: string; range: StableRangeRef; displayName: string; description: string; kind: "table" | "record" | "list"; orientation: ProjectionOrientation; expectedRevision: number }
  | { type: "projection.materialize"; workbookId: string; anchorCellId: string; expectedRevision: number };

type SpreadsheetCommandResult =
  | { type: "workbook.created"; head: WorkbookHead }
  | { type: "workbook.changed"; changeSet: SpreadsheetChangeSet }
  | { type: "calculation.started"; planId: string }
  | { type: "derived-output.refreshed"; changed: boolean; output: DerivedOutputRef }
  | { type: "data.attached"; cell: SpreadsheetCell }
  | { type: "data.promoted"; entryId: string; cell: SpreadsheetCell }
  | { type: "projection.materialized"; cells: SpreadsheetCell[] };
```

### Queries

```ts
interface SpreadsheetQueryRequest {
  requestId: string;
  query: SpreadsheetQuery;
}

type SpreadsheetQuery =
  | { type: "workbook.list"; cursor?: string; lifecycle?: WorkbookHead["lifecycle"] }
  | { type: "workbook.load"; workbookId: string; revision?: number }
  | { type: "workbook.history"; workbookId: string; cursor?: string; limit: number }
  | { type: "sheet.grid"; workbookId: string; sheetId: string; topLeft: StableCellRef; bottomRight: StableCellRef }
  | { type: "coordinate.resolve"; workbookId: string; sheetId: string; rowId: RowId; columnId: ColumnId };
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/spreadsheet/command` | All mutating commands. |
| `POST` | `/spreadsheet/query` | All read queries. |

Two endpoints. All commands go through a serial queue; all queries through a
concurrent queue.

## Jobs

| Job | Queue | Effect |
|---|---|---|
| `spreadsheet.command.v1` | serial | Dispatch command, validate, reduce, persist ChangeSet, publish activity. |
| `spreadsheet.query.v1` | concurrent | Dispatch query, read from store, return result. |
| `spreadsheet.calculate` | concurrent → serial | Plan dependencies, evaluate concurrently, settle accepted values serially. |
| `spreadsheet.refresh-derived-output` | concurrent → serial | Call DerivedOutputs.refresh(), then conditionally adopt newer revision. |
| `spreadsheet.compact` | serial | Append a Base, prune retained history. |

## Semantic rebase

Same pattern as Document and Slides:

1. Reconstruct authored snapshot at `expectedRevision`.
2. Read intervening ChangeSets from `expectedRevision+1` to head.
3. Compute union of touched IDs from submitted operations.
4. Compute union of touched IDs from intervening ChangeSets.
5. If intersection → `revision_conflict`.
6. Otherwise, apply to current head and append new ChangeSet.

## Touched IDs for spreadsheet

| Operation type | Touched IDs |
|---|---|
| `workbook.*` | workbook identity (reserved ID) |
| `sheet.insert/move/delete` | the sheet ID + sibling sheet IDs whose ordering changes |
| `sheet.rename/set-freeze/set-defaults` | the sheet ID |
| `row.insert/move/delete` | the row ID + all cells whose span includes or crosses this row |
| `column.insert/move/delete` | the column ID + all cells whose span includes or crosses this column |
| `cell.create` | the cell ID |
| `cell.delete` | the cell ID + any projections that were blocked by/from this cell |
| `cell.set-source` | the cell ID + any cell whose projection extent changed |
| `cell.set-style/set-validation` | the cell ID |
| `rich-text.apply` | the cell ID |
| `cell.merge` | the cell ID + all covered cell IDs affected by policy |
| `cell.unmerge` | the cell ID |
| `cell.accept-*` | the cell ID + any cell whose projection extent changed |
| `derived-output.*` | the cell ID |
| `projection.materialize` | the anchor cell ID + all newly created cell IDs |
| `rule.*` | the rule ID |
| `overlay.*` | the overlay ID |

A parent (sheet, row, column) is touched only when its child membership changes.

## Calculation flow

```
1. Client sends workbook.calculate { workbookId, expectedRevision }
2. Serial job freezes the workbook at current revision
3. Concurrent phase:
   a. Build dependency graph: every formula cell → its dependencies
   b. Topological sort, detect cycles
   c. For each independent component: call Formula.evaluate(expression, dataBindingView)
   d. Formula resolves names via Data binding view
   e. Returns FormulaWireValue (scalar, table, record, list, or error)
4. Serial settlement phase:
   a. Check expectedSource fingerprint for each cell — has the source changed?
   b. If unchanged: append cell.accept-content or cell.accept-error
   c. If changed: skip this cell (another edit landed)
   d. Rebuild affected range projections
   e. Append ChangeSet and advance revision
```

## Derived Output refresh flow

```
1. Client sends derived-output.refresh { workbookId, cellId, expectedRevision }
2. Spreadsheet reads the Cell's current DerivedOutputRef
3. Spreadsheet calls DerivedOutputs.refresh(outputId)
   → Returns new head revision (or same if unchanged)
4. If head revision changed:
   a. Resolve the new output content (RichContent or structured value)
   b. Construct derived-output.apply with new ref + accepted content
   c. Submit through normal admission
   d. Returns { changed: true, output: newRef }
5. If unchanged:
   a. Returns { changed: false, output: currentRef }
```

## Idempotency

The dispatcher canonicalizes the complete command and computes `requestDigest`.
An identical retry returns the original typed result. Reusing a request ID with
a different digest returns `idempotency_mismatch`.

## Compensation (undo/redo)

```ts
interface SpreadsheetChangeSet {
  id: string;
  workbookId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;
  origin: "interactive" | "agent" | "automation";
  operations: SpreadsheetOperation[];
  inverseOperations: SpreadsheetOperation[];
  touchedIds: string[];
  compensation?: { intent: "undo" | "redo"; targetChangeSetId: string };
  semanticDigest: string;
  createdAt: string;
}
```

Same compensation model as Document and Slides: the reducer creates inverse
operations from exact before/after state. Activity selects undo/redo and
Spreadsheet validates and appends stored inverse operations.</think>

<｜DSML｜tool_calls>
<｜DSML｜invoke name="create_file">
<｜DSML｜parameter name="content" string="true"># Spreadsheet capability — file architecture

## Placement

Spreadsheet is a project-scoped capability. `createSpreadsheetCapability`
receives an already-scoped store; no file below places a project or user ID
in a Spreadsheet domain value or request DTO.

```text
apps/backend/src/
  3-capabilities/
    spreadsheet/
      domain/
        model.ts              # all types: Workbook, Sheet, Cell, Range, Projection, operations
        errors.ts             # NotFound, RevisionConflict, ValidationError, etc.
        reducer.ts            # applyOperations (pure), computeTouchedIds, canRebase
        inverses.ts           # invertOperations (pure)
        validation.ts         # validateWorkbook, validateSheet, validateCell, validateSpan
        projection.ts         # buildRangeProjection, resolveCoordinate (pure)
      application/
        spreadsheetService.ts # createSpreadsheetCapability factory
        commands.ts           # command dispatch: create, submit, duplicate, compensate
        queries.ts            # query dispatch: load, list, grid, history
        admission.ts          # CAS submit, idempotency, semantic rebase, ChangeSet append
        createService.ts      # create blank workbook with one sheet
        readService.ts        # load snapshot, list workbooks, grid projection
        historyService.ts     # history listing, revision load
        calculation.ts        # plan → evaluate (concurrent) → settle (serial)
        derivedOutputRefresh.ts  # refresh derived output cell
        dataCoordination.ts   # attach data entry, promote range to data, materialize projection
        compensation.ts       # undo/redo via inverse operations
        activity.ts           # activity outbox contributions
        callLogging.ts        # structured logging wrapper
      ports/
        spreadsheetStore.ts   # SpreadsheetStore interface
      persistence/
        migrations/
          001-spreadsheet.ts
        sqliteSpreadsheetStore.ts
        sqliteMappers.ts
      index.ts

  1-init/create/
    spreadsheet.ts

  4-job-wiring/
    spreadsheet/
      registerSpreadsheetEndpoints.ts
      createSpreadsheetJobs.ts
```

## Module responsibilities

| File | Main contents |
|---|---|
| `domain/model.ts` | `WorkbookHead`, `WorkbookSnapshot`, `WorkbookMetadata`, `CalculationSettings`, `SpreadsheetSheet`, `SheetRow`, `SheetColumn`, `FreezeState`, `SheetDefaults`, `SpreadsheetCell`, `StableCellRef`, `CellSpan`, `CellSource`, `CellLiteral`, `ProjectionOrientation`, `AcceptedCellContent`, `FormulaScalar`, `CellError`, `CellDependency`, `StableRangeRef`, `RangeProjection`, `ProjectedCell`, `ProjectionDiagnostic`, `CellStyle`, `CellValidation`, `ValidationRule`, `SheetRule`, `ConditionalFormatRule`, `SheetOverlay`, `SpreadsheetOperation` union, `SpreadsheetChangeSet`, `SpreadsheetBase`. |
| `domain/errors.ts` | `WorkbookNotFoundError`, `SheetNotFoundError`, `CellNotFoundError`, `RevisionConflictError`, `IdempotencyMismatchError`, `ValidationError`, `HistoryPrunedError`, `CompensationConflictError`, `SpanOverlapError`, `ProjectionBlockedError`, `AxisNotFoundError`. |
| `domain/reducer.ts` | `applyOperations(snapshot, ops)` → `ApplyResult`. Pure: copies snapshot, applies each operation, handles span overlap detection, rebuilds projections, normalizes, returns result. `computeTouchedIds`, `canRebase`. |
| `domain/inverses.ts` | `invertOperations(before, ops, after)` → `SpreadsheetOperation[]`. Produces compensation operations from exact before/after state. |
| `domain/validation.ts` | `validateWorkbook(snapshot)`, `validateSheet(sheet)`, `validateCellSpan(cell, sheet)`, per-operation validators, limits (max sheets, max rows/columns, max cells per sheet, max span size). |
| `domain/projection.ts` | `buildRangeProjection(snapshot, cell)` → `RangeProjection`. `resolveCoordinate(snapshot, sheetId, rowId, columnId)` → `ResolvedCoordinate`. Pure, deterministic. |
| `application/spreadsheetService.ts` | `createSpreadsheetCapability(store, deps, options)` → `SpreadsheetCapability`. Factory. Exposes `command(request)` and `query(request)`. |
| `application/commands.ts` | Dispatches `SpreadsheetCommand` variants. Handles create, submit, duplicate, compensate, calculate, derived-output-refresh, data-attach, data-promote, projection-materialize. |
| `application/queries.ts` | Dispatches `SpreadsheetQuery` variants. Handles list, load, history, grid, coordinate-resolve. |
| `application/admission.ts` | CAS submit: validate expectedRevision, attempt rebase, apply operations, persist ChangeSet + receipt in one transaction. |
| `application/createService.ts` | Creates a blank `WorkbookSnapshot` with one default sheet and default row/column axes, persists revision 0 Base. |
| `application/readService.ts` | Loads current or historical snapshot, lists workbooks, projects grid views. |
| `application/historyService.ts` | Lists retained ChangeSets, loads exact historical revision. |
| `application/calculation.ts` | Plans calculation (dependency graph, topological sort, cycle detection), evaluates concurrently via Formula, settles accepted values serially with `expectedSource` fingerprint check. |
| `application/derivedOutputRefresh.ts` | Reads Cell ref → calls DerivedOutputs.refresh() → conditionally applies new ref + accepted content through normal admission. |
| `application/dataCoordination.ts` | `attachDataEntry`: resolves Data entry, creates/updates Data-backed anchor Cell. `promoteRangeToData`: creates Data entry idempotently, replaces range with Data-backed anchor Cell. `materializeProjection`: converts projected range into ordinary Cells. |
| `application/compensation.ts` | Validates target ChangeSet is retained, appends stored inverse operations. |
| `application/activity.ts` | Prepares activity-outbox row for accepted mutations. |
| `application/callLogging.ts` | Structured logging wrapper. |
| `ports/spreadsheetStore.ts` | `SpreadsheetStore` interface: listHeads, getHead, load, getChangeSets, getSubmission, commitMutation, appendBase, pruneBases, pruneChangeSets. |
| `persistence/sqliteSpreadsheetStore.ts` | SQLite implementation. Owns table creation, migrations, transactions. |
| `persistence/sqliteMappers.ts` | JSON ↔ domain type mappers. Canonical JSON with deterministic key ordering. |

## Dependency direction

```text
transport / jobs / initialization
              ↓
        application services
          ├─ domain logic (pure, no side effects)
          ├─ SpreadsheetStore ── persistence (SQLite)
          ├─ DerivedOutputs (for derived output refresh)
          ├─ StructuredData (for data attach/promote/materialize)
          ├─ platform Formula (for calculation)
          ├─ platform RichText (for text cell operation validation)
          └─ platform Logger (for structured logging)
```

Domain files are pure and deterministic. They never query SQLite or call any
external capability. Application services own sequencing, idempotency, and
transactions. Persistence only implements the scoped `SpreadsheetStore` contract.

## Construction

```ts
// 1-init/create/spreadsheet.ts

interface SpreadsheetDependencies {
  richText: RichText;              // platform
  formula: FormulaEngine;          // platform
  structuredData: StructuredData;  // capability
  derivedOutputs: DerivedOutputs;  // capability
  logger: Logger;                  // platform
}

interface SpreadsheetOptions {
  history: {
    retainedBaseCount: number;       // default: 5
    retainedChangeSetCount: number;  // default: 1000
  };
  limits: {
    maxSheetsPerWorkbook: number;    // default: 256
    maxRowsPerSheet: number;         // default: 1_048_576
    maxColumnsPerSheet: number;      // default: 16_384
    maxCellsPerSheet: number;        // default: 500_000 (sparse)
    maxSpanRows: number;             // default: 1_000
    maxSpanColumns: number;          // default: 100
    maxProjectionExtentRows: number; // default: 10_000
    maxProjectionExtentColumns: number; // default: 256
  };
}

export function createSpreadsheetCapability(
  store: SpreadsheetStore,
  deps: SpreadsheetDependencies,
  options: SpreadsheetOptions,
): SpreadsheetCapability {
  // construct domain, application, return public interface
}

// Project-scoped factory:
export function createProjectSpreadsheetCapability(
  projectId: string,
  db: Database,
  deps: SpreadsheetDependencies,
  options: SpreadsheetOptions,
): SpreadsheetCapability {
  const store = new SQLiteSpreadsheetStore(projectId, db);
  return createSpreadsheetCapability(store, deps, options);
}
```

Note: Spreadsheet depends on Formula and Structured Data at construction time
(unlike Slides). Formula is needed for cell calculation. Structured Data is
needed for data attach, promote, and materialize commands.

## Job wiring

```ts
// 4-job-wiring/spreadsheet/registerSpreadsheetEndpoints.ts

export function registerSpreadsheetEndpoints(
  registry: JobRegistry,
  spreadsheet: SpreadsheetCapability,
  logger: Logger
): void {
  // POST /spreadsheet/command — serial, inline
  registry.register({ method: "POST", path: "/spreadsheet/command" }, (request) => ({
    name: "spreadsheet.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await spreadsheet.command(request.body);
        return { statusCode: 200, body: result };
      } catch (e) {
        return spreadsheetError(e);
      }
    }
  }));

  // POST /spreadsheet/query — concurrent, inline
  registry.register({ method: "POST", path: "/spreadsheet/query" }, (request) => ({
    name: "spreadsheet.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const result = await spreadsheet.query(request.body);
      return { statusCode: 200, body: result };
    }
  }));
}
```

Error mapping:

```ts
function spreadsheetError(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof WorkbookNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof SheetNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof CellNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof RevisionConflictError) return { statusCode: 409, body: { error: "revision_conflict", message: e.message } };
  if (e instanceof IdempotencyMismatchError) return { statusCode: 409, body: { error: "idempotency_mismatch", message: e.message } };
  if (e instanceof ValidationError) return { statusCode: 400, body: { error: "validation_error", message: e.message } };
  if (e instanceof HistoryPrunedError) return { statusCode: 410, body: { error: "history_pruned", message: e.message } };
  if (e instanceof SpanOverlapError) return { statusCode: 409, body: { error: "span_overlap", message: e.message } };
  if (e instanceof ProjectionBlockedError) return { statusCode: 409, body: { error: "projection_blocked", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}
```

## Startup wiring

In `1-init/startBackend.ts`, after RichText, Formula, Structured Data, and
DerivedOutputs are constructed:

```ts
const spreadsheet = createProjectSpreadsheetCapability(
  config.projectId,
  db,
  {
    richText,
    formula,
    structuredData,
    derivedOutputs,
    logger,
  },
  {
    history: config.spreadsheet?.history ?? { retainedBaseCount: 5, retainedChangeSetCount: 1000 },
    limits: config.spreadsheet?.limits ?? {
      maxSheetsPerWorkbook: 256,
      maxRowsPerSheet: 1_048_576,
      maxColumnsPerSheet: 16_384,
      maxCellsPerSheet: 500_000,
      maxSpanRows: 1_000,
      maxSpanColumns: 100,
      maxProjectionExtentRows: 10_000,
      maxProjectionExtentColumns: 256,
    },
  },
);

registerSpreadsheetEndpoints(registry, spreadsheet, logger);
```

## Rebuildable projections

| Projection | Key | What it provides |
|---|---|---|
| Grid view | sheetId + viewport | Cells and projected values in a coordinate rectangle |
| Dependency graph | workbookId + revision | Which cells depend on which other cells/entries |
| Calculation plan | workbookId + revision | Topological evaluation order, strongly connected components |
| Range projection | anchorCellId + revision | Extent and status of a structured value projection |

## Key differences from Document and Slides

| Aspect | Document | Slides | Spreadsheet |
|---|---|---|---|
| Ordering | Row/Block arrays | SlideOrder + element ranks | SheetOrder + row/column ranks |
| Layout | Row with width proportions | Absolute frame (x, y, w, h) | Grid: row/column intersection |
| Nesting | Callout rows only | Groups to configured depth | No structural nesting |
| Text content | `RichContent` in TextBlock | `RichContent` in TextShape | `RichContent` in Cell (rich-text source) |
| Derived output | `DerivedOutputRef` in PromptBlock | `DerivedOutputRef` in TextShape | `DerivedOutputRef` in Cell |
| Data references | Via formula atoms | `SlideValueSource` on table/chart | `CellSource.data` with entryId |
| Formula | Inline formula atoms in RichContent | No direct formula support | `CellSource.formula` with source text |
| Merging | No merge concept | No merge concept | Cell span merge/unmerge |
| Projections | Pagination from font metrics | N/A | Range projections from structured values |
| Calculation | Formula evaluation per atom | N/A | Workbook-level dependency-aware calculation |
| Construction deps | `richText`, `formula`, `derivedOutputs` | `richText`, `derivedOutputs` | `richText`, `formula`, `structuredData`, `derivedOutputs` |