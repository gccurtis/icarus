# Spreadsheet capability — canonical model

## Aggregate and authority boundary

Spreadsheet owns one versioned `WorkbookSnapshot`. The snapshot contains the
complete authored workbook structure and every accepted value needed to replay
a historical revision. Project ID selects the runtime and store at
construction; neither project nor user identity appears in canonical
Spreadsheet values.

```ts
type WorkbookId = string;
type SheetId = string;
type RowId = string;
type ColumnId = string;
type CellId = string;
type CellStyleId = string;
type SheetRuleId = string;
type SheetOverlayId = string;
type SheetFormatRegionId = string;

type WorkbookLifecycle = "active" | "archived" | "trashed";
type RichContent = import("#rich-text").RichContent;
type FormulaWireValue = import("#formula").FormulaWireValue;
type FormulaScalarWireValue = Extract<
  FormulaWireValue,
  { kind: "null" | "number" | "text" | "logic" }
>;
type DerivedOutputRef = import("#derived-outputs").DerivedOutputRef;

interface WorkbookHead {
  id: WorkbookId;
  /** Denormalized current snapshot fields used by list queries. */
  title: string;
  lifecycle: WorkbookLifecycle;
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
  lifecycle: WorkbookLifecycle;
  design: WorkbookDesignSystem;
  /** The sole Sheet-order authority. */
  sheetOrder: SheetId[];
  sheets: Record<SheetId, SpreadsheetSheet>;
  metadata: WorkbookMetadata;
  calculation: CalculationSettings;
}

interface WorkbookMetadata {
  description?: string;
  tags: string[];
}

interface CalculationSettings {
  mode: "automatic" | "manual";
}
```

The keys of `sheets` must exactly equal the IDs in `sheetOrder`, with each ID
appearing once. A Workbook always has at least one Sheet. Representation v1
does not perform iterative calculation: dependency cycles settle as typed
errors. Automatic mode schedules affected formula work after an accepted
mutation; manual mode leaves their last accepted value visible but derives a
`dirty` status until an explicit calculation request. `pending` is reserved for
a current source that has no accepted settlement, not for every dependency
change.

## Embedded workbook design system

A professional Workbook needs coherent palette and typography changes as well
as reusable cell Styles. It therefore embeds its design resources in the
versioned snapshot instead of copying complete style objects into every Cell.
Historical revisions never depend on an externally mutable theme.

```ts
type WorkbookDesignTokenId = string;
type SpreadsheetColor = string; // canonical lowercase #rrggbbaa

interface WorkbookDesignSystem {
  theme: WorkbookTheme;
  cellStyles: WorkbookCellStyleRegistry;
}

interface WorkbookTheme {
  name: string;
  tokens: Record<WorkbookDesignTokenId, WorkbookDesignToken>;
  palette: WorkbookThemePalette;
  typography: WorkbookThemeTypography;
}

type WorkbookDesignToken =
  | {
      id: WorkbookDesignTokenId;
      kind: "color";
      name: string;
      value: SpreadsheetColor;
    }
  | {
      id: WorkbookDesignTokenId;
      kind: "font";
      name: string;
      family: string;
    }
  | {
      id: WorkbookDesignTokenId;
      kind: "length";
      name: string;
      valuePt: number;
    };

type WorkbookColorValue =
  | { kind: "literal"; value: SpreadsheetColor }
  | { kind: "token"; tokenId: WorkbookDesignTokenId };

type WorkbookFontValue =
  | { kind: "literal"; family: string }
  | { kind: "token"; tokenId: WorkbookDesignTokenId };

type WorkbookLengthValue =
  | { kind: "literal"; valuePt: number }
  | { kind: "token"; tokenId: WorkbookDesignTokenId };

interface WorkbookThemePalette {
  canvas: WorkbookColorValue;
  grid: WorkbookColorValue;
  text: WorkbookColorValue;
  mutedText: WorkbookColorValue;
  surface: WorkbookColorValue;
  accents: WorkbookColorValue[];
  positive: WorkbookColorValue;
  warning: WorkbookColorValue;
  negative: WorkbookColorValue;
}

interface WorkbookThemeTypography {
  bodyFont: WorkbookFontValue;
  bodySize: WorkbookLengthValue;
}

interface WorkbookCellStyleRegistry {
  normalStyleId: CellStyleId;
  styles: Record<CellStyleId, WorkbookCellStyle>;
}

interface WorkbookCellStyle {
  id: CellStyleId;
  name: string;
  basedOnStyleId?: CellStyleId;
  properties: CellStyleProperties;
  /** Exactly one Style owns this protected role. */
  systemRole?: "normal";
}
```

Token references must resolve to a token of the matching kind. Tokens do not
alias other tokens in representation v1. Style inheritance is acyclic; every
Style ultimately overlays the protected Normal Style. Normal may be renamed
and visually redefined, but it cannot be deleted or lose its role. Other named
Styles are ordinary reusable bundles and may be added, renamed, based on
another Style, or deleted when no canonical reference remains.

```ts
interface CellStyleProperties {
  text?: CellTextStyle;
  fill?: CellFillStyle;
  borders?: CellBorderSet;
  alignment?: CellAlignment;
  numberFormat?: CellNumberFormat;
}

interface CellTextStyle {
  fontFamily?: WorkbookFontValue;
  fontSize?: WorkbookLengthValue;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: WorkbookColorValue;
}

type CellFillStyle =
  | { kind: "none" }
  | { kind: "solid"; color: WorkbookColorValue };

interface CellBorderSet {
  top?: CellBorderStyle;
  right?: CellBorderStyle;
  bottom?: CellBorderStyle;
  left?: CellBorderStyle;
}

type CellBorderStyle =
  | { kind: "none" }
  | {
      kind: "stroke";
      color: WorkbookColorValue;
      width: WorkbookLengthValue;
      dash: "solid" | "dashed" | "dotted";
    };

interface CellAlignment {
  horizontal?: "left" | "center" | "right" | "justify";
  vertical?: "top" | "middle" | "bottom";
  wrap?: boolean;
  textRotationDegrees?: number;
}

type CellNumberFormat =
  | { kind: "general" }
  | { kind: "number"; decimalPlaces: number; useGrouping: boolean }
  | { kind: "percent"; decimalPlaces: number }
  | { kind: "currency"; currencyCode: string; decimalPlaces: number }
  | { kind: "date"; pattern: string }
  | { kind: "date-time"; pattern: string }
  | { kind: "scientific"; decimalPlaces: number }
  | { kind: "custom"; pattern: string };
```

For a coordinate, presentation resolves in this order:

1. Theme fallbacks and the protected Normal Style.
2. The Sheet default Style and local overrides.
3. Column Style and local overrides.
4. Row Style and local overrides.
5. Matching range Format Regions, in region order.
6. Materialized Cell Style and local overrides.
7. Matching Conditional Formatting rules, in rule order.
8. For `RichContent`, stored Rich Text marks as supplementary inline styling.

Each Style reference is resolved with its complete inheritance chain before it
is overlaid. A Rich Text full-range base mark is an ephemeral projection and
is never written into `RichContent`.

## Sheets and stable axes

```ts
interface SpreadsheetSheet {
  id: SheetId;
  title: string;
  /** Sole Row-order authority. */
  rowOrder: RowId[];
  rows: Record<RowId, SheetRow>;
  /** Sole Column-order authority. */
  columnOrder: ColumnId[];
  columns: Record<ColumnId, SheetColumn>;
  cells: Record<CellId, SpreadsheetCell>;
  formatRegions: SheetFormatRegion[]; // low-to-high overlay priority
  rules: SheetRule[]; // array order is Conditional Formatting priority
  overlays: Record<SheetOverlayId, SheetOverlay>;
  freeze: FreezeState;
  defaults: SheetDefaults;
}

interface SheetRow {
  id: RowId;
  heightPt?: number;
  hidden: boolean;
  styleId?: CellStyleId;
  styleOverrides?: CellStyleProperties;
}

interface SheetColumn {
  id: ColumnId;
  widthPt?: number;
  hidden: boolean;
  styleId?: CellStyleId;
  styleOverrides?: CellStyleProperties;
}

interface FreezeState {
  /** The frozen prefix ends at this stable Row, inclusive. */
  frozenThroughRowId?: RowId;
  /** The frozen prefix ends at this stable Column, inclusive. */
  frozenThroughColumnId?: ColumnId;
}

interface SheetDefaults {
  rowHeightPt: number;
  columnWidthPt: number;
  styleId: CellStyleId;
  styleOverrides?: CellStyleProperties;
}

interface SheetFormatRegion {
  id: SheetFormatRegionId;
  range: StableRangeRef;
  styleId?: CellStyleId;
  styleOverrides?: CellStyleProperties;
}
```

The keys of each axis record must exactly equal its order array. A1 notation is
a projection of the current array positions, never canonical identity. Row and
Column IDs remain stable when axes move. Freeze panes address stable boundary
IDs rather than fragile counts; inserting before a boundary joins the frozen
prefix, while deleting the boundary must clear or replace it in the same
ChangeSet.

Workbook-wide identity ledgers prevent reuse of retired Sheet, Row, Column,
Cell, Style, Format Region, rule, and overlay IDs. IDs are unique within their
resource kind, including across Sheets where an operation otherwise could
become ambiguous. Format Region array order is low-to-high priority; later
matching properties win. Regions compactly style large blank ranges and do not
materialize Cells.

## Stable coordinates, ranges, and Cell spans

```ts
interface StableCellRef {
  sheetId: SheetId;
  rowId: RowId;
  columnId: ColumnId;
}

interface StableRangeRef {
  sheetId: SheetId;
  startRowId: RowId;
  startColumnId: ColumnId;
  endRowId: RowId;
  endColumnId: ColumnId;
}

interface CellSpan {
  /** Inclusive bottom-right endpoint. A 1x1 Cell repeats its anchor IDs. */
  endRowId: RowId;
  endColumnId: ColumnId;
}
```

Range and span endpoints must exist in the same Sheet and be normalized so the
start precedes the end in current axis order. Membership is the rectangular
interval between the stable endpoints. Inserting an axis between the endpoints
therefore expands the addressed range predictably. An axis move changes which
coordinates lie between endpoints without changing either endpoint identity.
Operations that delete an endpoint must explicitly rewrite, remove, or reject
every owning range/span; silently retargeting to a neighboring axis is invalid.

Every coordinate covered by a merged Cell resolves to that Cell's stable ID.
Two canonical Cell spans cannot overlap.

## Sparse Cells and closed content variants

An entirely default blank coordinate has no Cell record. Row, Column, and range
Format Region styling can apply without materializing it. A blank with a local
Cell Style/override, validation, reference, or merged span is materialized as a
Cell with `blank` content. Sparse therefore means “only semantically
materialized coordinates,” not “only coordinates with a visible value.”

```ts
interface SpreadsheetCell {
  id: CellId;
  anchor: StableCellRef;
  span: CellSpan;
  content: CellContent;
  styleId: CellStyleId;
  styleOverrides?: CellStyleProperties;
  validation?: CellValidation;
}

type CellContent =
  | BlankCellContent
  | LiteralCellContent
  | RichContentCellContent
  | FormulaCellContent
  | DataCellContent
  | PromptContentCellContent;

interface BlankCellContent {
  kind: "blank";
}

interface LiteralCellContent {
  kind: "literal";
  value: CellLiteral;
}

interface RichContentCellContent {
  kind: "rich-content";
  content: RichContent;
}

type CellLiteral =
  | { kind: "number"; value: ExactCellNumber }
  | { kind: "logic"; value: boolean }
  | { kind: "date"; isoDate: string }
  | { kind: "date-time"; isoDateTime: string };

interface ExactCellNumber {
  numerator: string;
  denominator: string;
}
```

Authored prose is always `RichContent`, even when it currently has no marks.
This gives every authored text Cell the same marks, links, references, Formula
atoms, `{{ ... }}` conversion, normalization, and exact-inverse behavior as
Document and Slides. Plain strings remain appropriate for administrative
labels and immutable externally generated Prompt Content. Literal numbers use
Formula's canonical rational wire shape, so admission converts authored
decimal text without a JavaScript floating-point round trip and can also
represent non-terminating results exactly. Blank is distinct from an empty
text value, zero, and Formula null.

Using a closed content union prevents invalid combinations such as a literal
source paired with an unrelated accepted Formula value. Formula and Data Cells
are the only whole-Cell computed variants and carry settlement compatible with
their own source.

## Spreadsheet-authored formulas and stable reference manifests

Formula owns `formula/v1` parsing and evaluation, but it does not understand
Spreadsheet A1 notation or persist Spreadsheet reference identity.
Spreadsheet therefore admits whole-Cell formula text through a Spreadsheet-
owned authoring layer before it reaches the reducer.

```ts
interface FormulaCellContent {
  kind: "formula";
  formula: WholeCellFormulaSource;
  /** Required only when an accepted list/record/table should spill. */
  projectionOrientation?: ProjectionOrientation;
  settlement: ComputedCellSettlement<AcceptedFormulaCellValue>;
}

interface SpreadsheetFormulaSourceBase {
  languageVersion: "spreadsheet-formula/v1";
  /** Stable coordinate at which relative/absolute authoring was admitted. */
  anchor: StableCellRef;
  /** Exact user submission, including an optional leading '='. */
  authoredText: string;
  /** Formula/v1 source with grid references replaced by reserved aliases. */
  normalizedFormulaSource: string;
  /** Digest of every semantic field in the concrete source except itself. */
  sourceDigest: string;
}

interface WholeCellFormulaSource extends SpreadsheetFormulaSourceBase {
  scope: "whole-cell";
  /** All non-local, non-builtin dependencies captured at admission. */
  bindings: SpreadsheetFormulaBinding[];
}

interface GridRuleFormulaSource extends SpreadsheetFormulaSourceBase {
  scope: "grid-rule";
  /** Rules cannot depend on project bindings in representation v1. */
  bindings: Array<
    SpreadsheetCellFormulaBinding | SpreadsheetRangeFormulaBinding
  >;
}

type SpreadsheetFormulaSource =
  | WholeCellFormulaSource
  | GridRuleFormulaSource;

type SpreadsheetFormulaBinding =
  | SpreadsheetCellFormulaBinding
  | SpreadsheetRangeFormulaBinding
  | SpreadsheetProjectFormulaBinding;

interface FormulaAuthoredSpan {
  /** UTF-16 code-unit offsets into authoredText, start inclusive. */
  start: number;
  end: number;
}

type FormulaAxisMode = "relative" | "absolute";

interface SpreadsheetCellFormulaBinding {
  id: string;
  kind: "cell";
  /** Reserved ASCII Formula/v1 identifier generated by Spreadsheet. */
  alias: string;
  authoredSpan: FormulaAuthoredSpan;
  target: StableCellRef;
  rowMode: FormulaAxisMode;
  columnMode: FormulaAxisMode;
  explicitSheet: boolean;
}

interface SpreadsheetRangeFormulaBinding {
  id: string;
  kind: "range";
  alias: string;
  authoredSpan: FormulaAuthoredSpan;
  target: StableRangeRef;
  startRowMode: FormulaAxisMode;
  startColumnMode: FormulaAxisMode;
  endRowMode: FormulaAxisMode;
  endColumnMode: FormulaAxisMode;
  explicitSheet: boolean;
}

interface SpreadsheetProjectFormulaBinding {
  id: string;
  kind: "project-binding";
  authoredName: string;
  normalizedLookupKey: string;
  /** Stable binding identity captured from the project Formula resolver. */
  bindingId: string;
}
```

Admission recognizes A1, absolute (`$A$1`), range (`A1:B4`), and
sheet-qualified references, resolves them to stable axis IDs, captures project
symbolic identifiers by stable resolver `bindingId`, emits deterministic
reserved aliases for grid values, and asks Formula to parse/validate the
normalized source. Generic Cell operations cannot persist raw formula text or
a caller-built manifest. No Formula AST is canonical or persisted.

At evaluation, Spreadsheet builds one immutable composite
`FormulaResolverSnapshot`:

- project bindings come from the injected project Formula resolver;
- a stored project dependency is found by `bindingId` and exposed under its
  stored lookup key, so a rename followed by a new declaration under the old
  name cannot retarget the formula;
- reserved grid aliases resolve against the frozen Workbook revision;
- an empty coordinate resolves to Formula null, while a Cell or projected
  coordinate resolves to its exact accepted value;
- range aliases resolve to a Formula table/list value in current axis order.

### Exact grid-to-Formula value projection

Workbook-local bindings use one deterministic conversion at a frozen Workbook
revision:

- an unmaterialized coordinate or `blank` Cell becomes Formula null;
- a numeric literal becomes Formula's exact canonical rational number;
- a logic literal becomes Formula logic;
- date and date-time literals become ISO Formula text in representation v1;
- Rich Content becomes Rich Text's deterministic plain-text projection,
  including each Formula atom's stored display text;
- an accepted Formula or Data Cell contributes its exact stored wire value;
- a pending computed Cell produces `dependency_pending`, and an error
  settlement produces `dependency_error`, rather than inventing a value;
- UI coordinate lookup for a merged non-anchor resolves the owning anchor Cell,
  but Formula value projection emits null there so a range does not count one
  merged value repeatedly;
- a projected coordinate contributes the exact wire value at its `valuePath`;
- Prompt Content resolves the exact referenced Derived Output revision to
  Formula text. Missing output/revision data is a typed dependency error.

Range aliases apply that conversion row-major and expose current column A1
labels as deterministic Formula table fields. A Prompt read records both the
coordinate value digest and the exact output ID/applied revision dependency.
The application freezes that output revision before evaluation; it never reads
the mutable Derived Output head.

Moving or inserting axes changes the rendered A1 text but never the stable
targets. Deleting a referenced axis yields a typed broken-reference diagnostic
rather than retargeting. Copy/fill translates only axes marked `relative` and
creates a newly admitted manifest; `$`-absolute axes keep their stable target.

Custom Cell validation and Formula-based Conditional Formatting use the
`GridRuleFormulaSource` variant of the same admitted authoring family. It
rejects project symbolic dependencies: those rules may use stable grid
references, builtins, and one reserved target candidate/current-value local
only. They therefore remain deterministic projections of one immutable
Workbook revision and never consult today's project resolver while rendering.
Their grid references bind once at rule admission and are not rebound relative
to every target coordinate. Full Excel-style relative-per-target rule
templates are a future authoring-layer extension, not an implied behavior.

The reserved local is the exact ASCII identifier `__spreadsheet_cell_value`.
For validation it is the candidate content after the grid-to-Formula conversion
above; for Conditional Formatting it is the current resolved coordinate value.
The Spreadsheet authoring layer reserves the `__spreadsheet_` prefix for this
local and generated grid aliases, rejects authored project identifiers using
that prefix, and injects the local before binding. It therefore cannot collide
with or be shadowed by a project name. A pending/error current value makes the
rule evaluation diagnostic rather than substituting null.

### Formula settlement

```ts
type ComputedCellSettlement<TAccepted extends AcceptedComputedCellValue> =
  | { state: "pending"; sourceDigest: string }
  | { state: "accepted"; accepted: TAccepted }
  | { state: "error"; rejected: RejectedComputedCellValue };

interface AcceptedComputedCellValue {
  sourceDigest: string;
  value: FormulaWireValue;
  dependencies: SpreadsheetObservedDependency[];
  resolverSnapshotDigest: string;
  evaluationDigest: string;
}

interface AcceptedFormulaCellValue extends AcceptedComputedCellValue {
  sourceKind: "formula";
}

interface AcceptedDataCellValue extends AcceptedComputedCellValue {
  sourceKind: "data";
  externalBinding: AcceptedProjectBinding;
}

interface RejectedComputedCellValue {
  sourceDigest: string;
  diagnostic: SpreadsheetFormulaDiagnostic;
  dependencies: SpreadsheetObservedDependency[];
  resolverSnapshotDigest?: string;
}

interface AcceptedProjectBinding {
  bindingId: string;
  ownerRevision: number | string;
  valueDigest: string;
}

type SpreadsheetObservedDependency =
  | {
      kind: "coordinate";
      bindingId: string;
      target: StableCellRef;
      valueDigest: string;
    }
  | {
      kind: "range";
      bindingId: string;
      target: StableRangeRef;
      valueDigest: string;
    }
  | {
      kind: "project-binding";
      bindingId: string;
      ownerRevision: number | string;
      valueDigest: string;
    }
  | {
      kind: "prompt-output";
      outputId: string;
      appliedRevision: number;
      valueDigest: string;
    };

interface SpreadsheetFormulaDiagnostic {
  code: string;
  message: string;
  sourceRange?: { start: number; end: number };
}
```

There is no wall-clock `acceptedAt` in semantic Workbook state. Operational
attempt rows own timing. Settlement is serial and conditional on the same Cell,
source digest, and formula owner still existing. Accepted `FormulaWireValue`
and observed identities are canonical; dependency graphs and calculation plans
are rebuildable. Comparing accepted dependency digests with the current frozen
inputs derives `clean`, `dirty`, or `blocked` calculation status without
rewriting every downstream Cell when an input changes. A dirty Cell continues
to display and project its last accepted value until a newer settlement lands.

### Rich Content Formula atoms are a distinct path

A `RichContentCellContent` may contain any number of Rich Text Formula atoms.
Their expression, accepted `FormulaWireValue`, display text, and diagnostic live
inside the atom. Spreadsheet evaluates them through the same durable
compute/settle pattern used by Document and Slides, then applies Rich Text's
`apply-formula-settlement` operation conditionally to the same target and atom.

Representation v1 Rich Content Formula atoms use ordinary Formula/v1 project
bindings only. They do **not** support A1 or range syntax because shared Rich
Text has nowhere to persist the Spreadsheet stable-reference manifest. Whole-
Cell Formula content is the grid-aware formula surface. Adding grid-aware Rich
Text atoms later requires an explicit host binding-manifest contract.

## Data Cells through the Formula resolver

A Data Cell adopts a stable, wire-serializable project Formula binding. It does
not call Structured Data directly and does not invent a second naming system.
The project Formula resolver may expose a scalar variable or a list, record, or
table; function values are rejected because they are not wire serializable.

```ts
interface DataCellContent {
  kind: "data";
  source: DataCellSource;
  /** Required for accepted list/record/table values; absent for scalars. */
  projectionOrientation?: ProjectionOrientation;
  settlement: ComputedCellSettlement<AcceptedDataCellValue>;
}

interface DataCellSource {
  bindingId: string;
  tracking: "pinned" | "follow-head";
  sourceDigest: string;
}
```

Attach and refresh are staged Spreadsheet workflows. They freeze a resolver
snapshot, resolve the requested stable binding ID, reject functions, and
conditionally settle the exact value with its `ownerRevision` and
`valueDigest`. `pinned` retains the accepted binding revision until explicitly
reattached; `follow-head` is eligible for refresh when the project binding
changes. In both modes, an old Workbook revision displays its embedded exact
accepted value without consulting today's project state.

Representation v1 deliberately has no “promote range to Data” workflow and no
direct Structured Data runtime dependency. If cross-capability Data mutation
is later desired, it needs its own durable delegated claim rather than being
smuggled through a reducer operation.

## Prompt Content Cells and Derived Outputs

```ts
interface PromptContentCellContent {
  kind: "prompt-content";
  /** Exact immutable revision of this Cell's dedicated Derived Output. */
  output: DerivedOutputRef;
}
```

Every Prompt Content Cell owns one newly declared Derived Output; no two live
Cells share an `outputId`. Generic Cell create/content operations cannot
introduce Prompt Content or attach a caller-supplied output. Creation,
definition update, stabilization update, and refresh use the same freeze →
concurrent Derived Outputs call → serial conditional settlement pattern as
Document and Slides.

Prompt creation may replace an existing Cell's ordinary content. Every such
creation declares a fresh output, even if the same Cell ID held Prompt Content
earlier. The operational ownership ledger therefore retains multiple
historical output rows for one Cell lifetime while allowing at most one
`pending` row and at most one `attached` row. One of each may coexist while a
replacement computes. Successful settlement atomically makes the old attached
row historical and the pending row attached; failure makes only the pending row
historical and preserves the previous attachment. Replacing Prompt Content
with ordinary content makes the attached row historical.

Derived Outputs owns the prompt definition, Context scope, stabilization text,
evidence, freshness, generation, and immutable string revisions. Spreadsheet
stores only the exact reference and displays the referenced plain text through
the Cell's resolved Style. Prompt Content never spills. Deleting the Cell marks
Spreadsheet's local ownership record historical for history/idempotency;
Spreadsheet never deletes or garbage-collects the output.

## Merged Cells

A normal Cell has a span endpoint equal to its anchor. A merged Cell has a
larger rectangular span and remains one Cell identity.

Representation v1 has one merge policy: every non-anchor coordinate in the
requested span must be empty and unmaterialized by the time merge is applied.
Callers that intentionally discard content first submit explicit Cell deletes
in the same operation batch. There is no implicit discard and no unsupported
“preserve as reference” state. Unmerge preserves the anchor Cell and reduces
its span to 1×1; released coordinates become unmaterialized blank coordinates.

## Derived range projections

Only an accepted structured Formula or Data value can project beyond its
anchor. Literal, Rich Content, Prompt Content, scalar Formula, and scalar Data
Cells never spill.

```ts
type ProjectionOrientation =
  | "rows"
  | "columns"
  | "record-vertical"
  | "record-horizontal";

interface RangeProjection {
  anchorCellId: CellId;
  requiredShape: { rowCount: number; columnCount: number };
  /** Absent only when axis capacity cannot resolve the bottom-right endpoint. */
  resolvedExtent?: StableRangeRef;
  orientation: ProjectionOrientation;
  status: "ready" | "blocked";
  diagnostics: ProjectionDiagnostic[];
}

interface ProjectedCell {
  coordinate: StableCellRef;
  anchorCellId: CellId;
  valuePath: Array<string | number>;
  value: FormulaScalarWireValue;
}

interface ProjectionDiagnostic {
  code:
    | "occupied-coordinate"
    | "merged-cell-overlap"
    | "projection-overlap"
    | "axis-capacity"
    | "shape-invalid";
  coordinate?: StableCellRef;
  conflictingAnchorCellId?: CellId;
  message: string;
}
```

`RangeProjection` and `ProjectedCell` are read projections rebuilt from the
accepted wire value, anchor, orientation, and current axes. They are never
embedded in `ComputedCellSettlement` or persisted as canonical Cells.

The derived rectangular value matrix is exact:

- A `table` or `list` with `rows` orientation emits one header row containing
  Formula text values for `fields`, followed by the stored value rows.
- A `table` or `list` with `columns` orientation emits the transpose of that
  header-plus-value matrix, so field names occupy the first column.
- A `record` with `record-horizontal` emits its field names in the first row
  and its single value row in the second.
- A `record` with `record-vertical` emits one `[fieldName, value]` row per
  field.
- Table/list values reject record orientations, and record values reject
  table/list orientations. Empty, ragged, or nested structured cells produce
  `shape-invalid`; representation v1 projections require scalar leaf cells.

Header `valuePath`s are `["fields", fieldIndex]`. Stored values use
`["rows", rowIndex, fieldIndex]`; transposition changes coordinates, never the
path into the accepted value. The top-left matrix value is displayed at the
canonical anchor Cell. The anchor remains the projection owner and coordinate
lookup returns its Cell ID plus that display value; only the remaining matrix
coordinates resolve as `projected`. Collision detection ignores exactly this
first anchor placement, not any other coordinate in the Cell span.

Projection rules are deterministic:

1. The anchor coordinate itself is not considered a collision.
2. Any other overlap with a canonical Cell or merged span blocks projection.
3. Overlapping projections block **all** participating projections; iteration
   order never selects a winner.
4. Projection never creates Row or Column IDs. Insufficient materialized axis
   capacity blocks it with `axis-capacity`; `requiredShape` remains available
   while `resolvedExtent` is absent.
5. A projected coordinate resolves to `(anchorCellId, valuePath)` and cannot be
   edited independently. Materialization uses the exact matrix mapping above,
   converts the anchor to the ordinary value represented at its first path,
   and creates ordinary Cells with caller-supplied permanent IDs for every
   remaining coordinate in one ChangeSet.

Materialization maps Formula null to `BlankCellContent`, number/logic to the
corresponding exact `LiteralCellContent`, and Formula text to a
`RichContentCellContent` whose complete fresh atom/mark IDs are supplied in the
operation. Because nested structured leaves are rejected before projection,
this mapping is total and never needs a generic payload Cell.

## Validation and Conditional Formatting

```ts
interface CellValidation {
  rule: ValidationRule;
  message?: RichContent;
}

type ValidationRule =
  | {
      kind: "list";
      source:
        | { kind: "values"; options: ValidationListOption[] }
        | { kind: "range"; range: StableRangeRef };
    }
  | { kind: "number-range"; min?: ExactCellNumber; max?: ExactCellNumber }
  | { kind: "date-range"; minIsoDate?: string; maxIsoDate?: string }
  | { kind: "text-length"; min?: number; max?: number }
  | { kind: "custom"; formula: GridRuleFormulaSource };

interface ValidationListOption {
  id: string;
  content: RichContent;
}

interface SheetRule {
  id: SheetRuleId;
  range: StableRangeRef;
  condition: ConditionalFormatCondition;
  style: CellStyleProperties;
}

type ConditionalFormatCondition =
  | { kind: "formula"; formula: GridRuleFormulaSource }
  | {
      kind: "value";
      operator:
        | "eq"
        | "neq"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "contains"
        | "not-contains";
      value: FormulaScalarWireValue;
    };

type SpreadsheetRichContentTarget =
  | { kind: "cell-content"; sheetId: SheetId; cellId: CellId }
  | { kind: "validation-message"; sheetId: SheetId; cellId: CellId }
  | {
      kind: "validation-list-option";
      sheetId: SheetId;
      cellId: CellId;
      optionId: string;
    }
  | { kind: "chart-title"; sheetId: SheetId; overlayId: SheetOverlayId }
  | {
      kind: "chart-axis-title";
      sheetId: SheetId;
      overlayId: SheetOverlayId;
      axis: "category" | "value";
    }
  | {
      kind: "chart-series-name";
      sheetId: SheetId;
      overlayId: SheetOverlayId;
      seriesId: string;
    };
```

Rule array order is low-to-high priority; later matching properties win.
Conditional formatting is a presentation overlay and never mutates the Cell's
selected Style, local overrides, or Rich Content marks. Formula-bearing
validation and rule conditions must pass the same stable-reference admission
path as Formula Cells; a generic operation cannot persist raw formula text.
`SpreadsheetRichContentTarget` is the closed locator used by Rich Text
operations and Formula-atom attempts; no generic string path or array index is
accepted.

## Typed Sheet overlays

Overlays are authored, revisioned backend objects, but rendering remains a
frontend/export concern. Their placement is anchored to stable grid identity
with point offsets and dimensions; no pixel geometry or render cache is
canonical.

```ts
type SheetOverlay =
  | SpreadsheetChartOverlay
  | SpreadsheetImageOverlay
  | SpreadsheetSparklineOverlay;

type SheetOverlayKind = "chart" | "image" | "sparkline";

interface SheetOverlayBase<TKind extends SheetOverlayKind> {
  id: SheetOverlayId;
  kind: TKind;
  /** Sole overlay layering authority; unique contiguous back-to-front. */
  zIndex: number;
  placement: SheetOverlayPlacement;
  hidden: boolean;
  locked: boolean;
}

interface SheetOverlayPlacement {
  anchor: StableCellRef;
  offsetXPt: number;
  offsetYPt: number;
  widthPt: number;
  heightPt: number;
}

interface SpreadsheetChartOverlay extends SheetOverlayBase<"chart"> {
  kind: "chart";
  chart: SpreadsheetChart;
}

interface SpreadsheetChart {
  kind: "column" | "bar" | "line" | "area" | "pie" | "scatter";
  title?: RichContent;
  axes?: {
    category?: SpreadsheetChartAxis;
    value?: SpreadsheetChartAxis;
  };
  series: SpreadsheetChartSeries[];
  showLegend: boolean;
  palette?: WorkbookColorValue[];
}

interface SpreadsheetChartAxis {
  title?: RichContent;
  minimum?: ExactCellNumber;
  maximum?: ExactCellNumber;
  showGridLines: boolean;
}

interface SpreadsheetChartSeries {
  id: string;
  name?: RichContent;
  values: StableRangeRef;
  categories?: StableRangeRef;
  color?: WorkbookColorValue;
}

interface ImageSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface SpreadsheetImageOverlay extends SheetOverlayBase<"image"> {
  kind: "image";
  source: ImageSnapshotRef;
  fit: "contain" | "cover" | "stretch";
  alt: string;
  decorative: boolean;
  border?: CellBorderStyle;
}

interface SpreadsheetSparklineOverlay extends SheetOverlayBase<"sparkline"> {
  kind: "sparkline";
  source: StableRangeRef;
  sparklineKind: "line" | "column" | "win-loss";
  color: WorkbookColorValue;
  showMarkers: boolean;
}
```

Overlay `zIndex` values are unique and contiguous `0..n-1` within a Sheet.
Chart title and series names are Rich Content and use the same project-only
Formula-atom boundary described above. Images store an immutable General Files
snapshot reference, not bytes or a mutable file head. Alternative text is a
plain accessibility string; a decorative image requires an empty `alt`.

## Canonical versus derived state

| Canonical Workbook state | Derived / operational state |
|---|---|
| Embedded Theme, tokens, and Cell Styles | Resolved Style per coordinate |
| Sheet/Row/Column order arrays and records | A1 labels and visible indexes |
| Sparse Cells, spans, sources, and exact settlements | Occupancy map and projected grid windows |
| Formula stable-reference manifests | Parsed Formula AST and dependency graph |
| Accepted Formula/Data wire values and dependency identities | Calculation plan and dirty-set index |
| Prompt Content exact output references | Output text/freshness read from Derived Outputs |
| Validation, Conditional Formatting rules, typed overlays | Rule matches, chart series values, rendered geometry |
| Base snapshots and ChangeSets | Compaction schedule and query caches |

Spreadsheet does not own browser nodes, pixels, a rendering engine, thumbnails,
chart rasterization, export layout, or render caches. Those are outside the
backend capability boundary, not deferred Spreadsheet subsystems.

## Deliberate representation-v1 limits

- Calculation cycles settle as errors; iterative convergence is not modeled.
- Rich Content Formula atoms cannot address A1/range references.
- Conditional/validation Formula references bind once rather than rebinding
  relative to every target coordinate.
- Gradients and arbitrary drawing paths are absent from overlay appearance.
- Data Cells adopt project resolver bindings but do not write back to or create
  Structured Data entries.

These are explicit semantic boundaries. They can be extended with new closed
types and staged workflows without changing the authority model above.
