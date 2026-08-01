# Spreadsheet capability — operations, endpoints, and Jobs

## Boundary

The implementation lives under the singular code path
`3-capabilities/spreadsheet/`. The aggregate is a Workbook, and the public
resource routes are plural: `/spreadsheets/command` and
`/spreadsheets/query`.

Spreadsheet owns Workbook revisioning, stable grid identity, sparse Cells,
formatting, formula-source admission, accepted calculation results, and range
projections. It does not implement the Formula language, Rich Content editing,
Structured Data persistence, Derived Output production, Activity feeds, or a
rendering engine.

The runtime injects:

- Rich Text for every `RichContent` edit and Formula-atom settlement;
- Formula for parse, bind, dependency extraction, and evaluation;
- one narrow Formula resolver that produces immutable project binding
  snapshots, including Structured Data values;
- Derived Outputs for dedicated Prompt Content Cell creation, definition
  update, refresh, and exact-revision reads;
- a typed internal Jobs runtime for durable compute/settle workflows; and
- Logger for structured outcomes.

The reducer is pure. It never queries another capability, creates Jobs, reads
the clock, invents an ID, or resolves an A1 address against mutable state.

## Identity and ordering

Workbook internal identities are permanent within that Workbook. A deleted
Sheet, Row, Column, Cell, rule, format region, overlay, Rich Text atom, or
other retained canonical entity ID cannot be reused.

Ordering has one authority per collection:

- `sheetOrder` is the sole Sheet-order authority;
- `SpreadsheetSheet.rowOrder` is the sole Row-order authority;
- `SpreadsheetSheet.columnOrder` is the sole Column-order authority; and
- kind-specific order arrays are authoritative inside ordered overlay payloads.

A1 notation is never canonical identity. A coordinate resolves through stable
`sheetId`, `rowId`, and `columnId`. Canonical formula bindings use those stable
IDs even when the author typed A1, a Sheet-qualified address, or a range.

Row and Column placement uses stable `after*Id` anchors. Absence means the
front of the corresponding order. Rows and Columns contain no rank, index, or
second ordering field.

## Canonical operation vocabulary

Canonical operations are strict, closed, reversible replay values. They are
not all public authoring inputs; internal source adoption and settlement
operations are admitted only by their staged workflows.

```ts
type SpreadsheetOperation =
  // Workbook metadata and calculation policy
  | { type: "workbook.rename"; title: string }
  | { type: "workbook.set-lifecycle";
      lifecycle: "active" | "archived" | "trashed" }
  | { type: "workbook.set-metadata"; metadata: WorkbookMetadata }
  | { type: "workbook.set-calculation";
      calculation: CalculationSettings }

  // Sheets — sheetOrder remains authoritative
  | { type: "sheet.insert"; sheet: SpreadsheetSheet;
      afterSheetId?: SheetId }
  | { type: "sheet.move"; sheetId: SheetId;
      afterSheetId?: SheetId }
  | { type: "sheet.delete"; sheetId: SheetId }
  | { type: "sheet.rename"; sheetId: SheetId; title: string }
  | { type: "sheet.set-freeze"; sheetId: SheetId;
      freeze: FreezeState }
  | { type: "sheet.set-defaults"; sheetId: SheetId;
      defaults: SheetDefaults }

  // Axes — rowOrder/columnOrder are the sole ordering authorities
  | { type: "row.insert"; sheetId: SheetId; row: SheetRow;
      afterRowId?: RowId }
  | { type: "row.move"; sheetId: SheetId; rowId: RowId;
      afterRowId?: RowId }
  | { type: "row.delete"; sheetId: SheetId; rowId: RowId }
  | { type: "row.resize"; sheetId: SheetId; rowId: RowId;
      heightPt?: number }
  | { type: "row.set-hidden"; sheetId: SheetId; rowId: RowId;
      hidden: boolean }
  | { type: "column.insert"; sheetId: SheetId; column: SheetColumn;
      afterColumnId?: ColumnId }
  | { type: "column.move"; sheetId: SheetId;
      columnId: ColumnId; afterColumnId?: ColumnId }
  | { type: "column.delete"; sheetId: SheetId; columnId: ColumnId }
  | { type: "column.resize"; sheetId: SheetId;
      columnId: ColumnId; widthPt?: number }
  | { type: "column.set-hidden"; sheetId: SheetId;
      columnId: ColumnId; hidden: boolean }

  // Sparse Cells. Public create/set-content is limited below.
  | { type: "cell.create"; sheetId: SheetId; cell: SpreadsheetCell }
  | { type: "cell.delete"; sheetId: SheetId; cellId: CellId }
  | { type: "cell.set-content"; sheetId: SheetId; cellId: CellId;
      content: CellContent }
  | { type: "cell.set-style"; sheetId: SheetId; cellId: CellId;
      style: CellStyle }
  | { type: "cell.set-validation"; sheetId: SheetId; cellId: CellId;
      validation?: CellValidation }

  // Rich Content, including Formula atoms
  | { type: "rich-content.apply"; sheetId: SheetId; cellId: CellId;
      operations: RichTextOperation[] }

  // Formula source and calculation settlement — internal normalized values
  | { type: "formula-source.apply"; target: SpreadsheetFormulaTarget;
      formula: SpreadsheetFormulaSource }
  | { type: "formula-cell.apply-settlement"; sheetId: SheetId;
      cellId: CellId; settlement: ComputedCellSettlement;
      guard: FormulaSettlementGuard }

  // Merges
  | { type: "cell.merge"; sheetId: SheetId; cellId: CellId;
      span: CellSpan }
  | { type: "cell.unmerge"; sheetId: SheetId; cellId: CellId }

  // Dedicated Prompt Content output adoption — internal only
  | { type: "prompt-content.apply-derived-output"; sheetId: SheetId;
      cellId: CellId; output: DerivedOutputRef }

  // Exact Formula-resolver binding adoption — internal only
  | { type: "data-cell.apply-content"; sheetId: SheetId;
      cellId: CellId; content: DataCellContent;
      expectedContent?: CellContentFingerprint }

  // Convert one rebuildable projection into explicit ordinary Cells
  | { type: "projection.materialize"; sheetId: SheetId;
      anchorCellId: CellId; replacement?: SpreadsheetCell;
      cells: SpreadsheetCell[] }

  // Sheet presentation and rules
  | { type: "format-region.create"; sheetId: SheetId;
      region: SheetFormatRegion }
  | { type: "format-region.update"; sheetId: SheetId;
      regionId: string; region: SheetFormatRegion }
  | { type: "format-region.delete"; sheetId: SheetId; regionId: string }
  | { type: "rule.create"; sheetId: SheetId; rule: SheetRule }
  | { type: "rule.update"; sheetId: SheetId;
      ruleId: string; rule: SheetRule }
  | { type: "rule.delete"; sheetId: SheetId; ruleId: string }
  | { type: "overlay.create"; sheetId: SheetId; overlay: SheetOverlay }
  | { type: "overlay.update"; sheetId: SheetId;
      overlayId: string; overlay: SheetOverlay }
  | { type: "overlay.delete"; sheetId: SheetId; overlayId: string };

type PublicSpreadsheetOperation = Exclude<
  SpreadsheetOperation,
  { type:
      | "formula-source.apply"
      | "formula-cell.apply-settlement"
      | "prompt-content.apply-derived-output"
      | "data-cell.apply-content" }
>;
```

`cell.set-content` replaces the complete discriminated content value. Formula
and Data content carry their own exact `ComputedCellSettlement`; Rich Content
owns its Formula-atom settlements internally; Prompt Content carries only its
exact output reference.

Merge is deliberately lossless: every non-anchor coordinate in the requested
span must be empty. There is no discard or hidden covered-Cell state. Deleting
a Prompt Content Cell—or replacing its content through an admitted public or
staged operation—changes its local output-ownership record to historical in
the same transaction. Row, Column, and Sheet deletion apply the same rule.
Spreadsheet never deletes the external Derived Output.

`projection.materialize` carries every resulting stable Cell ID and exact
value. The reducer invents nothing. Admission verifies that the supplied
materialized values equal the current projection.

No settlement operation stores `RangeProjection`. Projection extent, blocked
status, and diagnostics are rebuilt from the settled structured value, anchor,
orientation, and current axes. They are never a second canonical copy.

## Formula-source admission

Whole-Cell formulas, custom validation formulas, and conditional-format
formulas use a Spreadsheet authoring syntax that includes A1, Sheet-qualified,
and rectangular range references. Formula itself deliberately does not own
those address semantics.

Public `workbook.submit` therefore accepts one authoring-only edit in addition
to its public canonical operations:

```ts
type SpreadsheetEdit =
  | PublicSpreadsheetOperation
  | {
      type: "formula-source.admit";
      target: SpreadsheetFormulaTarget;
      authoredSource: string;
    };

type SpreadsheetFormulaTarget =
  | { kind: "cell"; sheetId: SheetId; cellId: CellId }
  | { kind: "cell-validation"; sheetId: SheetId; cellId: CellId }
  | { kind: "conditional-format"; sheetId: SheetId; ruleId: string };
```

Admission processes an edit batch in order against one working authored
snapshot. A batch may therefore create an empty Cell or a non-formula rule and
then admit its formula source atomically.

For each `formula-source.admit`, Spreadsheet:

1. tokenizes Spreadsheet address syntax without treating strings as refs;
2. resolves every address against the authored revision to stable Sheet/Row/
   Column identities;
3. replaces address tokens with collision-proof Formula/v1 aliases;
4. parses symbolic non-builtin project names and resolves them against one
   immutable project Formula-resolver snapshot;
5. stores each grid alias, authored UTF-16 span, stable target,
   absolute/relative Row and Column modes, and explicit-Sheet intent in the
   binding manifest;
6. stores each project's authored/normalized lookup key and stable binding ID,
   together with the admission resolver identity; and
7. asks Formula to parse the normalized Formula/v1 source and emits one
   canonical `formula-source.apply` forward operation.

The normalized expression, stable binding manifest, language version, and
source digest form `SpreadsheetFormulaSource` under
`spreadsheet-formula/v1`. `authoredText` is retained for editor round-tripping,
but is never rebound as authority. `normalizedFormulaSource` is the actual
Formula/v1 input. Sheet rename or axis movement therefore cannot silently
retarget a formula. One `admissionResolverSnapshotDigest` identifies the
project resolver snapshot used to admit all project-binding manifest entries.

Project names are bind-once identities too. At calculation time Spreadsheet
finds the current resolver binding by the stored `bindingId` and exposes that
value under the stored lookup key. A rename therefore keeps the same binding,
and a new declaration that later claims the old display name cannot retarget
the formula. A missing stored binding ID produces `stale_binding`; evaluation
never falls back to name lookup. The binding may advance to a newer revision
under the same stable ID, and the accepted settlement records that observed
revision and value digest.

Structural operations update or invalidate stable range manifests through
explicit normalized forward operations. A deleted target becomes a typed
reference diagnostic; it never falls through to whatever later occupies the
old A1 coordinate.

Validation and conditional-format formulas also bind once at admission. Their
relative/absolute flags preserve authoring and future copy intent, but v1 does
not re-evaluate a relative token separately for every Cell in a target range.
Excel-style per-target relative rule evaluation would require a distinct rule
template plus target-anchor manifest; it is not implied by this model.

Raw `FormulaCellContent`, raw custom-validation formulas, raw formula rules,
and caller-authored `formula-source.apply` are rejected at the public boundary.
Importers use the same admission edit rather than manufacturing a binding
manifest.

## Rich Content and `{{ ... }}` formulas

Rich Content is a separate formula surface. A text-valued Cell owns ordinary
`RichContent`, and `rich-content.apply` delegates the complete edit batch to
the injected Rich Text runtime.

The `{{ ... }}` shortcut follows the Document and Slide contract:

1. the editor identifies the completed delimited range;
2. Rich Text returns operations replacing it with one Formula atom;
3. the client submits those operations through `rich-content.apply`;
4. admission stores Rich Text's normalized forward and exact inverse edits;
5. Spreadsheet discovers each new or expression-changed Formula atom; and
6. the same mutation transaction creates one durable Rich Formula attempt per
   changed atom.

Spreadsheet never parses the braces and never stores a second accepted copy of
the atom value. Formula evaluates the expression, while Rich Text owns its
accepted value, display text, diagnostic, and settlement operation.

Spreadsheet-local A1/range normalization belongs to whole-Cell formula-source
admission. Rich Content Formula atoms initially use ordinary Formula/v1 names,
the same boundary as Document and Slide. Adding stable Spreadsheet address
tokens inside Formula atoms requires a future Rich Text atom contract that can
retain the alias manifest; positional rebinding is not silently approximated.

## Pure application and inversion

```ts
applyOperations(
  snapshot: WorkbookSnapshot,
  operations: SpreadsheetOperation[]
): SpreadsheetApplyResult;

invertOperations(
  before: WorkbookSnapshot,
  operations: SpreadsheetOperation[],
  after: WorkbookSnapshot
): SpreadsheetOperation[];

validateWorkbook(snapshot: WorkbookSnapshot): ValidationResult;
computeTouchedIds(
  snapshot: WorkbookSnapshot,
  operations: SpreadsheetOperation[]
): string[];
canRebase(
  touchedIds: string[],
  intervening: SpreadsheetChangeSet[]
): RebaseDecision;
canonicalizeWorkbook(snapshot: WorkbookSnapshot): Uint8Array;
digestWorkbook(snapshot: WorkbookSnapshot): string;
buildRangeProjection(
  snapshot: WorkbookSnapshot,
  cell: SpreadsheetCell
): RangeProjection;
resolveCoordinate(
  snapshot: WorkbookSnapshot,
  coordinate: StableCellRef
): ResolvedCoordinate;
```

```ts
interface SpreadsheetApplyResult {
  snapshot: WorkbookSnapshot;
  forward: SpreadsheetOperation[];
  inverse: SpreadsheetOperation[];
  touchedIds: string[];
  semanticDigest: string;
  dirtyFormulaCellIds: CellId[];
  richFormulaChanges: Array<{
    sheetId: SheetId;
    cellId: CellId;
    atomId: string;
    expression: string;
  }>;
}
```

The normalized forward batch is what is persisted. Inverses are calculated
from actual before state while applying and are stored in reverse execution
order.

Exact inversion includes:

- prior optional values rather than guessed defaults;
- complete deleted Sheets, axes, Cells, rules, regions, and overlays;
- exact prior Sheet/Row/Column positions;
- every Cell removed or rewritten by axis, merge, or projection operations;
- the complete prior `CellContent`, including any settlement;
- Rich Text's own exact inverse operations;
- the complete prior stable formula binding manifest;
- exact prior Prompt/Data references; and
- every local ownership transition caused by removing Prompt Content.

Undo and redo append stored canonical inverse operations as new ChangeSets.
They never regenerate an A1 binding, re-fetch external data, or call Derived
Outputs.

## Public versus internal operations

The public edit decoder rejects:

- `formula-source.apply` and `formula-cell.apply-settlement`;
- Rich Text's `apply-formula-settlement` operation;
- `prompt-content.apply-derived-output`;
- `data-cell.apply-content`;
- `cell.create` or `cell.set-content` that introduces Formula, Prompt Content,
  or Data-backed content directly;
- a caller-selected Derived Output reference or Data binding snapshot;
- an identity previously present in the permanent identity ledger; and
- reserved internal request IDs.

Public edits may create or replace blank, literal, and Rich Content values.
They may remove Formula, Prompt Content, or Data-backed content. Formula source
creation uses `formula-source.admit`; Prompt and Data sources use their
dedicated staged commands.

Compensation and serial settlement use trusted internal admission. Prompt
settlement can adopt only the exact dedicated `outputId` frozen by the attempt.
Data settlement can adopt only the stable binding ID frozen by its attempt.

## Touched IDs and semantic rebase

Touched footprints combine stable IDs with semantic sentinels:

| Change | Minimum footprint |
|---|---|
| Workbook metadata/calculation | corresponding `$workbook:*` sentinel |
| Sheet insert/move/delete | `$workbook:sheets`, Sheet ID, complete deleted subtree |
| Sheet metadata | Sheet ID and property sentinel |
| Row insert/move/delete | `$sheet:{id}:rows`, Row ID, rewritten spans/ranges/formula owners |
| Column insert/move/delete | `$sheet:{id}:columns`, Column ID, rewritten spans/ranges/formula owners |
| Row/Column size or visibility | Row/Column ID and property sentinel |
| Cell create/delete/content | Cell ID, coordinate sentinel, affected projection anchors |
| Cell style/validation | Cell ID and property sentinel |
| Formula source | owner target, source digest, every stable reference target |
| Rich Content | Cell ID plus Rich Text atom/mark footprint |
| Merge/unmerge | anchor, every covered coordinate and affected Cell ID |
| Formula settlement | Cell ID and accepted-value sentinel |
| Prompt/Data adoption | Cell ID, source sentinel, affected projection extent |
| Projection materialization | anchor plus every introduced/replaced Cell and coordinate |
| Format region/rule | record ID, its stable range members, Sheet registry sentinel |
| Overlay | overlay ID, anchor/extent members, Sheet overlay sentinel |

All ordering changes on one axis share the axis sentinel, so concurrent
insert/move/delete decisions conflict. Independent Cell edits can rebase when neither
their coordinates, stable dependencies, projections, nor containing
structures overlap.

For a stale public command:

1. reconstruct the exact authored revision;
2. normalize any formula-source admission against that authored snapshot;
3. require a continuous retained ChangeSet tail through current head;
4. compare the incoming footprint with every intervening footprint;
5. reject any intersection as `revision_conflict`; otherwise
6. apply the normalized canonical operations to current head and invert from
   that current before state.

Internal async settlement does not use permissive stale rebase. It uses the
attempt-specific guards described below.

## Command contracts

```ts
interface SpreadsheetCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: SpreadsheetCommand;
}

type CellTarget =
  | { kind: "existing"; sheetId: SheetId; cellId: CellId }
  | { kind: "empty-coordinate"; sheetId: SheetId;
      cell: SpreadsheetCellShell };

type SpreadsheetCellShell = Omit<SpreadsheetCell, "content">;

type SpreadsheetCommand =
  | { type: "workbook.create"; workbookId: string; title: string;
      initialSheetId: SheetId; initialRowIds: RowId[];
      initialColumnIds: ColumnId[] }
  | { type: "workbook.submit"; workbookId: string;
      expectedRevision: number; edits: SpreadsheetEdit[] }
  | { type: "workbook.compensate"; workbookId: string;
      targetChangeSetId: string; intent: "undo" | "redo";
      expectedRevision: number }
  | { type: "workbook.calculate.request"; workbookId: string;
      expectedRevision: number; cellIds?: CellId[] }
  | { type: "rich-formula.evaluate.request"; workbookId: string;
      sheetId: SheetId; cellId: CellId; formulaAtomId: string }
  | { type: "prompt-content.create.request"; workbookId: string;
      expectedRevision: number; target: CellTarget;
      prompt: string; contextEntries: ContextEntry[];
      stabilisationText: string }
  | { type: "prompt-content.update-definition"; workbookId: string;
      cellId: CellId; expectedDefinitionRevision: number;
      prompt: string; contextEntries: ContextEntry[];
      stabilisationText: string }
  | { type: "prompt-content.refresh.request"; workbookId: string;
      cellId: CellId; expectedRevision: number }
  | { type: "data-cell.attach.request"; workbookId: string;
      expectedRevision: number; target: CellTarget;
      bindingId: string; tracking: "pinned" | "follow-head";
      orientation?: ProjectionOrientation }
  | { type: "data-cell.refresh.request"; workbookId: string;
      cellId: CellId; expectedRevision: number }
  | { type: "projection.materialize"; workbookId: string;
      sheetId: SheetId; anchorCellId: CellId;
      materializedCellIds: CellId[]; expectedRevision: number };

type SpreadsheetCommandResult =
  | { type: "workbook.created"; head: WorkbookHead }
  | { type: "workbook.changed"; changeSet: SpreadsheetChangeSet;
      attemptIds: string[] }
  | { type: "calculation.requested"; attemptId: string }
  | { type: "rich-formula.evaluate-requested"; attemptId: string }
  | { type: "prompt-content.create-requested"; attemptId: string }
  | { type: "prompt-content.definition-updated"; output: DerivedOutput }
  | { type: "prompt-content.refresh-requested"; attemptId: string }
  | { type: "data-cell.attach-requested"; attemptId: string }
  | { type: "data-cell.refresh-requested"; attemptId: string };
```

`workbook.create` commits revision zero with one explicit Sheet and explicit
initial axis IDs. Trusted create helpers may fill bounded defaults before the
Base is committed; the reducer never creates hidden identity.

`workbook.submit` can create automatic calculation and Rich Formula attempts
in the same transaction. Their IDs are returned in `attemptIds`; an empty list
is valid.

No command contains project ID, user storage scope, table prefix, actor ID,
queue selection, response mode, or a work closure. Project scoping and actor
attribution come from trusted construction/request context.

## Query contracts

```ts
interface SpreadsheetQueryRequest {
  requestId: string;
  query: SpreadsheetQuery;
}

type SpreadsheetQuery =
  | { type: "workbook.list"; cursor?: string;
      lifecycle?: WorkbookHead["lifecycle"] }
  | { type: "workbook.load"; workbookId: string; revision?: number }
  | { type: "workbook.history"; workbookId: string;
      cursor?: string; limit: number }
  | { type: "workbook.attempt"; workbookId: string; attemptId: string }
  | { type: "sheet.grid"; workbookId: string; range: StableRangeRef }
  | { type: "coordinate.resolve"; workbookId: string;
      coordinate: StableCellRef };
```

`workbook.load` resolves the exact immutable Derived Output revision for every
live Prompt Content Cell. A missing `outputId@appliedRevision` is a typed 404;
the loader never substitutes the current output head. Data-backed values are
the exact binding snapshots already accepted into the Workbook revision and do
not require a live Structured Data read during replay.

Grid reads return canonical Cells plus rebuildable projected coordinates. They
do not persist or mint Cell identities for empty/projected coordinates.

## Whole-Cell calculation workflow

Formula Cells settle through one dependency-closed durable calculation
attempt. Automatic mode creates an attempt whenever an accepted mutation
dirties a Formula source or one of its stable local inputs. Manual mode creates
one only through `workbook.calculate.request`.

```text
serial freeze
  -> expand changed inputs to their transitive dependent Formula Cells, then
     include the dependency closure needed to evaluate that target set
  -> freeze Workbook revision and semantic digest
  -> freeze each admitted formula source digest and stable binding manifest
  -> freeze each current local input content/value fingerprint
  -> persist one calculation attempt with the accepted command
  -> dispatch spreadsheet.calculation.compute after commit

concurrent compute
  -> claim the compute-stage receipt
  -> build one immutable project FormulaResolver snapshot
  -> persist its snapshot digest before evaluation
  -> resolve every stored project dependency by bindingId and expose it under
     that formula's stored normalized lookup key; never fall back by name
  -> compose it with collision-proof aliases for frozen Workbook-local
     Cell/range bindings
  -> construct the dependency graph and topologically evaluate acyclic components
  -> for a cyclic component, either produce a deterministic cycle diagnostic
     or run the configured bounded iteration/convergence policy
  -> persist exact Formula wire candidates, diagnostics, observed project
     binding revisions/value digests, and evaluation digests
  -> dispatch spreadsheet.calculation.settle

serial settlement
  -> claim the settle-stage receipt
  -> reload current Workbook
  -> require every selected formula source digest and stable manifest unchanged
  -> require every frozen local dependency content/value fingerprint unchanged
  -> if all guards hold, append all candidate settlements in one ChangeSet
  -> otherwise mark the attempt stale without changing canonical content
```

Checking only the Formula Cell's source is unsafe: an unchanged formula can
have changed inputs. `FormulaSettlementGuard` therefore covers the formula
source, stable local dependency closure, and frozen resolver identity. The
project snapshot is a legitimate point-in-time external input; settlement
records its observed binding revisions and digests rather than pretending to
atomically lock another capability's database.

The candidate batch settles atomically so a downstream Formula cannot expose a
new result calculated from an upstream result that was not adopted. Formula
errors, disabled iteration cycles, and non-convergence are ordinary accepted
diagnostics, while infrastructure failure fails the attempt.

## Rich Formula evaluation workflow

Rich Content Formula atoms use one durable attempt per atom:

```text
serial freeze
  -> automatic discovery in accepted Rich Content, or explicit request
  -> freeze Workbook revision, Cell ID, atom ID, expression and digest
  -> atomically persist attempt (with the authoring ChangeSet when automatic)
  -> dispatch spreadsheet.rich-formula.evaluate.compute

concurrent compute
  -> build the immutable project FormulaResolver snapshot
  -> parse/bind/evaluate the exact Formula/v1 expression
  -> persist resolver digest and Rich Text settlement candidate
  -> dispatch spreadsheet.rich-formula.evaluate.settle

serial settlement
  -> require the same Cell still has a Rich Content source
  -> require the same Formula atom and expression digest
  -> internally apply Rich Text's formula-settlement operation
  -> append a normal Workbook ChangeSet and settle the attempt, or mark stale
```

Settlement never recursively discovers itself as a new expression change.

## Prompt Content workflows

Every Prompt Content Cell has one dedicated Derived Output. It displays the
exact plain-text output revision and does not duplicate that output as
`ComputedCellSettlement` or project it over a range.

Dedicated creation may fill an empty coordinate or replace an existing Cell's
content. Every creation gets a fresh output, even when that Cell previously
held Prompt Content. Local ownership can therefore retain multiple historical
outputs for one Cell ID, while enforcing at most one `pending` or `attached`
output at a time. Definition update and refresh retain the currently attached
output ID.

### Dedicated creation

```text
serial freeze
  -> validate expected revision and existing/empty-coordinate target
  -> validate permanent Cell identity and exact prompt definition
  -> atomically persist prompt-content-create attempt + command receipt
  -> dispatch spreadsheet.prompt-content.create.compute

concurrent compute
  -> idempotently declare one Derived Output for the attempt
  -> register local ownership as pending
  -> run keyed initial refresh and persist exact positive head revision
  -> dispatch spreadsheet.prompt-content.create.settle

serial settlement
  -> revalidate the frozen target and Cell identity
  -> internally create/set Prompt Content with outputId@revision
  -> append normal ChangeSet, mark ownership attached, settle attempt
  -> or mark stale/failed and make pending ownership historical
```

Generic Cell operations cannot bypass this workflow or attach an existing
output. Derived Output declaration/refresh use stable idempotency keys, so
recovery cannot create multiple outputs for one Cell.

### Definition update and refresh

Definition update uses the Document/Slide delegated-claim pattern. Spreadsheet
first reserves `(workbookId, requestId, requestDigest)` and freezes the Cell's
dedicated output ID. It then calls keyed
`DerivedOutputs.updateDefinition`. Completion stores the typed command receipt
and completes the claim. No Workbook ChangeSet occurs until a revision is
adopted, and Derived Outputs is authoritative for definition-update Activity.

Refresh freezes `(sheetId, cellId, outputId, appliedRevision,
workbookRevision)`. Concurrent compute calls keyed
`DerivedOutputs.refresh`. Serial settlement adopts a newer revision only if
the Cell still names the exact frozen output and applied revision. Otherwise
the attempt is stale. Spreadsheet never deletes or garbage-collects a Derived
Output.

## Data-backed Cell workflows

Data-backed Cells use the injected project Formula resolver rather than a
concrete Structured Data persistence dependency. The caller supplies the
stable Formula binding ID, not a display name, kind assertion, revision, or
value.

Canonical `DataCellSource` contains only `bindingId`, `tracking`, and a digest
of that source identity. The exact accepted Formula wire value, owner revision,
and value digest live in `ComputedCellSettlement`. A scalar has no projection
orientation; list/record/table content requires one and derives its spill
projection from the settlement.

### Attach

```text
serial freeze
  -> validate expected Workbook revision and target Cell/coordinate
  -> persist data-cell-attach attempt with stable binding ID, tracking policy,
     and orientation
  -> dispatch spreadsheet.data.attach.compute

concurrent compute
  -> build one immutable project FormulaResolver snapshot
  -> find the exact stable binding ID
  -> require a wire-serializable non-function value
  -> require orientation for table/record/list and forbid it for a scalar
  -> persist owner revision, value digest, resolver digest, and wire value
  -> dispatch spreadsheet.data.attach.settle

serial settlement
  -> revalidate the frozen Cell/coordinate precondition
  -> adopt the exact binding snapshot and rebuild its range projection
  -> append a normal ChangeSet or mark stale
```

### Refresh

Refresh freezes the Cell's stable binding ID, owner revision, value digest,
content fingerprint, and Workbook revision. Compute finds the same binding ID in
a new resolver snapshot; rename cannot retarget it. Settlement requires the
same frozen Cell content. `follow-head` may adopt a newer exact settlement;
`pinned` rejects refresh and remains on its accepted value until explicit
reattachment. An unchanged owner revision/value digest terminates without a
ChangeSet.

`data.promote` is not an initial command. Promotion creates a Structured Data
entry in another database, while the current `StructuredData.declare` contract
has no idempotency key. Presenting it as crash-safe would be false. Promotion
can be added only after integration supplies a narrow keyed declaration port;
then it must use a durable declare/settle attempt like Prompt creation.

## Internal Jobs and recovery

Spreadsheet receives only a typed dispatch seam:

```ts
interface InternalJobsRuntime<TIntent extends { type: string }> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}

type SpreadsheetInternalJobIntent =
  | { type: "spreadsheet.compact"; workbookId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.calculation.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.calculation.settle"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.rich-formula.evaluate.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.rich-formula.evaluate.settle"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.prompt-content.create.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.prompt-content.create.settle"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.prompt-content.refresh.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.prompt-content.refresh.settle"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.data.attach.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.data.attach.settle"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.data.refresh.compute"; attemptId: string;
      idempotencyKey: string }
  | { type: "spreadsheet.data.refresh.settle"; attemptId: string;
      idempotencyKey: string };
```

The capability chooses neither queue nor raw Job closure. Job wiring maps
compute intents to the concurrent queue and compaction/settlement intents to
the serial queue. Dispatch occurs only after the authoritative transaction
commits and returns after scheduler admission, not Job completion.

Queue-capacity failures receive one deduplicated capped-backoff redrive per
intent key. Startup recovery resets interrupted stage claims, lists
non-terminal attempts, and redispatches the correct compute or settle stage.
Stage receipts make repeated execution harmless. A dispatch failure never
turns an already accepted mutation into an unaccepted one.

## Idempotency and compensation

The dispatcher hashes the complete public command, including authored formula
text before normalization. Receipts are scoped by `(workbookId, requestId)`.
An identical retry returns the exact stored typed result; divergent reuse
returns `idempotency_mismatch`.

Mutation receipts are atomic with ChangeSets and any automatically discovered
attempts. Async request receipts are atomic with their attempt. Prompt
definition claims share the request-ID reservation namespace, preventing a
pending cross-database call from being reused for another command.

Compensation requires the exact expected head, retained target ChangeSet, and a
continuous retained tail from target through head. It rejects touched-ID
intersection and appends the stored inverse batch as a new ChangeSet. Redo
compensates the ChangeSet that performed undo. Missing proof is a conflict,
never a best-effort edit.

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
  compensation?: { intent: "undo" | "redo";
      targetChangeSetId: string };
  semanticDigest: string;
  createdAt: string;
}
```

## Endpoints and error mapping

| Method | Path | Job | Queue | Response |
|---|---|---|---|---|
| `POST` | `/spreadsheets/command` | `spreadsheets.command.v1` | serial | inline |
| `POST` | `/spreadsheets/query` | `spreadsheets.query.v1` | concurrent | inline |

Creation returns `201`; durable compute requests return `202`; other success
returns `200`. Strict validation maps to `400`, missing Workbook/Cell/attempt/
stable binding/exact output revision to `404`, revision/idempotency/source/
definition/compensation conflicts to `409`, pruned history to `410`, and an
unexpected failure to a safe generic `500`.

Wire decoders reject unknown fields recursively, invalid discriminants,
non-finite sizes, duplicate or incomplete order members, malformed Rich Content, raw
formula payloads that bypass admission, duplicate IDs, non-rectangular ranges,
overlapping spans, excessive nesting/counts, and configured Formula/source
limits before the capability runtime executes.

## Activity boundary

Activity represents accepted domain facts, not endpoint calls. Rejections,
identical retries, compute stages, unchanged refreshes, and definition-only
Derived Output updates produce no Spreadsheet fact.

Every Workbook creation, accepted Workbook mutation, and compensation writes
one fact to the local activity outbox in the same transaction:

```ts
interface SpreadsheetCommittedFact {
  factId: string;
  kind: "spreadsheet.created" | "spreadsheet.changed" |
        "spreadsheet.compensated";
  workbookId: string;
  revision: number;
  changeSetId?: string;
  actorId?: string; // trusted attribution, never storage scope
  origin: "interactive" | "agent" | "automation";
  operationTypes: string[];
  semanticDigest: string;
  occurredAt: string;
}
```

Spreadsheet has no Activity dependency. A future idempotent publisher consumes
the outbox through integration wiring. An Activity undo endpoint routes back
to `workbook.compensate` through the shared compensation router, avoiding a
construction cycle.
