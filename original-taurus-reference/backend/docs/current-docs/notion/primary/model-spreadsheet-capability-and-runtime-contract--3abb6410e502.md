---
title: "Model — Spreadsheet Capability & Runtime Contract"
notion_page_id: "3abb6410e5028179a844c0af77b21ffe"
notion_url: "https://app.notion.com/3abb6410e5028179a844c0af77b21ffe"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-28 21:13:21Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Spreadsheet Capability & Runtime Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

The Spreadsheet capability is a project-scoped, collaborative resource for sparse grid data, formulas, prompts, formatting, and canvas overlays. This specification is a standalone implementation contract for a coding agent. It adopts the same runtime invariants as the current Taurus Omega Document capability: immutable submissions, stable-ID operations, exact revision checks, replayable bases, append-only ChangeSets, author-scoped undo/redo, and transactional persistence in the shared SQLite store. The governing runtime is the [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md); the concurrency reference is the current [Document submission service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/service_submit.go).
## 1. Product contract
- The user-facing resource is **Spreadsheet**, not Workbook.
- A Spreadsheet contains one sparse grid. It does not contain nested sheets or tabs.
- Rows, columns, cells, named ranges, spills, and overlays have stable IDs.
- A range is an address value, not a durable child entity, unless it is promoted to a named range.
- Cells may contain literals, formulas, or prompts.
- Formula results use the existing Formula value algebra: `null`, `number`, `text`, `logic`, `list`, `record`, `table`, and `function`.
- Images and charts are canvas overlays anchored to the grid. They neither occupy cells nor block structured-value spills.
- The canonical state is deterministic and replayable. A1 notation, rendered strings, chart pixels, and transient prompt progress are projections rather than authority.
- Human editors and AI agents use the same typed operation surface. Neither may write storage records directly.
## 2. Runtime placement
Implement the capability as a leaf package:
```plain text
core/capability/spreadsheet/
  model.go
  operations.go
  submission.go
  service.go
  service_submit.go
  service_history.go
  service_rebase.go
  validation.go
  errors.go
  memory_store.go

core/platform/storage/sqlite/
  sqlite_spreadsheet.go

core/transport/httpapi/
  spreadsheet_handlers.go

core/wiring/
  spreadsheet.go
```
The capability:
1. receives an already-authorized `Scope{ProjectID}` from transport;
2. repeats project scope in every store query;
3. owns the Spreadsheet aggregate and its ChangeSets;
4. depends only on narrow ports for Formula evaluation, file metadata, activity, job enqueueing, and resource-catalog registration;
5. does not import another capability's service package;
6. exposes reader and mutator interfaces so wiring can adapt it into search, activity, agent, and resource-family consumers.
Use concurrent inline dispatch for reads and low-contention projections, serial inline dispatch keyed by `SpreadsheetID` for mutations, and the durable job pool for imports, broad recalculation, prompt resolution, and base rebasing. The keyed lock reduces contention; the revision compare-and-swap in SQLite remains the correctness boundary.
## 3. Aggregate and base model
```go
type Spreadsheet struct {
    ID          string
    ProjectID   string
    Name        string
    Base        SpreadsheetBase
    CreatorID   string
    CreatorName string
    CreatedAt   time.Time
    UpdatedAt   time.Time
    Revision    int64 // latest accepted ChangeSet sequence
    BaseSeq     int64 // highest sequence folded into Base
    Lifecycle   string
    TrashedAt   *time.Time
}

type SpreadsheetBase struct {
    Rows                []SpreadsheetRow
    Columns             []SpreadsheetColumn
    Cells               []Cell
    NamedRanges         []NamedRange
    Spills              []SpillProjection
    Overlays            []Overlay
    Rules               []GridRule
    Freeze              FreezePane
    DefaultPresentation CellPresentation
    Calculation         CalculationPolicy
}
```
`SpreadsheetBase` is a compact snapshot at `BaseSeq`. Logical reads resolve it with all later ChangeSets through `Revision`. Rebase folds pending ChangeSets into a new Base without changing the logical `Revision`.
### 3.1 Axes
```go
type SpreadsheetRow struct {
    ID       string
    Rank     string
    HeightPX int32
    Hidden   bool
}

type SpreadsheetColumn struct {
    ID      string
    Rank    string
    WidthPX int32
    Hidden  bool
}
```
Rows and columns are ordered by deterministic rank strings and then stable ID. Insert and move operations specify an `AfterID` anchor. The server assigns IDs and final ranks. Deleted axes are tombstoned in history so stale submissions can be rejected precisely.
External A1 addresses are resolved against a particular revision. Stored operations always use stable `RowID` and `ColumnID`. A1 is never persisted as the sole identity of a cell.
### 3.2 Cells
```go
type Cell struct {
    ID               string
    RowID            string
    ColumnID         string
    Kind             CellKind // literal | formula | prompt
    Value            CellValue
    LastGoodValue    CellValue
    Formula          *FormulaBinding
    Prompt           *PromptBinding
    Display          CellDisplay
    Presentation     CellPresentation
    Evidence         []EvidenceRef
    ValueRevision    int64
    DisplayRevision  int64
}

type FormulaBinding struct {
    Expression       string
    Dependencies     []CellOrNameRef
    State            string // ready | evaluating | error
    Diagnostic       *CellDiagnostic
    EvaluatedAt      *time.Time
    EvaluationToken  string
}

type PromptBinding struct {
    Source            SpreadsheetRichContent
    State             string // idle | queued | running | ready | error
    Diagnostic        *CellDiagnostic
    EvaluationToken   string
    GeneratedAt       *time.Time
}
```
The cell set is sparse: an absent cell means the default empty state. A cell is persisted only when it has a value, formula, prompt, presentation override, evidence, or stable identity referenced elsewhere.
Formula failures are diagnostics, not a ninth Formula value kind. `LastGoodValue` implements stale-never-empty behavior: a failed refresh preserves the last accepted result while exposing an error state. Function values are persisted by their source binding and reconstructed through Formula evaluation; the Formula runtime's display-only function JSON descriptor is not treated as a round-trip value.
`SpreadsheetRichContent` is owned by the Spreadsheet capability. It deliberately mirrors the useful atom/mark semantics of Documents, but Spreadsheet does not import the Document domain. The wiring layer may translate between these contracts when a cross-resource feature requires it.
## 4. Addressing, ranges, and names
```go
type CellRef struct {
    RowID    string
    ColumnID string
}

type RangeRef struct {
    Start CellRef
    End   CellRef
}

type NamedRange struct {
    ID   string
    Name string
    Ref  RangeRef
}
```
A `RangeRef` is normalized to the current row and column order when evaluated. It is inclusive at both ends. It may be used in commands, formulas, data rules, charts, and API reads, but it has no independent lifecycle. `NamedRange` is durable because it has identity, a project-visible name, and references from formulas or overlays.
Range reads accept either stable references or A1 notation plus `atRevision`. The response returns resolved stable IDs and the canonical revision. Stale clients therefore know exactly which grid they addressed.
## 5. Structured values and spills
Formula `list`, `record`, and `table` values may project into a rectangular spill:
```go
type SpillProjection struct {
    ID             string
    SourceCellID   string
    Anchor         CellRef
    RowCount       int32
    ColumnCount    int32
    DerivedCells   []DerivedCell
    SourceRevision int64
}

type DerivedCell struct {
    RowID    string
    ColumnID string
    Value    CellValue
}
```
Spill cells are derived and read-only. A write to one returns a conflict naming the source cell and spill. If an occupied canonical cell or another spill blocks the proposed rectangle, the source cell retains `LastGoodValue` and receives a spill diagnostic. Nested structured values remain a value inside a projected cell; they do not recursively spill.
`MaterializeSpill` converts the current projection into ordinary literal cells in one ChangeSet and removes the spill. This is the explicit boundary between derived and user-owned data.
## 6. Overlays
Charts and images live in a canvas layer above the grid:
```go
type Overlay struct {
    ID      string
    Kind    string // chart | image
    Bounds  GridBounds
    ZRank   string
    Locked  bool
    Hidden  bool
    Data    OverlayData
}

type GridBounds struct {
    Start       CellRef
    End         CellRef
    StartOffset PointPX
    EndOffset   PointPX
}

type ChartOverlayData struct {
    Binding ChartBinding // cell | range | named_range
    Spec    ChartSpec
    AltText string
}

type ImageOverlayData struct {
    FileID  string
    Fit     string
    Crop    Crop
    AltText string
}
```
Anchoring uses stable row/column IDs plus pixel offsets. Axis insertion and movement therefore preserve the overlay's semantic location. Axis deletion clamps the affected edge to the nearest surviving axis and records that resolution in the ChangeSet summary.
Overlays do not own cells, alter cell values, prevent spills, or appear in copy/paste unless the command explicitly includes overlays. Chart data reads through a binding at a specified revision. Rendering is derived and may be cached outside the canonical aggregate.
## 7. Change submission and history
```go
type SpreadsheetChangeSubmission struct {
    SubmissionID    string
    ExpectedRevision int64
    Operations      []SpreadsheetOperation
}

type SpreadsheetChangeSet struct {
    ID               string
    SpreadsheetID    string
    AuthorID         string
    AuthorName       string
    SubmissionID     string
    AuthoredRevision int64
    PriorRevision    int64
    Seq              int64
    CreatedAt        time.Time
    Operations       []SpreadsheetOperation
    UndoOf           string
    RedoOf           string
    Summary          SpreadsheetChangeSummary

    SubmissionHash   string
    InverseOps       []SpreadsheetOperation
}
```
The server computes a canonical fingerprint from the Spreadsheet ID, expected revision, author, and normalized operations. Reusing a `SubmissionID` with the same fingerprint returns the original ChangeSet. Reusing it with a different fingerprint is a conflict.
Fresh submissions require `ExpectedRevision == Revision`. A distinct stale submission may be admitted only when retained semantic footprints prove it is disjoint from every intervening ChangeSet. Missing or ambiguous proof fails closed.
Each ChangeSet stores exact inverse operations generated from the pre-change snapshot. Undo and redo append new current-head ChangeSets, are author-scoped by default, and never rewrite history.
## 8. Operation vocabulary
Use one tagged union with validated typed payloads:
<table header-row="true">
<tr>
<td>Area</td>
<td>Operations</td>
</tr>
<tr>
<td>Spreadsheet</td>
<td>`rename_spreadsheet`, `set_calculation_policy`, `set_freeze_pane`</td>
</tr>
<tr>
<td>Rows</td>
<td>`insert_rows`, `delete_rows`, `move_rows`, `resize_rows`, `set_rows_hidden`</td>
</tr>
<tr>
<td>Columns</td>
<td>`insert_columns`, `delete_columns`, `move_columns`, `resize_columns`, `set_columns_hidden`</td>
</tr>
<tr>
<td>Cells</td>
<td>`set_cell_literal`, `set_cell_formula`, `set_cell_prompt`, `clear_cells`</td>
</tr>
<tr>
<td>Ranges</td>
<td>`paste_range`, `fill_range`, `set_range_presentation`, `clear_range_presentation`</td>
</tr>
<tr>
<td>Names</td>
<td>`create_named_range`, `rename_named_range`, `set_named_range_ref`, `delete_named_range`</td>
</tr>
<tr>
<td>Spills</td>
<td>`materialize_spill`</td>
</tr>
<tr>
<td>Overlays</td>
<td>`create_overlay`, `update_overlay`, `move_overlay`, `reorder_overlay`, `delete_overlay`</td>
</tr>
<tr>
<td>Rules</td>
<td>`create_rule`, `update_rule`, `delete_rule`</td>
</tr>
<tr>
<td>Derived results</td>
<td>`apply_formula_result`, `apply_prompt_result`, `apply_import_result`</td>
</tr>
</table>
Bulk commands expand to a bounded canonical operation list before commit. The server rejects a submission that exceeds configured operation, cell, or payload limits and directs the caller to the durable import job.
Operations address stable IDs. They never say “row 3” or “cell B7” without also carrying the revision at which that address was resolved.
## 9. Conflict footprints
Every operation produces a semantic footprint:
```go
type SpreadsheetFootprint struct {
    Metadata      bool
    RowIDs        []string
    ColumnIDs     []string
    CellIDs       []string
    Rectangles    []StableRectangle
    NamedRangeIDs []string
    OverlayIDs    []string
    RuleIDs       []string
    Structural    bool
}
```
- Two edits to disjoint stable cells may rebase.
- Presentation and value changes to the same cell conflict unless an operation explicitly declares mergeable fields.
- Axis structural changes conflict with stale A1-dependent or range-order-dependent commands.
- Concurrent inserts after the same stable anchor are accepted and ordered deterministically by server-assigned rank and ID.
- Edits to different overlays or named ranges may rebase.
- A formula or prompt result is accepted only when its evaluation token, source revision, and dependency snapshot still match.
- Deleting an axis conflicts with any stale edit whose target or range includes that axis.
Footprints must be durably retained for the configured stale-rebase window. Once the proof window has been compacted away, stale changes are rejected rather than guessed.
## 10. Formula and prompt integration
Declare behavior ports in the Spreadsheet package:
```go
type FormulaEvaluator interface {
    Evaluate(ctx context.Context, scope Scope, req FormulaRequest) (FormulaResult, error)
}

type PromptResolver interface {
    Resolve(ctx context.Context, scope Scope, req PromptRequest) (PromptResult, error)
}

type FileReader interface {
    GetFile(ctx context.Context, scope Scope, fileID string) (FileMetadata, error)
}
```
Formula evaluation snapshots the Formula Name Manager once per calculation job. The job records name versions or hashes, referenced cell revisions, and an evaluation token. Its result returns through `apply_formula_result`; it never mutates a cell outside the ChangeSet path.
Recalculate the smallest dependency closure inline when it is safely bounded. Enqueue a durable job for broad dependency graphs, prompt resolution, import, or chart data precomputation. Jobs are at-least-once and must use stable job/submission IDs. A stale result is harmless because the apply operation verifies its token and source snapshot.
The Spreadsheet owns cell dependency metadata. Formula owns parsing, evaluation, value semantics, and project names. Wiring supplies the adapter; neither leaf capability imports the other's service.
## 11. Persistence
Use the shared pure-Go SQLite connection with WAL mode. The recommended schema is a normalized base projection plus append-only log:
<table header-row="true">
<tr>
<td>Table</td>
<td>Purpose</td>
</tr>
<tr>
<td>`spreadsheets`</td>
<td>Aggregate identity, project scope, metadata, `revision`, `base_seq`, lifecycle</td>
</tr>
<tr>
<td>`spreadsheet_base_rows`</td>
<td>Rebased row projection keyed by spreadsheet and row ID</td>
</tr>
<tr>
<td>`spreadsheet_base_columns`</td>
<td>Rebased column projection keyed by spreadsheet and column ID</td>
</tr>
<tr>
<td>`spreadsheet_base_cells`</td>
<td>Sparse canonical cells keyed by spreadsheet and cell ID; unique row/column</td>
</tr>
<tr>
<td>`spreadsheet_base_named_ranges`</td>
<td>Named ranges</td>
</tr>
<tr>
<td>`spreadsheet_base_spills`</td>
<td>Current derived spill projections</td>
</tr>
<tr>
<td>`spreadsheet_base_overlays`</td>
<td>Chart/image overlays</td>
</tr>
<tr>
<td>`spreadsheet_base_rules`</td>
<td>Data and presentation rules</td>
</tr>
<tr>
<td>`spreadsheet_change_sets`</td>
<td>Immutable submission metadata, ops, inverse ops, footprint, sequence</td>
</tr>
</table>
Required constraints and indexes:
- unique `(spreadsheet_id, seq)`;
- unique `(spreadsheet_id, submission_id)`;
- unique `(spreadsheet_id, row_id, column_id)` for canonical cells;
- project ID included in every lookup path;
- range-window indexes on row rank and column rank;
- foreign keys from all base rows to the parent aggregate;
- compare-and-swap update `WHERE project_id=? AND id=? AND revision=?`.
Append the ChangeSet, advance `revision`, and write the user-visible Activity fact in one transaction. The in-memory store must implement identical idempotency, scope, revision, and conflict semantics.
Window reads may load only requested rows, columns, cells, and overlays, but they must also apply all pending structural ChangeSets plus pending operations whose footprints intersect the window. Rebase materializes a new normalized Base transactionally and advances only `base_seq`.
## 12. Service and API surface
```go
type Reader interface {
    Get(ctx context.Context, scope Scope, id string) (SpreadsheetView, error)
    ReadRange(ctx context.Context, scope Scope, id string, q RangeQuery) (RangeView, error)
    History(ctx context.Context, scope Scope, id string, q HistoryQuery) ([]SpreadsheetChangeSet, error)
}

type Mutator interface {
    Create(ctx context.Context, scope Scope, cmd CreateSpreadsheet) (Spreadsheet, error)
    Submit(ctx context.Context, scope Scope, id string, sub SpreadsheetChangeSubmission) (SpreadsheetChangeSet, error)
    Undo(ctx context.Context, scope Scope, id string, cmd UndoCommand) (SpreadsheetChangeSet, error)
    Redo(ctx context.Context, scope Scope, id string, cmd RedoCommand) (SpreadsheetChangeSet, error)
}
```
Canonical HTTP resources:
- `POST /spreadsheets`
- `GET /spreadsheets/{id}`
- `GET /spreadsheets/{id}/range`
- `POST /spreadsheets/{id}/changes`
- `GET /spreadsheets/{id}/changes`
- `POST /spreadsheets/{id}/undo`
- `POST /spreadsheets/{id}/redo`
- `POST /spreadsheets/{id}/recalculate`
- `POST /spreadsheets/{id}/import`
Responses include `revision`, `baseSeq`, stable IDs, and projection metadata. Conflict responses include the current revision, conflicting ChangeSet IDs, and machine-readable footprint reasons.
## 13. Agent operation surface
Expose bounded functions that compile to the same submissions:
- inspect spreadsheet metadata and a bounded range;
- resolve A1 to stable references at a revision;
- set literals, formulas, or prompts;
- paste/fill a bounded range;
- create and update named ranges;
- create and update chart/image overlays;
- request calculation and inspect diagnostics;
- submit, undo, and redo changes.
Agent reads must be explicit about revision and window. Agent writes require a stable `SubmissionID` and `ExpectedRevision`. Large requests become durable jobs. This lets a coding or product agent manipulate the resource without a second privileged mutation path.
## 14. Validation and error contract
Reject:
- references to missing or wrong-project IDs;
- duplicate row/column cell occupancy;
- invalid range ordering after revision resolution;
- writes to derived spill cells;
- overlapping spills;
- overlay bounds with no surviving axis;
- unsupported Formula value encodings;
- invalid names or case-insensitive name collisions;
- result applications with stale tokens or dependency snapshots;
- oversized synchronous operations.
Use stable error codes such as `spreadsheet_not_found`, `revision_conflict`, `submission_reused`, `invalid_operation`, `spill_blocked`, `derived_cell_read_only`, `formula_result_stale`, and `limit_exceeded`.
## 15. Translation-ready Go contract
The earlier sections define the domain. This section removes the remaining implementation choices by showing the recommended Go and SQLite shapes. Names may move between files, but their semantics and wire fields should remain stable.
### 15.1 Capability-owned value and rich-text types
Under the [Omega dependency rule](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md), capabilities never import one another. Spreadsheet therefore does not import `core/capability/formula` or `core/capability/document`. It owns durable contract types that wiring converts to and from Formula and other resources.
```go
type CellValueKind string

const (
    ValueNull     CellValueKind = "null"
    ValueNumber   CellValueKind = "number"
    ValueText     CellValueKind = "text"
    ValueLogic    CellValueKind = "logic"
    ValueList     CellValueKind = "list"
    ValueRecord   CellValueKind = "record"
    ValueTable    CellValueKind = "table"
    ValueFunction CellValueKind = "function"
)

// CellValue is Spreadsheet's durable copy of the Formula value algebra.
// Number is the exact rational spelling accepted by Formula; never float64.
// List, record, and table share Fields + Rows and must obey Formula's shapes.
type CellValue struct {
    Kind     CellValueKind `json:"kind"`
    Number   string        `json:"number,omitempty"`
    Text     string        `json:"text,omitempty"`
    Logic    *bool         `json:"logic,omitempty"`
    Fields   []string      `json:"fields,omitempty"`
    Rows     [][]CellValue `json:"rows,omitempty"`
    Function *FunctionRef  `json:"function,omitempty"`
}

type FunctionRef struct {
    NameID          string `json:"nameId,omitempty"`
    Source          string `json:"source"`
    LanguageVersion string `json:"languageVersion"`
}

type SpreadsheetRichContent struct {
    Blocks []SpreadsheetTextBlock `json:"blocks"`
}

type SpreadsheetTextBlock struct {
    ID    string                    `json:"id"`
    Runs  []SpreadsheetTextRun      `json:"runs"`
    Marks []SpreadsheetTextMark     `json:"marks,omitempty"`
    Style SpreadsheetParagraphStyle `json:"style"`
}

type SpreadsheetTextRun struct {
    ID    string                `json:"id"`
    Atoms []SpreadsheetTextAtom `json:"atoms"`
}

type SpreadsheetTextAtom struct {
    ID   string                  `json:"id"`
    Kind string                  `json:"kind"` // text | formula
    Text string                  `json:"text"`
    Data SpreadsheetTextAtomData `json:"data,omitempty"`
}

type SpreadsheetTextAtomData interface {
    textAtomKind() string
}

type SpreadsheetFormulaAtomData struct {
    Expression   string           `json:"expression"`
    Result       CellValue        `json:"result"`
    Dependencies []CellOrNameRef  `json:"dependencies,omitempty"`
    State        string           `json:"state"`
    Diagnostic   *CellDiagnostic  `json:"diagnostic,omitempty"`
}

func (SpreadsheetFormulaAtomData) textAtomKind() string { return "formula" }

type IDSource interface {
    New() string
}

type Enqueuer interface {
    Enqueue(ctx context.Context, request JobRequest) (Job, error)
}
```
This is a shared **semantic contract**, not a shared Go package. A Formula wiring adapter converts `formula.Value` to `CellValue` losslessly. A Document or Slides adapter converts rich text at the boundary. The Spreadsheet package contains no Formula parser, evaluator, Name Manager, or Document behavior.
`CellValue.Validate` must enforce exactly one payload for the selected kind, exact-number syntax, rectangular structured rows, list shape of one field named `value`, record shape of one row, and bounded recursive size. A function persists source plus language version because the current Formula function descriptor is not itself round-trip decodable.
### 15.2 Service construction
```go
type Service struct {
    store            Store
    formulaEvaluator FormulaEvaluator
    promptResolver   PromptResolver
    fileReader       FileReader
    enqueuer         Enqueuer
    ids              IDSource
    now              func() time.Time
    rebaseThreshold  int
    historyLimit     int
}

type Options struct {
    FormulaEvaluator FormulaEvaluator
    PromptResolver   PromptResolver
    FileReader       FileReader
    Enqueuer         Enqueuer
    IDSource         IDSource
    RebaseThreshold  int
    HistoryLimit     int
}

func New(store Store, opts Options) (*Service, error) {
    if store == nil {
        return nil, errors.New("spreadsheet: store is required")
    }
    if opts.IDSource == nil {
        opts.IDSource = CryptoIDSource{}
    }
    if opts.RebaseThreshold < 1 {
        opts.RebaseThreshold = DefaultRebaseThreshold
    }
    return &Service{
        store:            store,
        formulaEvaluator: opts.FormulaEvaluator,
        promptResolver:   opts.PromptResolver,
        fileReader:       opts.FileReader,
        enqueuer:         opts.Enqueuer,
        ids:              opts.IDSource,
        now:              time.Now,
        rebaseThreshold:  opts.RebaseThreshold,
        historyLimit:     opts.HistoryLimit,
    }, nil
}
```
Nil Formula, prompt, File, or job ports disable only the corresponding optional operation and return a stable “not configured” error. Core literal editing, history, and reads remain usable in focused tests.
### 15.3 Typed operation envelope
Use an explicit discriminated envelope. The wire form is `{type, data}`; decoding chooses the concrete Spreadsheet-owned payload. Do not expose `map[string]any` to service code.
```go
type OperationType string

type SpreadsheetOperation struct {
    Type OperationType           `json:"type"`
    Data SpreadsheetOperationData `json:"data"`
}

type SpreadsheetOperationData interface {
    operationType() OperationType
}

const (
    OpRenameSpreadsheet      OperationType = "rename_spreadsheet"
    OpSetCalculationPolicy   OperationType = "set_calculation_policy"
    OpSetFreezePane          OperationType = "set_freeze_pane"
    OpInsertRows           OperationType = "insert_rows"
    OpDeleteRows           OperationType = "delete_rows"
    OpMoveRows             OperationType = "move_rows"
    OpResizeRows           OperationType = "resize_rows"
    OpSetRowsHidden        OperationType = "set_rows_hidden"
    OpInsertColumns        OperationType = "insert_columns"
    OpDeleteColumns        OperationType = "delete_columns"
    OpMoveColumns          OperationType = "move_columns"
    OpResizeColumns        OperationType = "resize_columns"
    OpSetColumnsHidden     OperationType = "set_columns_hidden"
    OpSetCellLiteral       OperationType = "set_cell_literal"
    OpSetCellFormula       OperationType = "set_cell_formula"
    OpSetCellPrompt        OperationType = "set_cell_prompt"
    OpClearCells           OperationType = "clear_cells"
    OpPasteRange             OperationType = "paste_range"
    OpFillRange              OperationType = "fill_range"
    OpSetRangePresentation OperationType = "set_range_presentation"
    OpClearRangePresentation OperationType = "clear_range_presentation"
    OpCreateNamedRange       OperationType = "create_named_range"
    OpUpdateNamedRange       OperationType = "update_named_range"
    OpDeleteNamedRange       OperationType = "delete_named_range"
    OpCreateOverlay        OperationType = "create_overlay"
    OpUpdateOverlay        OperationType = "update_overlay"
    OpMoveOverlay            OperationType = "move_overlay"
    OpReorderOverlay         OperationType = "reorder_overlay"
    OpDeleteOverlay        OperationType = "delete_overlay"
    OpMaterializeSpill     OperationType = "materialize_spill"
    OpCreateRule             OperationType = "create_rule"
    OpUpdateRule             OperationType = "update_rule"
    OpDeleteRule             OperationType = "delete_rule"
    OpApplyFormulaResult   OperationType = "apply_formula_result"
    OpApplyPromptResult    OperationType = "apply_prompt_result"
    OpApplyImportResult      OperationType = "apply_import_result"
)

type AxisInsert struct {
    IDs     []string `json:"ids,omitempty"` // empty on client; server fills
    AfterID string   `json:"afterId,omitempty"`
    Count   int      `json:"count"`
}

type InsertRowsOp struct {
    AxisInsert
}

func (InsertRowsOp) operationType() OperationType { return OpInsertRows }

type InsertColumnsOp struct {
    AxisInsert
}

func (InsertColumnsOp) operationType() OperationType { return OpInsertColumns }

type AxisDelete struct {
    IDs []string `json:"ids"`
}

type DeleteRowsOp struct {
    AxisDelete
}

func (DeleteRowsOp) operationType() OperationType { return OpDeleteRows }

type DeleteColumnsOp struct {
    AxisDelete
}

func (DeleteColumnsOp) operationType() OperationType { return OpDeleteColumns }

type SetCellLiteralOp struct {
    CellID   string    `json:"cellId,omitempty"`
    RowID    string    `json:"rowId"`
    ColumnID string    `json:"columnId"`
    Value    CellValue `json:"value"`
}

func (SetCellLiteralOp) operationType() OperationType { return OpSetCellLiteral }

type SetCellFormulaOp struct {
    CellID   string `json:"cellId,omitempty"`
    RowID    string `json:"rowId"`
    ColumnID string `json:"columnId"`
    Expression string `json:"expression"`
}

func (SetCellFormulaOp) operationType() OperationType { return OpSetCellFormula }

type SetCellPromptOp struct {
    CellID      string                 `json:"cellId,omitempty"`
    RowID       string                 `json:"rowId"`
    ColumnID    string                 `json:"columnId"`
    Instruction SpreadsheetRichContent `json:"instruction"`
}

func (SetCellPromptOp) operationType() OperationType { return OpSetCellPrompt }

type ClearCellsOp struct {
    Range        RangeRef `json:"range"`
    ClearValue   bool     `json:"clearValue"`
    ClearDisplay bool     `json:"clearDisplay"`
    ClearStyle   bool     `json:"clearStyle"`
}

func (ClearCellsOp) operationType() OperationType { return OpClearCells }

type CreateNamedRangeOp struct {
    ID   string   `json:"id,omitempty"`
    Name string   `json:"name"`
    Ref  RangeRef `json:"ref"`
}

func (CreateNamedRangeOp) operationType() OperationType { return OpCreateNamedRange }

type UpdateNamedRangeOp struct {
    ID   string   `json:"id"`
    Name string   `json:"name"`
    Ref  RangeRef `json:"ref"`
}

func (UpdateNamedRangeOp) operationType() OperationType { return OpUpdateNamedRange }

type DeleteNamedRangeOp struct {
    ID string `json:"id"`
}

func (DeleteNamedRangeOp) operationType() OperationType { return OpDeleteNamedRange }

type CreateOverlayOp struct {
    Overlay Overlay `json:"overlay"`
}

func (CreateOverlayOp) operationType() OperationType { return OpCreateOverlay }

type ApplyFormulaResultOp struct {
    CellID            string         `json:"cellId"`
    EvaluationToken   string         `json:"evaluationToken"`
    SourceRevision    int64          `json:"sourceRevision"`
    DependencyDigest  string         `json:"dependencyDigest"`
    Value             CellValue      `json:"value"`
    Diagnostic        *CellDiagnostic `json:"diagnostic,omitempty"`
}

func (ApplyFormulaResultOp) operationType() OperationType {
    return OpApplyFormulaResult
}
```
The row and column payloads embed shared field shapes but remain different concrete types, so the discriminator can never disagree with the payload. The payload declarations above cover the operations with the most important invariants; every constant in the closed vocabulary must receive an equally concrete Spreadsheet-owned payload before its handler is enabled. In production, implement `UnmarshalJSON` on `SpreadsheetOperation` with a closed switch over `Type`, just as the current Document capability decodes typed atom and block data. Unknown operation types fail closed.
### 15.4 Pure apply function
Mutation is a pure transformation before persistence:
```go
func ApplyOperations(
    before SpreadsheetBase,
    ops []SpreadsheetOperation,
    ids IDSource,
) (after SpreadsheetBase, inverse []SpreadsheetOperation, fp SpreadsheetFootprint, err error) {
    after = before.DeepCopy()

    for _, op := range ops {
        if err = validateOperationShape(op); err != nil {
            return SpreadsheetBase{}, nil, SpreadsheetFootprint{}, err
        }

        var opInverse []SpreadsheetOperation
        var opFootprint SpreadsheetFootprint

        switch data := op.Data.(type) {
        case SetCellLiteralOp:
            opInverse, opFootprint, err = applySetLiteral(&after, data, ids)
        case SetCellFormulaOp:
            opInverse, opFootprint, err = applySetFormula(&after, data, ids)
        case ClearCellsOp:
            opInverse, opFootprint, err = applyClearCells(&after, data)
        case CreateNamedRangeOp:
            opInverse, opFootprint, err = applyCreateNamedRange(&after, data, ids)
        case UpdateNamedRangeOp:
            opInverse, opFootprint, err = applyNamedRange(&after, data, ids)
        case CreateOverlayOp:
            opInverse, opFootprint, err = applyCreateOverlay(&after, data, ids)
        case ApplyFormulaResultOp:
            opInverse, opFootprint, err = applyFormulaResult(&after, data)
        default:
            err = ErrUnsupportedOperation
        }
        if err != nil {
            return SpreadsheetBase{}, nil, SpreadsheetFootprint{}, err
        }

        // Inverses run in reverse operation order.
        inverse = append(opInverse, inverse...)
        fp.Merge(opFootprint)
    }

    if err = ValidateBase(after); err != nil {
        return SpreadsheetBase{}, nil, SpreadsheetFootprint{}, err
    }
    return after, inverse, fp.Normalize(), nil
}
```
`ApplyOperations` has no storage, clock, network, Formula, or job dependency. Server ID assignment occurs through an injected deterministic `IDSource`, allowing replay tests to prove equivalent output. The function returns exact inverse operations and the semantic footprint from the same pre-change snapshot.
### 15.5 Store port and atomic append
```go
type Store interface {
    Create(
        ctx context.Context,
        scope Scope,
        sheet Spreadsheet,
        activity ActivityFact,
    ) error

    SpreadsheetByID(
        ctx context.Context,
        scope Scope,
        id string,
    ) (Spreadsheet, error)

    ChangeSetsSince(
        ctx context.Context,
        scope Scope,
        id string,
        seq int64,
    ) ([]SpreadsheetChangeSet, error)

    ChangeSetBySubmission(
        ctx context.Context,
        scope Scope,
        id, submissionID string,
    ) (SpreadsheetChangeSet, error)

    ChangeSetByID(
        ctx context.Context,
        scope Scope,
        id, changeSetID string,
    ) (SpreadsheetChangeSet, error)

    AppendChangeSet(
        ctx context.Context,
        scope Scope,
        expectedRevision int64,
        change SpreadsheetChangeSet,
        activity ActivityFact,
    ) error

    ReplaceBase(
        ctx context.Context,
        scope Scope,
        id string,
        expectedBaseSeq, newBaseSeq int64,
        base SpreadsheetBase,
    ) error

    ReadWindow(
        ctx context.Context,
        scope Scope,
        id string,
        window RangeRef,
    ) (SpreadsheetWindow, error)
}

type Scope struct {
    ProjectID string
}
```
`AppendChangeSet` owns the SQLite transaction that:
1. reads the scoped head;
2. verifies `revision == expectedRevision`;
3. inserts the immutable ChangeSet;
4. advances `revision` and `updated_at`;
5. inserts the bounded Activity fact;
6. commits.
No service method performs these writes in separate transactions.
### 15.6 Submission algorithm
```go
func (s *Service) Submit(
    ctx context.Context,
    scope Scope,
    id string,
    author Actor,
    sub SpreadsheetChangeSubmission,
) (SpreadsheetChangeSet, error) {
    if err := ValidateScope(scope); err != nil {
        return SpreadsheetChangeSet{}, err
    }
    if err := ValidateSubmission(sub); err != nil {
        return SpreadsheetChangeSet{}, err
    }

    fingerprint := HashSubmission(sub)
    if prior, err := s.store.ChangeSetBySubmission(ctx, scope, id, sub.SubmissionID); err == nil {
        if prior.SubmissionHash != fingerprint {
            return SpreadsheetChangeSet{}, NewSubmissionConflict(prior.Seq)
        }
        return prior, nil
    } else if !errors.Is(err, ErrNotFound) {
        return SpreadsheetChangeSet{}, err
    }

    head, pending, err := s.resolveHead(ctx, scope, id)
    if err != nil {
        return SpreadsheetChangeSet{}, err
    }
    if sub.ExpectedRevision != head.Revision {
        if err := ProveDisjoint(sub, pending, sub.ExpectedRevision); err != nil {
            return SpreadsheetChangeSet{}, NewRevisionConflict(
                sub.ExpectedRevision, head.Revision, err,
            )
        }
    }

    normalized := AssignServerIDs(sub.Operations, s.ids)
    after, inverse, footprint, err := ApplyOperations(head.Base, normalized, s.ids)
    if err != nil {
        return SpreadsheetChangeSet{}, err
    }
    _ = after // validation result; Base changes only during rebase

    cs := NewChangeSet(head, author, sub, normalized, inverse, footprint, fingerprint, s.now())
    if err := s.store.AppendChangeSet(ctx, scope, head.Revision, cs, ActivityFor(cs)); err != nil {
        if errors.Is(err, ErrRevisionConflict) {
            return SpreadsheetChangeSet{}, NewRevisionConflict(
                sub.ExpectedRevision, head.Revision+1, err,
            )
        }
        return SpreadsheetChangeSet{}, err
    }
    s.enqueueDerivedWork(scope, id, cs)
    return cs, nil
}
```
The result of `ApplyOperations` is deliberately not written into Base during normal submission. It validates the operation, creates inverses and footprints, and determines derived work. Reads replay the accepted operation; rebase later stores the resolved Base.
### 15.7 Undo, redo, and rebase
Undo is intentionally bounded to the current head, matching the current Document capability. It cannot remove an older authored change from beneath later collaboration.
```go
func (s *Service) Undo(
    ctx context.Context,
    scope Scope,
    spreadsheetID, authorID, targetID string,
) (SpreadsheetChangeSet, error) {
    head, err := s.store.SpreadsheetByID(ctx, scope, spreadsheetID)
    if err != nil {
        return SpreadsheetChangeSet{}, err
    }
    target, err := s.store.ChangeSetByID(ctx, scope, spreadsheetID, targetID)
    if err != nil {
        return SpreadsheetChangeSet{}, err
    }
    if target.AuthorID != authorID {
        return SpreadsheetChangeSet{}, ErrUndoForbidden
    }
    if target.Seq != head.Revision {
        return SpreadsheetChangeSet{}, ErrUndoConflict
    }
    if target.UndoOf != "" || len(target.InverseOps) == 0 {
        return SpreadsheetChangeSet{}, ErrUndoUnavailable
    }
    return s.submitCompensation(
        ctx, scope, head, authorID,
        "undo:"+target.ID,
        target.InverseOps,
        target.ID, "",
    )
}

func (s *Service) Rebase(
    ctx context.Context,
    scope Scope,
    spreadsheetID string,
) error {
    stored, err := s.store.SpreadsheetByID(ctx, scope, spreadsheetID)
    if err != nil {
        return err
    }
    changes, err := s.store.ChangeSetsSince(
        ctx, scope, spreadsheetID, stored.BaseSeq,
    )
    if err != nil {
        return err
    }
    through := stored.Revision
    changes = ChangeSetsThrough(changes, through)
    resolved, err := Replay(stored.Base, changes)
    if err != nil {
        return err
    }
    return s.store.ReplaceBase(
        ctx, scope, spreadsheetID,
        stored.BaseSeq, through, resolved,
    )
}
```
Redo applies the inverse of the current-head undo ChangeSet and records `RedoOf`. Rebase uses a deterministic job key such as `spreadsheet:{id}:rebase:{baseSeq}:{revision}`. A retry either observes the already advanced BaseSeq or repeats the same replay safely.
### 15.8 Representative SQLite DDL
```sql
CREATE TABLE spreadsheets (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL,
    name          TEXT NOT NULL,
    creator_id    TEXT NOT NULL,
    creator_name  TEXT NOT NULL,
    revision      INTEGER NOT NULL DEFAULT 0,
    base_seq      INTEGER NOT NULL DEFAULT 0,
    lifecycle     TEXT NOT NULL DEFAULT 'active',
    base_meta_json BLOB NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    trashed_at    TEXT
);
CREATE INDEX spreadsheets_project_updated
    ON spreadsheets(project_id, updated_at DESC, id);

CREATE TABLE spreadsheet_base_rows (
    spreadsheet_id TEXT NOT NULL,
    id             TEXT NOT NULL,
    rank           TEXT NOT NULL,
    height_px      INTEGER NOT NULL,
    hidden         INTEGER NOT NULL,
    PRIMARY KEY (spreadsheet_id, id),
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
);

CREATE TABLE spreadsheet_base_columns (
    spreadsheet_id TEXT NOT NULL,
    id             TEXT NOT NULL,
    rank           TEXT NOT NULL,
    width_px       INTEGER NOT NULL,
    hidden         INTEGER NOT NULL,
    PRIMARY KEY (spreadsheet_id, id),
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
);

CREATE TABLE spreadsheet_base_cells (
    spreadsheet_id   TEXT NOT NULL,
    id               TEXT NOT NULL,
    row_id           TEXT NOT NULL,
    column_id        TEXT NOT NULL,
    cell_json        BLOB NOT NULL,
    value_revision   INTEGER NOT NULL,
    display_revision INTEGER NOT NULL,
    PRIMARY KEY (spreadsheet_id, id),
    UNIQUE (spreadsheet_id, row_id, column_id),
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
);

CREATE TABLE spreadsheet_change_sets (
    id                TEXT PRIMARY KEY,
    spreadsheet_id    TEXT NOT NULL,
    project_id         TEXT NOT NULL,
    submission_id      TEXT NOT NULL,
    submission_hash    TEXT NOT NULL,
    author_id          TEXT NOT NULL,
    author_name        TEXT NOT NULL,
    authored_revision  INTEGER NOT NULL,
    prior_revision     INTEGER NOT NULL,
    seq                INTEGER NOT NULL,
    operations_json    BLOB NOT NULL,
    inverse_ops_json   BLOB NOT NULL,
    footprint_json     BLOB NOT NULL,
    undo_of            TEXT,
    redo_of            TEXT,
    summary_json        BLOB NOT NULL,
    created_at          TEXT NOT NULL,
    UNIQUE (spreadsheet_id, seq),
    UNIQUE (spreadsheet_id, submission_id),
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
);
```
Named ranges, spills, overlays, and rules use the same `(spreadsheet_id, id)` projection pattern. Their complete payloads may remain versioned JSON initially; frequently queried anchors and ranks should be promoted to indexed columns.
### 15.9 Formula adapter
The Spreadsheet-owned port is explicit about the immutable evaluation snapshot:
```go
type FormulaRequest struct {
    SpreadsheetID   string
    CellID          string
    Expression      string
    CellBindings    map[string]CellValue
    NamedBindings   map[string]CellValue
    LanguageVersion string
    Limits          FormulaLimits
}

type FormulaResult struct {
    Value             CellValue
    Diagnostic        *CellDiagnostic
    Dependencies      []CellOrNameRef
    DependencyDigest  string
    LanguageVersion   string
}

type FormulaEvaluator interface {
    Evaluate(
        ctx context.Context,
        scope Scope,
        request FormulaRequest,
    ) (FormulaResult, error)
}
```
Wiring snapshots the Formula Name Manager, converts `CellValue` bindings into Formula values, evaluates once, and converts the result back. Only Spreadsheet decides whether the result is still current and commits `apply_formula_result`.
## 16. Acceptance criteria
The capability is implementation-ready when:
1. every aggregate and child uses stable IDs and project-scoped reads;
2. A1 is a revision-bound projection, never canonical identity;
3. identical retries return the original ChangeSet;
4. stale writes are accepted only with retained disjointness proof;
5. undo/redo append compensation at the current head;
6. rebase changes `BaseSeq` without changing logical `Revision`;
7. formula and prompt jobs are idempotent and stale-safe;
8. spills are deterministic and derived cells are protected;
9. chart/image overlays remain independent from cells and spills;
10. append, revision advance, and Activity are atomic;
11. memory and SQLite stores pass the same contract tests;
12. resource catalog, search, activity, and agent adapters are wired without leaf-capability imports.
## Sources
- [Taurus Omega orientation and dependency rules](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Document model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go)
- [Current Document submission contract](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/submission.go)
- [Current Document SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_document.go)
- [Formula value model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/capabilities/formula/data-model.md)
- [Formula Name Manager](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/capabilities/formula/name-manager.md)
- <mention-page url="https://app.notion.com/p/3a5b6410e50281aabf00f442eee9b7de"/>
- <mention-page url="https://app.notion.com/p/3a6b6410e50281d3aff6cb92f54476cd"/>
- <mention-page url="https://app.notion.com/p/3a6b6410e50281299d19d09f40660dae"/>

