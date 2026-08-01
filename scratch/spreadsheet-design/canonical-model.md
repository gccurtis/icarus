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

type WorkbookLifecycle = "active" | "archived" | "trashed";
type RichContent = import("#rich-text").RichContent;
type FormulaWireValue = import("#formula").FormulaWireValue;
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
mutation; manual mode keeps affected formulas pending until an explicit
calculation request.

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
5. Materialized Cell Style and local overrides.
6. Matching Conditional Formatting rules, in rule order.
7. For `RichContent`, stored Rich Text marks as supplementary inline styling.

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
```

The keys of each axis record must exactly equal its order array. A1 notation is
a projection of the current array positions, never canonical identity. Row and
Column IDs remain stable when axes move. Freeze panes address stable boundary
IDs rather than fragile counts; inserting before a boundary joins the frozen
prefix, while deleting the boundary must clear or replace it in the same
ChangeSet.

Workbook-wide identity ledgers prevent reuse of retired Sheet, Row, Column,
Cell, Style, rule, and overlay IDs. IDs are unique within their resource kind,
including across Sheets where an operation otherwise could become ambiguous.

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

An entirely default blank coordinate has no Cell record. A styled, validated,
referenced, or merged blank is materialized as a Cell with `blank` content.
Sparse therefore means “only semantically materialized coordinates,” not “only
coordinates with a visible value.”

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
  | { kind: "number"; decimal: string }
  | { kind: "logic"; value: boolean }
  | { kind: "date"; isoDate: string }
  | { kind: "date-time"; isoDateTime: string };
```

Authored prose is always `RichContent`, even when it currently has no marks.
This gives every authored text Cell the same marks, links, references, Formula
atoms, `{{ ... }}` conversion, normalization, and exact-inverse behavior as
Document and Slides. Plain strings remain appropriate for administrative
labels and immutable externally generated Prompt Content. Literal numbers use
a canonical decimal string so admission does not lose precision through a
JavaScript floating-point round trip. Blank is distinct from an empty text
value, zero, and Formula null.

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
  formula: SpreadsheetFormulaSource;
  /** Required only when an accepted list/record/table should spill. */
  projectionOrientation?: ProjectionOrientation;
  settlement: ComputedCellSettlement;
}

interface SpreadsheetFormulaSource {
  languageVersion: "spreadsheet-formula/v1";
  /** Stable coordinate at which relative/absolute authoring was admitted. */
  anchor: StableCellRef;
  /** Exact user submission, including an optional leading '='. */
  authoredText: string;
  /** Formula/v1 source with grid references replaced by reserved aliases. */
  normalizedFormulaSource: string;
  /** All non-local, non-builtin dependencies captured at admission. */
  bindings: SpreadsheetFormulaBinding[];
  /** Digest of all preceding semantic fields, not of authoredText alone. */
  sourceDigest: string;
}

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

Moving or inserting axes changes the rendered A1 text but never the stable
targets. Deleting a referenced axis yields a typed broken-reference diagnostic
rather than retargeting. Copy/fill translates only axes marked `relative` and
creates a newly admitted manifest; `$`-absolute axes keep their stable target.

The same admitted `SpreadsheetFormulaSource` type is used by custom Cell
validation and Formula-based Conditional Formatting. In representation v1,
their external references bind once to stable coordinates at rule admission;
they are not rebound relative to every target coordinate. Evaluation may
expose the target's candidate/current scalar through one reserved local. Full
Excel-style relative-per-target rule templates are a future authoring-layer
extension, not an implied behavior.

### Formula settlement

```ts
type ComputedCellSettlement =
  | { state: "pending"; sourceDigest: string }
  | { state: "accepted"; accepted: AcceptedComputedCellValue }
  | { state: "error"; rejected: RejectedComputedCellValue };

interface AcceptedComputedCellValue {
  sourceDigest: string;
  value: FormulaWireValue;
  dependencies: SpreadsheetObservedDependency[];
  resolverSnapshotDigest: string;
  evaluationDigest: string;
  /** Present for a Data Cell settled from one project binding. */
  externalBinding?: AcceptedProjectBinding;
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
are rebuildable.

### Rich Content Formula atoms are a distinct path

A `RichContentCellContent` may contain any number of Rich Text Formula atoms.
Their expression, accepted `FormulaWireValue`, display text, and diagnostic live
inside the atom. Spreadsheet evaluates them through the same durable
compute/settle pattern used by Document and Slides, then applies Rich Text's
`apply-formula-result` operation conditionally to the same Cell and atom.

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
  settlement: ComputedCellSettlement;
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

Derived Outputs owns the prompt definition, Context scope, stabilization text,
evidence, freshness, generation, and immutable string revisions. Spreadsheet
stores only the exact reference and displays the referenced plain text through
the Cell's resolved Style. Prompt Content never spills. Deleting the Cell marks
Spreadsheet's local ownership record detached for history/idempotency;
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
  extent: StableRangeRef;
  orientation: ProjectionOrientation;
  status: "ready" | "blocked";
  diagnostics: ProjectionDiagnostic[];
}

interface ProjectedCell {
  coordinate: StableCellRef;
  anchorCellId: CellId;
  valuePath: Array<string | number>;
  value: FormulaWireValue;
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

Projection rules are deterministic:

1. The anchor coordinate itself is not considered a collision.
2. Any other overlap with a canonical Cell or merged span blocks projection.
3. Overlapping projections block **all** participating projections; iteration
   order never selects a winner.
4. Projection never creates Row or Column IDs. Insufficient materialized axis
   capacity blocks it with `axis-capacity`.
5. A projected coordinate resolves to `(anchorCellId, valuePath)` and cannot be
   edited independently. Materialization is an explicit operation that creates
   ordinary Cells with supplied permanent IDs.

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
        | { kind: "values"; values: RichContent[] }
        | { kind: "range"; range: StableRangeRef };
    }
  | { kind: "number-range"; minDecimal?: string; maxDecimal?: string }
  | { kind: "date-range"; minIsoDate?: string; maxIsoDate?: string }
  | { kind: "text-length"; min?: number; max?: number }
  | { kind: "custom"; formula: SpreadsheetFormulaSource };

interface SheetRule {
  id: SheetRuleId;
  range: StableRangeRef;
  condition: ConditionalFormatCondition;
  style: CellStyleProperties;
}

type ConditionalFormatCondition =
  | { kind: "formula"; formula: SpreadsheetFormulaSource }
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
      value: FormulaWireValue;
    };
```

Rule array order is low-to-high priority; later matching properties win.
Conditional formatting is a presentation overlay and never mutates the Cell's
selected Style, local overrides, or Rich Content marks. Formula-bearing
validation and rule conditions must pass the same stable-reference admission
path as Formula Cells; a generic operation cannot persist raw formula text.

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

interface SheetOverlayBase {
  id: SheetOverlayId;
  kind: SheetOverlay["kind"];
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

interface SpreadsheetChartOverlay extends SheetOverlayBase {
  kind: "chart";
  chart: SpreadsheetChart;
}

interface SpreadsheetChart {
  kind: "column" | "bar" | "line" | "area" | "pie" | "scatter";
  title?: RichContent;
  series: SpreadsheetChartSeries[];
  showLegend: boolean;
  palette?: WorkbookColorValue[];
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

interface SpreadsheetImageOverlay extends SheetOverlayBase {
  kind: "image";
  source: ImageSnapshotRef;
  fit: "contain" | "cover" | "stretch";
  alt: string;
  decorative: boolean;
  border?: CellBorderStyle;
}

interface SpreadsheetSparklineOverlay extends SheetOverlayBase {
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
