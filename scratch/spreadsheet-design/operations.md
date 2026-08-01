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

  // ── Derived Output ───────────────────────────────────────────────────
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
  digest: string;
};
```

### Key points

- **Axis operations**: `row.insert` / `column.insert` use `afterRowId` /
  `afterColumnId`; absence appends. Deleting a row or column validates and
  rewrites affected cell spans, ranges, and formula references.
- **Cell operations**: `cell.create` places a Cell at its anchor. `cell.delete`
  removes it. `cell.set-source` changes the value source and clears `accepted`.
- **Merge**: `cell.merge` extends an existing Cell's span. `coveredCellPolicy`
  controls what happens to Cells in the covered coordinates.
- **Unmerge**: preserves anchor Cell with `1×1` span. Remaining coordinates
  become empty.
- **Accepted content**: `cell.accept-content` / `cell.accept-error` carry
  `expectedSource` — a fingerprint of the source at evaluation time. Prevents
  stale results from overwriting newer edits.
- **Derived Output**: `derived-output.set` directly sets the reference.
  `derived-output.apply` used after a refresh cycle.
- **Materialize**: converts a range projection into ordinary literal Cells.

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
  snapshot: WorkbookSnapshot;
  forward: SpreadsheetOperation[];
  inverse: SpreadsheetOperation[];
  touchedIds: string[];
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
  | { type: "data.attach"; workbookId: string; anchor: StableCellRef; entryId: string; entryKind: "table" | "record" | "list"; orientation: ProjectionOrientation; expectedRevision: number }
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
| `spreadsheet.refresh-derived-output` | concurrent → serial | Call DerivedOutputs.refresh(), conditionally adopt newer revision. |
| `spreadsheet.compact` | serial | Append a Base, prune retained history. |

## Semantic rebase

Same pattern as Document and Slides:

1. Reconstruct authored snapshot at `expectedRevision`.
2. Read intervening ChangeSets from `expectedRevision+1` to head.
3. Compute union of touched IDs from submitted operations.
4. Compute union of touched IDs from intervening ChangeSets.
5. If intersection → `revision_conflict`.
6. Otherwise, apply to current head and append new ChangeSet.

## Touched IDs

| Operation type | Touched IDs |
|---|---|
| `workbook.*` | workbook identity |
| `sheet.insert/move/delete` | sheet ID + sibling sheet IDs whose ordering changes |
| `sheet.rename/set-freeze/set-defaults` | sheet ID |
| `row.insert/move/delete` | row ID + all cells whose span includes/crosses this row |
| `column.insert/move/delete` | column ID + all cells whose span includes/crosses this column |
| `cell.create` | cell ID |
| `cell.delete` | cell ID + any projections affected |
| `cell.set-source` | cell ID + any cell whose projection extent changed |
| `cell.set-style/set-validation` | cell ID |
| `rich-text.apply` | cell ID |
| `cell.merge` | cell ID + all covered cell IDs affected by policy |
| `cell.unmerge` | cell ID |
| `cell.accept-*` | cell ID + any cell whose projection extent changed |
| `derived-output.*` | cell ID |
| `projection.materialize` | anchor cell ID + all newly created cell IDs |
| `rule.*` | rule ID |
| `overlay.*` | overlay ID |

## Calculation flow

```
1. Client sends workbook.calculate { workbookId, expectedRevision }
2. Serial job freezes the workbook at current revision
3. Concurrent phase:
   a. Plan: build dependency graph, topological sort, detect cycles
   b. For each independent component:
      — Call Formula.evaluate(expression, dataBindingView)
      — Formula resolves names via Data binding view
      — Returns FormulaWireValue (scalar, table, record, list, or error)
4. Serial settlement phase:
   a. For each evaluated cell: check expectedSource fingerprint
   b. If unchanged: append cell.accept-content or cell.accept-error
   c. If changed: skip (another edit landed)
   d. Rebuild affected range projections
   e. Append ChangeSet and advance revision
```

## Idempotency and ChangeSet structure

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

Same idempotency and compensation model as Document and Slides. The dispatcher
canonicalizes the command and computes `requestDigest`. An identical retry
returns the original result. Reusing a request ID with a different digest
returns `idempotency_mismatch`.