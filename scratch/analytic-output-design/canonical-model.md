# Analytic Output — canonical model

## Aggregate boundary

The aggregate is one saved output definition. Its canonical authored snapshot
contains one input binding, ordered field placements, ordered filters and
sorts, and one View. Materialization attempts and immutable results are durable
capability state, but they are not part of the authored snapshot replayed by
ChangeSets.

```ts
type AnalyticOutputId = string;
type AnalyticPlacementId = string;
type AnalyticFilterId = string;
type AnalyticSortId = string;
type AnalyticAttemptId = string;
type AnalyticMaterializationId = string;

type AnalyticOutputLifecycle = "active" | "archived" | "trashed";
type AnalyticOutputOrigin = "interactive" | "agent" | "automation";

interface AnalyticOutputHead {
  id: AnalyticOutputId;
  title: string;
  lifecycle: AnalyticOutputLifecycle;
  revision: number;
  baseSeq: number;
  semanticDigest: string;

  /** Operational pointer; excluded from authored semanticDigest. */
  latestMaterializationId?: AnalyticMaterializationId;
  latestMaterializationSeq?: number;

  createdAt: string;
  updatedAt: string;
}

interface AnalyticOutputSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: AnalyticOutputLifecycle;
  definition: AnalyticOutputDefinition;
}

interface AnalyticOutputDefinition {
  input?: AnalyticInputRef;
  layout: AnalyticLayout;
  filters: AnalyticFilter[];
  sorts: AnalyticSort[];
  limit?: number;
  view: AnalyticView;
}
```

An output may be created before an input or fields are selected. This is valid
authored state for an interactive builder. A materialization request applies
the stricter executable-definition validation and returns typed diagnostics for
an incomplete or incompatible definition.

`revision` advances only through an accepted authored ChangeSet. Advancing the
latest materialization pointer does not change it.

## Input identity and exact freeze

The definition selects one project Formula binding by stable ID. `displayName`
is retained only to explain the selection in the UI and in diagnostics.

```ts
interface AnalyticInputRef {
  kind: "project-formula-binding";
  bindingId: string;
  displayName: string;
}

interface AnalyticInputManifest {
  bindingId: string;
  displayName: string;
  ownerRevision: number | string;
  valueDigest: string;
  resolverSnapshotDigest: string;
  valueKind: AnalyticInputValueKind;
}

type AnalyticInputValueKind =
  | "null"
  | "number"
  | "text"
  | "logic"
  | "list"
  | "record"
  | "table";

interface FrozenAnalyticInput {
  manifest: AnalyticInputManifest;
  /** Exact JSON-safe Formula value used by concurrent computation. */
  value: FormulaWireValue;
  byteLength: number;
}
```

`FormulaWireValue` is imported from `0-platform/formula/wire.ts`. Functions are
not wire-serializable and are rejected by the input reader. The freeze stores
the exact value because the current Formula resolver exposes current bindings,
not historical value reads.

An adapter over `FormulaNameResolver` implements the capability port:

```ts
interface AnalyticInputReader {
  freeze(input: AnalyticInputRef): Promise<FrozenAnalyticInput>;
}
```

The adapter looks up a binding by `reference.bindingId`, not by map key or
display name. It verifies that the selected ID still exists and that its value
is wire-serializable. If the declaration has been renamed, the frozen manifest
uses the resolver's current display name while the definition may be updated
separately for presentation.

## Input normalization

Every admitted wire value is normalized into an executor table:

```ts
interface AnalyticInputTable {
  fields: string[];
  rows: FormulaWireValue[][];
}
```

The mapping is deterministic:

| Formula value | Normalized fields | Normalized rows |
|---|---|---|
| `table` | original ordered fields | original ordered rows |
| `record` | original ordered fields | its one row |
| `list` | `value` | one row per list element |
| scalar or `null` | `value` | one row containing the scalar |

Field order and row order are preserved until a sort or grouping operation
changes them. Duplicate field names are invalid Formula table data and cause a
typed input diagnostic.

## Field references and placements

Current Structured Data fields have names but not stable field IDs. An
Analytic Output therefore stores a field path plus a stable local placement ID.
The placement ID survives label, role, aggregation, and channel changes. The
path is resolved against each frozen input value during materialization.

```ts
interface AnalyticFieldRef {
  /** One or more exact, case-sensitive field names. */
  path: string[];
}

type AnalyticFieldRole = "dimension" | "measure";

type AnalyticAggregation =
  | "count"
  | "count-distinct"
  | "sum"
  | "mean"
  | "min"
  | "max";

interface AnalyticFieldPlacement {
  id: AnalyticPlacementId;
  field: AnalyticFieldRef;
  label?: string;
  role: AnalyticFieldRole;
  aggregation?: AnalyticAggregation;
  includeNulls: boolean;
}

type AnalyticPlacementChannel =
  | "rows"
  | "columns"
  | "color"
  | "size"
  | "label"
  | "detail"
  | "tooltip";

interface AnalyticLayout {
  /** Ordered top-to-bottom grouping/measure shelf. */
  rows: AnalyticFieldPlacement[];
  /** Ordered left-to-right grouping/measure shelf. */
  columns: AnalyticFieldPlacement[];
  encodings: {
    color?: AnalyticFieldPlacement;
    size?: AnalyticFieldPlacement;
    label?: AnalyticFieldPlacement;
    detail: AnalyticFieldPlacement[];
    tooltip: AnalyticFieldPlacement[];
  };
}
```

A placement exists in exactly one channel. Placement IDs are unique across the
entire output, not merely within a shelf. Rows, Columns, Detail, and Tooltip are
ordered arrays. Color, Size, and Label are singletons.

The last path segment is the default display label. A local `label` changes
presentation without renaming Data. Paths can traverse nested record values.
Traversal through null returns null. Traversal through a scalar, list, or table
where a record field is required yields a typed field-resolution diagnostic.

### Aggregation rules

- `count` accepts any value kind and counts admitted non-null values;
- `count-distinct` accepts any wire-serializable value and uses canonical wire
  bytes for equality;
- `sum` and `mean` require exact Formula numbers;
- `min` and `max` require one consistently comparable scalar kind: number,
  text, or logic;
- an unaggregated placement projects the value from each filtered input row;
- when any placement aggregates, every unaggregated placement becomes a group
  key and every aggregated placement becomes a measure;
- a group key uses canonical Formula wire bytes, so exact rational identity is
  preserved.

Null grouping is controlled by the placement's `includeNulls`. Aggregations do
not coerce text to number or logic to number. Empty `sum`, `mean`, `min`, and
`max` groups yield null; `count` and `count-distinct` yield exact zero.

## Filters

Filters are closed typed values. They run over the normalized input before
grouping and may reference fields that are not displayed.

```ts
type AnalyticComparisonOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";

type AnalyticFilter =
  | {
      id: AnalyticFilterId;
      kind: "comparison";
      field: AnalyticFieldRef;
      operator: AnalyticComparisonOperator;
      value: FormulaWireValue;
    }
  | {
      id: AnalyticFilterId;
      kind: "set";
      field: AnalyticFieldRef;
      operator: "in" | "not-in";
      values: FormulaWireValue[];
    }
  | {
      id: AnalyticFilterId;
      kind: "range";
      field: AnalyticFieldRef;
      lower?: { value: FormulaWireValue; inclusive: boolean };
      upper?: { value: FormulaWireValue; inclusive: boolean };
    }
  | {
      id: AnalyticFilterId;
      kind: "null";
      field: AnalyticFieldRef;
      operator: "is-null" | "is-not-null";
    }
  | {
      id: AnalyticFilterId;
      kind: "text";
      field: AnalyticFieldRef;
      operator: "contains" | "starts-with" | "ends-with";
      value: string;
      caseSensitive: boolean;
    };
```

Filter array order is canonical, but the result is logical AND across all
filters. Order is retained for authoring and deterministic diagnostics. Nested
boolean groups and arbitrary Formula predicates are outside this
representation; adding them requires an explicit expression tree rather than
encoding control flow in strings.

Comparison and range filters require compatible scalar kinds. Equality uses
canonical wire identity. A set filter cannot contain a function and is bounded
by configuration. Text filters require a text field. A range must have at least
one bound.

## Sorts and result limit

Sorts operate after grouping/projection. A sort targets a placement result, not
a raw input field. This prevents a hidden pre-aggregation order from changing
aggregate semantics.

```ts
interface AnalyticSort {
  id: AnalyticSortId;
  placementId: AnalyticPlacementId;
  direction: "ascending" | "descending";
  nulls: "first" | "last";
}
```

The `sorts` array is highest-to-lowest priority. Ties preserve prior row order
through a stable sort. Sort values must be consistently comparable. If no sort
is present, unaggregated output preserves input order; grouped output uses the
canonical first-seen group order.

`limit`, when present, is a positive integer applied after sorting. It limits
result rows and does not alter the exact input manifest.

## Authored Views

A View contains semantic presentation choices only. It does not contain
renderer-specific option bags.

```ts
interface AnalyticAxisSpec {
  title?: string;
  scale: "linear" | "log";
  includeZero: boolean;
  minimum?: FormulaWireValue;
  maximum?: FormulaWireValue;
}

interface AnalyticViewBase {
  title?: string;
  subtitle?: string;
  accessibilityLabel: string;
}

interface AnalyticChartViewBase extends AnalyticViewBase {
  showLegend: boolean;
  showLabels: boolean;
}

type AnalyticView =
  | (AnalyticViewBase & {
      kind: "table";
      showHeaders: boolean;
      showTotals: boolean;
    })
  | (AnalyticViewBase & {
      kind: "metric";
      format: "number" | "percent" | "currency";
      currencyCode?: string;
    })
  | (AnalyticChartViewBase & {
      kind: "bar";
      orientation: "vertical" | "horizontal";
      stack: "none" | "standard" | "normalized";
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
    })
  | (AnalyticChartViewBase & {
      kind: "line" | "area";
      stack: "none" | "standard" | "normalized";
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
      connectNulls: boolean;
    })
  | (AnalyticChartViewBase & {
      kind: "scatter";
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
    })
  | (AnalyticChartViewBase & {
      kind: "pie";
      innerRadiusRatio: number;
    });
```

An axis minimum/maximum must be an exact Formula number. Log scale requires
strictly positive resolved values and bounds and therefore requires
`includeZero: false`. `innerRadiusRatio` is finite and
within `0..1`; zero is a pie and a positive value is a doughnut presentation.
Currency code is present only for currency metric format.

View-specific executable validation occurs against resolved placements:

| View | Required resolved placements |
|---|---|
| table | at least one placement across Rows, Columns, or encodings |
| metric | exactly one numeric measure; no grouping dimension |
| bar | at least one dimension and one numeric measure |
| line / area | at least one ordered dimension and one numeric measure |
| scatter | one numeric placement on each positional shelf |
| pie | one dimension and one non-negative numeric measure |

Color and Detail may add series/grouping dimensions. Size requires a numeric
placement. Label and Tooltip may reference any scalar placement. A nested
collection cannot be sent directly to a chart channel; it must first be
projected to a scalar field.

## Result schema and exact data

Each placement becomes one result field keyed by its stable placement ID.
Repeated use of the same input path in different placements intentionally
produces separate result fields because their labels or aggregations may differ.

```ts
type AnalyticResolvedValueKind =
  | "null"
  | "number"
  | "text"
  | "logic"
  | "list"
  | "record"
  | "table"
  | "mixed";

interface AnalyticResultField {
  id: AnalyticPlacementId;
  label: string;
  sourcePath: string[];
  role: AnalyticFieldRole;
  aggregation?: AnalyticAggregation;
  valueKind: AnalyticResolvedValueKind;
}

interface AnalyticResultData {
  fields: AnalyticResultField[];
  /** Each row has exactly fields.length cells in the same order. */
  rows: FormulaWireValue[][];
}
```

Field order is deterministic: Rows, Columns, Color, Size, Label, Detail, then
Tooltip, preserving order inside each channel and de-duplicating no placement.

## Resolved Views

The executor converts authored shelf semantics into explicit result-field
channels. Every ID below must occur in `AnalyticResultData.fields`.

```ts
interface ResolvedViewBase {
  title?: string;
  subtitle?: string;
  accessibilityLabel: string;
}

interface ResolvedChartViewBase extends ResolvedViewBase {
  showLegend: boolean;
  showLabels: boolean;
  colorFieldId?: AnalyticPlacementId;
  sizeFieldId?: AnalyticPlacementId;
  labelFieldId?: AnalyticPlacementId;
  detailFieldIds: AnalyticPlacementId[];
  tooltipFieldIds: AnalyticPlacementId[];
}

type ResolvedAnalyticView =
  | (ResolvedViewBase & {
      kind: "table";
      rowFieldIds: AnalyticPlacementId[];
      columnFieldIds: AnalyticPlacementId[];
      showHeaders: boolean;
      showTotals: boolean;
    })
  | (ResolvedViewBase & {
      kind: "metric";
      valueFieldId: AnalyticPlacementId;
      format: "number" | "percent" | "currency";
      currencyCode?: string;
    })
  | (ResolvedChartViewBase & {
      kind: "bar";
      xFieldIds: AnalyticPlacementId[];
      yFieldIds: AnalyticPlacementId[];
      orientation: "vertical" | "horizontal";
      stack: "none" | "standard" | "normalized";
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
    })
  | (ResolvedChartViewBase & {
      kind: "line" | "area";
      xFieldIds: AnalyticPlacementId[];
      yFieldIds: AnalyticPlacementId[];
      stack: "none" | "standard" | "normalized";
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
      connectNulls: boolean;
    })
  | (ResolvedChartViewBase & {
      kind: "scatter";
      xFieldId: AnalyticPlacementId;
      yFieldId: AnalyticPlacementId;
      xAxis?: AnalyticAxisSpec;
      yAxis?: AnalyticAxisSpec;
    })
  | (ResolvedChartViewBase & {
      kind: "pie";
      categoryFieldId: AnalyticPlacementId;
      valueFieldId: AnalyticPlacementId;
      innerRadiusRatio: number;
    });
```

The frontend renders `ResolvedAnalyticView + AnalyticResultData`. It is not
required to repeat backend field-role or View compatibility logic.

Shelf-to-channel resolution is deterministic:

| View | Resolved positional channels |
|---|---|
| table | Rows → `rowFieldIds`; Columns → `columnFieldIds` |
| vertical bar, line, area | Columns → X; Rows → Y |
| horizontal bar | Rows → X; Columns → Y |
| scatter | the one numeric Column → X; the one numeric Row → Y |
| metric | the sole measure placement → value |
| pie | the sole dimension → category; the sole measure → value, regardless of which positional shelf holds each |

View validation rejects ambiguous shelf arrangements rather than selecting a
field by incidental array or object iteration order.

## Attempts, candidates, and materializations

```ts
type AnalyticAttemptState =
  | "requested"
  | "computing"
  | "candidate-ready"
  | "settled"
  | "stale"
  | "failed";

interface AnalyticMaterializationAttempt {
  id: AnalyticAttemptId;
  outputId: AnalyticOutputId;
  materializationSeq: number;
  clientRequestId: string;
  requestDigest: string;
  frozenOutputRevision: number;
  frozenDefinitionDigest: string;
  frozenInput: FrozenAnalyticInput;
  state: AnalyticAttemptState;
  candidateId?: string;
  materializationId?: AnalyticMaterializationId;
  diagnostic?: AnalyticDiagnostic;
  createdAt: string;
  updatedAt: string;
}

interface AnalyticMaterializationCandidate {
  id: string;
  attemptId: AnalyticAttemptId;
  resultData: AnalyticResultData;
  resolvedView: ResolvedAnalyticView;
  executorVersion: string;
  candidateDigest: string;
  createdAt: string;
}

interface AnalyticMaterialization {
  id: AnalyticMaterializationId;
  outputId: AnalyticOutputId;
  attemptId: AnalyticAttemptId;
  materializationSeq: number;
  outputRevision: number;
  definitionDigest: string;
  inputManifest: AnalyticInputManifest;
  resultData: AnalyticResultData;
  resolvedView: ResolvedAnalyticView;
  executorVersion: string;
  digest: string;
  createdAt: string;
}

interface AnalyticDiagnostic {
  code:
    | "missing_input"
    | "binding_not_found"
    | "non_serializable_input"
    | "input_too_large"
    | "invalid_input_shape"
    | "field_not_found"
    | "field_type_mismatch"
    | "invalid_filter"
    | "invalid_aggregation"
    | "invalid_sort"
    | "invalid_view"
    | "result_limit_exceeded"
    | "stale_definition"
    | "internal_error";
  message: string;
  placementId?: AnalyticPlacementId;
  filterId?: AnalyticFilterId;
  sortId?: AnalyticSortId;
  fieldPath?: string[];
}
```

Candidate and materialization digests use canonical JSON with deterministic
object keys and array order. The final digest covers output identity, frozen
revision, definition digest, input manifest, result data, resolved View, and
executor version.

Settlement inserts the materialization exactly once. It advances
`latestMaterializationId` only when:

1. the current output revision equals `frozenOutputRevision`;
2. the current definition digest equals `frozenDefinitionDigest`;
3. the attempt's `materializationSeq` is greater than the current latest
   materialization sequence; and
4. the output is not trashed.

Failure of these pointer conditions marks the attempt `stale` but does not
invalidate or delete the immutable materialization.

## Authored history

```ts
interface AnalyticOutputBase {
  representationVersion: 1;
  outputId: AnalyticOutputId;
  baseSeq: number;
  snapshot: AnalyticOutputSnapshot;
  semanticDigest: string;
  createdAt: string;
}

interface AnalyticOutputChangeSet {
  id: string;
  outputId: AnalyticOutputId;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;
  origin: AnalyticOutputOrigin;
  actorId: string;
  operations: AnalyticOutputOperation[];
  inverseOperations: AnalyticOutputOperation[];
  touchedIds: string[];
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  semanticDigest: string;
  createdAt: string;
}
```

`AnalyticOutputOperation` is defined in [Operations](operations.md). IDs for
placements, filters, and sorts enter a permanent output-local identity ledger.
Deletion tombstones them; only exact compensation may reactivate the same ID.

## Canonical, operational, and derived state

| Canonical authored state | Durable operational/result state | Rebuildable state |
|---|---|---|
| Output head metadata | Materialization attempts and stage receipts | Input schema inference cache |
| Bases and ChangeSets | Frozen exact Formula input values | Field-path lookup plans |
| Input ref, shelves, filters, sorts, View | Immutable candidates and materializations | Filter/sort execution plans |
| Identity ledger and command receipts | Latest materialization pointer and activity outbox | Accessible table projection for a View |
| Exact inverse operations | Input/result/digest manifests | Frontend render trees, pixels, thumbnails |

Deleting rebuildable state must not change snapshot replay or the bytes of an
immutable materialization.

## Limits

```ts
interface AnalyticOutputLimits {
  maxTitleBytes: number;
  maxPlacements: number;
  maxFilters: number;
  maxFilterSetValues: number;
  maxSorts: number;
  maxFieldPathDepth: number;
  maxFrozenInputBytes: number;
  maxInputRows: number;
  maxResultRows: number;
  maxResultCells: number;
  maxResultBytes: number;
  maxRetainedBases: number;
  maxRetainedChangeSets: number;
  maxRetainedTerminalAttempts: number;
  maxRetainedMaterializations: number;
}
```

Limits are injected from configuration. The executor checks input bounds before
compute and result row/cell/byte bounds before publishing a candidate.

## Invariants

1. An output has one monotonic authored revision and one contiguous ChangeSet
   sequence.
2. A placement, filter, or sort ID is unique for the life of its output.
3. A placement exists in exactly one Rows/Columns/encoding channel.
4. Filter and sort ordering has one authority: array order.
5. The input is selected by stable Formula binding ID; display name is never a
   fallback identity.
6. Frozen computation uses the persisted exact Formula wire value.
7. Functions cannot enter an Analytic Output materialization.
8. Filter, grouping, aggregation, sort, limit, and View resolution occur in the
   fixed executor order.
9. Numeric aggregation preserves Formula's exact rational representation.
10. Every resolved View field ID occurs exactly once in the result schema.
11. A materialization is immutable and content-digested.
12. A stale materialization cannot advance the current output pointer.
13. Advancing a materialization pointer does not create an authored revision.
14. No renderer-specific untyped object is admitted to the canonical View.
15. Historical replay depends only on retained Bases, ChangeSets, and exact
    immutable references—not current Structured Data values.
