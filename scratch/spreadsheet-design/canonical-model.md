# Spreadsheet capability — canonical model

## Workbook

The canonical state is one `WorkbookSnapshot`. A workbook owns sheets in
ordered sequence, calculation settings, and metadata.

```ts
interface WorkbookHead {
  id: string;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkbookSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  sheetOrder: SheetId[];
  sheets: Record<SheetId, SpreadsheetSheet>;
  metadata: WorkbookMetadata;
  calculation: CalculationSettings;
}

interface WorkbookMetadata {
  description?: string;
  tags: string[];
  custom: Record<string, unknown>;
}

interface CalculationSettings {
  mode: "automatic" | "manual";
  iterative: boolean;
  maximumIterations?: number;
  convergenceThreshold?: number;
}
```

## Sheet

```ts
interface SpreadsheetSheet {
  id: SheetId;
  title: string;
  rows: Record<RowId, SheetRow>;
  columns: Record<ColumnId, SheetColumn>;
  cells: Record<CellId, SpreadsheetCell>;
  freeze: FreezeState;
  defaults: SheetDefaults;
}

interface SheetRow {
  id: RowId;
  rank: Rank;            // fractional rank string for ordering
  height?: number;       // pt, undefined = default height
  hidden: boolean;
}

interface SheetColumn {
  id: ColumnId;
  rank: Rank;
  width?: number;        // pt, undefined = default width
  hidden: boolean;
}

interface FreezeState {
  frozenRows: number;    // count of frozen rows from top
  frozenColumns: number; // count of frozen columns from left
}

interface SheetDefaults {
  rowHeight: number;
  columnWidth: number;
}
```

Rows and columns use stable IDs with sortable `rank`. The grid visual order is
derived from sorting by `(rank, id)`. A1 notation (`A1`, `B2`) is a projection
of current axis order — not a stable identity.

`freeze` is a count, not stable IDs. This is simpler and sufficient for
presentation. If rows/columns are inserted or deleted within the frozen region,
the freeze count adjusts accordingly.

## Cells

A single `SpreadsheetCell` model handles both regular and merged cells. An empty
grid coordinate has no Cell record — storage is sparse.

```ts
interface SpreadsheetCell {
  id: CellId;
  /** The first row and column in sheet order for this cell.
   *  For merged cells, this is the top-left corner. */
  anchor: StableCellRef;
  /** The rectangular span of this cell. A normal cell has 1 row × 1 column.
   *  A merged cell has multiple contiguous rows and/or columns. */
  span: CellSpan;
  /** What produces this cell's value. */
  source: CellSource;
  /** The last settled result. */
  accepted: AcceptedCellContent;
  /** Visual style. */
  style: CellStyle;
  /** Input validation rules. */
  validation?: CellValidation;
}

interface StableCellRef {
  sheetId: SheetId;
  rowId: RowId;
  columnId: ColumnId;
}

interface CellSpan {
  rowIds: RowId[];
  columnIds: ColumnId[];
}
```

A `CellSpan` must be:
- Rectangular under current row and column order
- Contiguous — no gaps in the row or column ID arrays
- Anchored at its first row and column: `span.rowIds[0] === anchor.rowId` and
  `span.columnIds[0] === anchor.columnId`
- Non-overlapping with any other Cell's span on the same sheet

Every coordinate covered by a merged Cell resolves to the same Cell ID.

### Merging and unmerging

- **Merge**: takes an existing Cell, extends its span to cover the requested
  coordinates. The covered-cell policy determines what happens to Cells already
  occupying those coordinates: `"require-empty"` (reject if occupied),
  `"discard"` (delete covered cells), or `"preserve-as-reference"` (keep as
  named-only reference, not rendered).
- **Unmerge**: preserves the anchor Cell and its content, reduces its span to
  `1×1`, and releases the remaining coordinates as empty.

## Cell sources

```ts
type RichContent = import("#platform/rich-text").RichContent;
type DerivedOutputRef = import("#derived-outputs").DerivedOutputRef;

type CellSource =
  | { kind: "empty" }
  | { kind: "literal"; value: CellLiteral }
  | { kind: "rich-text"; content: RichContent }
  | { kind: "formula"; source: string }
  | { kind: "data"; entryId: string; entryKind: "table" | "record" | "list"; revision?: number; orientation: ProjectionOrientation }
  | { kind: "derived-output"; output: DerivedOutputRef; orientation: ProjectionOrientation };

type CellLiteral = string | number | boolean | null;

type ProjectionOrientation =
  | "rows"       // fields become columns, each row is a grid row
  | "columns"    // fields become rows, each row is a grid column
  | "record-vertical"   // record fields listed vertically
  | "record-horizontal"; // record fields listed horizontally
```

`CellSource` is the user's intent — what kind of value the Cell should display.
`AcceptedCellContent` is the resolved result.

- `literal` and `rich-text` require no resolution.
- `formula` is parsed and evaluated by Formula.
- `data` references a Structured Data collection entry by stable ID.
- `derived-output` references an immutable Derived Output revision.

Only `table`, `record`, and `list` are valid `entryKind` values for a direct
Data-backed Cell. `variable` and `function` are resolved by Formula through
the Data binding view when they appear in formula source text.

## Accepted Cell content

```ts
type AcceptedCellContent =
  | { kind: "empty" }
  | { kind: "scalar"; value: FormulaScalar; acceptedAt: string; dependencies: CellDependency[] }
  | { kind: "rich-text"; content: RichContent; acceptedAt: string; dependencies: CellDependency[] }
  | { kind: "structured"; value: FormulaWireValue; projection: RangeProjection; acceptedAt: string; dependencies: CellDependency[] }
  | { kind: "error"; error: CellError; acceptedAt: string; dependencies: CellDependency[] };

type FormulaScalar = string | number | boolean | null;

interface CellError {
  code: string;
  message: string;
}

type CellDependency =
  | { kind: "cell"; cell: StableCellRef; revision: number }
  | { kind: "range"; range: StableRangeRef; revision: number }
  | { kind: "data"; entryId: string; revision: number }
  | { kind: "derived-output"; outputId: string; revision: number };
```

Accepted content is the last settled result displayed by the workbook revision.
The calculation stage may hold newer candidate values, but they become canonical
only through a serial settlement ChangeSet.

`dependencies` records what this cell's value depends on — other cells, data
entries, or derived outputs — at the revision pinned during evaluation. This
enables incremental recalculation.

## Stable ranges

```ts
interface StableRangeRef {
  sheetId: SheetId;
  rowIds: RowId[];       // contiguous range of row IDs
  columnIds: ColumnId[]; // contiguous range of column IDs
}
```

A stable range is an address over stable row and column IDs. It is useful as a
reference target (formulas, comments, rules) without being a durable content
entity. Ranges do not carry their own content — they reference the Cells that
happen to occupy those coordinates.

## Range projection

```ts
interface RangeProjection {
  anchorCellId: CellId;
  extent: ProjectionExtent;
  orientation: ProjectionOrientation;
  status: "ready" | "blocked";
  diagnostics: ProjectionDiagnostic[];
}

interface ProjectionExtent {
  rowIds: RowId[];
  columnIds: ColumnId[];
}

interface ProjectedCell {
  coordinate: StableCellRef;
  anchorCellId: CellId;
  valuePath: Array<string | number>;  // path into the structured value
  value: FormulaScalar | RichContent;
}

interface ProjectionDiagnostic {
  code: "occupied-coordinate" | "merged-cell-overlap" | "axis-missing" | "shape-invalid";
  coordinate?: StableCellRef;
  message: string;
}
```

A range projection describes how a structured value (table, record, list) maps
onto the grid. The projection is rebuildable from the accepted structured value,
anchor Cell, orientation, and axis order. It is never stored as independent Cells.

### Projection rules

1. The projection starts at the anchor Cell's row and column.
2. Orientation determines layout:
   - `"rows"`: fields → columns, each data row → a grid row
   - `"columns"`: fields → rows, each data row → a grid column
   - `"record-vertical"`: field names in column 1, values in column 2
   - `"record-horizontal"`: field names in row 1, values in row 2
3. If any projected coordinate overlaps a canonical Cell or merged span, the
   projection is `"blocked"` and reports diagnostics.
4. Projected coordinates are NOT stored as Cells. They resolve to
   `(anchorCellId, valuePath)` tuples.

### Projection lifecycle

- **Create**: set a Cell's source to `data` or `derived-output`. The accepted
  structured value produces a projection.
- **Block**: another Cell is placed within the projection extent. The projection
  becomes `"blocked"` and reports diagnostics.
- **Update**: the source value changes. The projection extent may grow or shrink.
  If growth would overlap, it stays blocked.
- **Materialize**: convert the projected range into ordinary Cells. The source
  Cell becomes a literal or is deleted. Projected values become canonical Cells.
- **Promote to Data**: select a range, create a Data entry from its values,
  replace the range with one Data-backed anchor Cell.

## Cell style

```ts
interface CellStyle {
  font?: {
    family?: string;
    size?: number;          // pt
    weight?: number;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  };
  fill?: {
    color?: string;
  };
  border?: {
    top?: BorderStyle;
    right?: BorderStyle;
    bottom?: BorderStyle;
    left?: BorderStyle;
  };
  alignment?: {
    horizontal?: "left" | "center" | "right";
    vertical?: "top" | "middle" | "bottom";
    wrap?: boolean;
  };
  numberFormat?: string;    // e.g. "#,##0.00", "0%"
}

interface BorderStyle {
  color: string;
  width: number;            // pt
  dash?: "solid" | "dashed" | "dotted";
}

interface CellValidation {
  rule: ValidationRule;
  message?: string;
}

type ValidationRule =
  | { kind: "list"; values: string[] }
  | { kind: "number-range"; min?: number; max?: number }
  | { kind: "text-length"; min?: number; max?: number }
  | { kind: "custom"; formula: string };
```

## Sheet rules and overlays

```ts
interface SheetRule {
  id: string;
  range: StableRangeRef;
  rule: ConditionalFormatRule;
}

interface ConditionalFormatRule {
  condition: { kind: "formula"; source: string } | { kind: "value"; operator: ComparisonOperator; value: CellLiteral };
  style: CellStyle;
}

type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not-contains";

interface SheetOverlay {
  id: string;
  kind: "chart" | "image" | "sparkline";
  anchor: StableCellRef;
  extent: ProjectionExtent;
  data: Record<string, unknown>;
}
```

Conditional formatting rules apply cell styles based on formula or value
conditions. Overlays (charts, images, sparklines) float above the grid at
specific anchor positions.

## What was changed from the old design

| Old (`docs/capabilities/spreadsheet.md`) | New |
|---|---|
| `SpreadsheetRuntime` with sub-objects (`commands`, `queries`, `snapshots`, `changes`, `calculation`, `projections`) | `SpreadsheetCapability` with `command()` and `query()` — same pattern as all other capabilities. |
| `SpreadsheetRepository` port | `SpreadsheetStore` interface — same naming as `DataStore`, `DocumentStore`, `SlidesStore`. |
| `SpreadsheetChange` with `op` field | `SpreadsheetOperation` with `type` field — same pattern as `DocumentOperation`, `SlidesOperation`. |
| `SpreadsheetSubmission` with `status` field | Idempotent command pattern with ChangeSet + receipt. |
| `Workbook.baseRevision` in change sets | `authoredRevision` / `priorRevision` / `revision` — same pattern as Document/Slides. |
| Normalized SQL projection tables (`spreadsheet_base_sheets/rows/columns/cells`) | Removed. The immutable Base blob is authority. Current-base read optimization is an implementation detail. |
| `CellReferenceAttachment` with anchor variants | Simplified to inline `ReferenceAttachment` on Cells (same as Rich Text platform). |
| `StructuredDataProjection` as separate descriptive type | Merged into `CellSource.data` — the source IS the reference. |
| `PromoteRangeToDataInput` / `AttachDataEntryInput` as command inputs | Preserved as command-level concepts, not domain types. |
| Dependency and projection index SQL tables | Preserved as rebuildable read projections, not canonical state. |