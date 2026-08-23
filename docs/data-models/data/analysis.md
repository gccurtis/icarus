# Analysis / analytic model

An analysis is a project-scoped saved analytic: an ordered definition over
project variables plus the last complete chart or table component produced by
that definition.

Read the [analytic system overview](analytic-system-overview.md) first. It
explains the presentation model, table algebra, surface boundary, and review
principles. The shipping TypeScript contract is
[`app/src/lib/json-store/types/data/analytic.ts`](../../../app/src/lib/json-store/types/data/analytic.ts).

## Stored row and reusable model

The eventual `analyses` table wraps project metadata around the surface-neutral
model:

```ts
interface Analysis {
  projectId: Id<"projects">;
  model: AnalyticModel;
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
}

interface AnalyticModel {
  id: string;
  title: string;
  definition: AnalyticDataDefinition;
  component: AnalyticComponentModel;
  materialization: AnalyticMaterialization;
}
```

`AnalyticModel.id` is the semantic ID passed to every surface and selection
target. The Convex row ID is storage identity. Keeping the semantic ID in the
model allows a copied or embedded projection to remain addressable without
leaking a database identifier into renderers.

## Inputs

```ts
interface AnalyticDataDefinition {
  inputs: AnalyticInput[];
  dimensions: AnalyticDimension[];
  bridges: AnalyticBridge[];
  data: AnalyticDataChannel;
}

interface AnalyticInput {
  id: string;
  variable: string;
  as?: string;
}
```

An input names a project [Name Manager](name-manager.md) variable. Its current
value is resolved and normalized to a table at evaluation time. The definition
does not persist whether that variable happened to be a scalar, list, record,
table, range, or function result on the last run.

`id` qualifies every internal reference. `as` is a readable alias and permits
self-joins, but it is not identity. Renaming a variable or alias does not change
the input ID.

## List selection

```ts
type AnalyticListSelector =
  | { kind: "column"; key: string }
  | { kind: "row"; index: number }
  | { kind: "function"; formulaId: Id<"formulas"> };

interface AnalyticListReference {
  inputId: string;
  selector: AnalyticListSelector;
}
```

A dimension consumes a list, not an ambiguous table. A selector explicitly
chooses:

- a body column by normalized key;
- a zero-based data row, excluding headers; or
- a formula lambda over the complete normalized table.

A list or scalar normalizes to a `value` column and can select that column
automatically. A table, record, range result, or function result needs an
explicit selector. The compact error is “Needs a list, not a table”; the
detailed editor offers column, row, and function choices.

## Dimensions

```ts
type AnalyticSlot = "x" | "y" | "data" | "labels" | "size";

interface AnalyticDimension {
  id: string;
  slot: Exclude<AnalyticSlot, "data">;
  inputs: AnalyticDimensionInput[];
  steps: AnalyticDimensionStep[];
  operations: AnalyticDimensionOperation[];
}

interface AnalyticDimensionInput {
  id: string;
  inputId: string;
  values: AnalyticListSelector;
  label?: string;
}

type AnalyticDimensionStep =
  | {
      id: string;
      kind: "extend";
      rightBindingId: string;
    }
  | {
      id: string;
      kind: "join";
      rightBindingId: string;
      leftKey: AnalyticListReference;
      rightKey: AnalyticListReference;
      join: AnalyticJoinKind;
      values: "left" | "right" | "coalesce";
    };

type AnalyticJoinKind = "inner" | "left" | "right" | "outer";
```

X and Y use the same structure because both are lists built from relations.
Labels and Size also use it because they are aligned lists, even though they do
not draw axes.

The first `inputs` entry starts the dimension. Every later entry is consumed by
exactly one `steps` entry. Steps are persisted and executed in array order:

- `extend` stacks the right list beneath the accumulated list;
- `join` relates the accumulated relation to the right input by two selected
  keys, then chooses which side supplies displayed values.

The default UI join is `outer`, preserving unmatched rows as nulls. The model
also permits inner, left, and right joins.

### Dimension-local operations

```ts
type AnalyticFormulaReference = {
  kind: "formula";
  formulaId: Id<"formulas">;
};

type AnalyticDimensionOperation =
  | { id: string; kind: "filter"; predicate: AnalyticFormulaReference }
  | { id: string; kind: "group"; by: AnalyticListReference[] }
  | {
      id: string;
      kind: "sort";
      by: AnalyticValueReference | { kind: "values" };
      direction: "asc" | "desc";
    }
  | { id: string; kind: "limit"; count: number }
  | { id: string; kind: "formula"; formulaId: Id<"formulas"> };
```

These operations transform a dimension after its input composition. Their
array order is execution order. A top-three-average workflow can therefore sort
and limit a dimension before the data channel aggregates it.

## Relation references and bridges

```ts
type AnalyticRelationReference =
  | { kind: "input"; inputId: string }
  | { kind: "dimension"; dimensionId: string }
  | { kind: "bridge"; bridgeId: string };

interface AnalyticBridge {
  id: string;
  kind: "join";
  left: AnalyticRelationReference;
  right: AnalyticRelationReference;
  leftKey: AnalyticListReference;
  rightKey: AnalyticListReference;
  join: AnalyticJoinKind;
}
```

A bridge relates independently built relations. Bridges execute top to bottom,
so either side may name an earlier bridge but never a later one. This supports a
chain such as `(X join Y) join Labels` without declaring X, Y, or the first
input to be a permanent root.

Each key must come from the relation on its side. A bridge's output contains the
union of both sides' input sets for validation and later planning.

## Data channel

```ts
interface AnalyticDataChannel {
  from: AnalyticRelationReference;
  operations: AnalyticDataOperation[];
  outputs: AnalyticDataOutput[];
}

type AnalyticAggregation =
  | "sum"
  | "count"
  | "average"
  | "minimum"
  | "maximum"
  | "first"
  | "last";

type AnalyticValueReference =
  | { kind: "list"; list: AnalyticListReference }
  | { kind: "operation"; operationId: string }
  | { kind: "formula"; formulaId: Id<"formulas"> };

type AnalyticDataOperation =
  | { id: string; kind: "filter"; predicate: AnalyticFormulaReference }
  | { id: string; kind: "group"; by: AnalyticListReference[] }
  | {
      id: string;
      kind: "aggregate";
      input: AnalyticValueReference;
      aggregation: AnalyticAggregation;
      as: string;
    }
  | {
      id: string;
      kind: "sort";
      by: AnalyticValueReference;
      direction: "asc" | "desc";
    }
  | { id: string; kind: "limit"; count: number }
  | { id: string; kind: "formula"; formulaId: Id<"formulas">; as?: string };

interface AnalyticDataOutput {
  id: string;
  label: string;
  value: AnalyticValueReference;
  format?: ChartNumberFormat;
}
```

`from` is mandatory. It makes the evaluation relation explicit rather than
guessing the first input or last-created bridge.

Every supplied dimension and every raw list used by a data operation must be
contained in that relation. A disconnected source creates a `missing-bridge`
issue before aggregation. Formulas remain opaque until evaluated, but their
position in the ordered pipeline is explicit.

Operations execute in array order, and an `operation` value reference can name
only an operation above it. `outputs` name the final one or more quantitative
series supplied to the component.

## Reusable component

```ts
type AnalyticComponentModel =
  | { kind: "chart"; chart: ChartModel }
  | { kind: "table"; table: AnalyticTableModel };
```

This is the one output rendered on the analysis page, in a document block, in a
slide element, and over a spreadsheet. The host supplies placement. The
component supplies semantic interaction.

The chart branch nests the full identified [chart model](chart.md). The table
branch is also identified:

```ts
interface AnalyticTableModel {
  id: string;
  title?: string;
  columns: AnalyticTableColumn[];
  rows: AnalyticTableRow[];
}

interface AnalyticTableColumn {
  id: string;
  key: string;
  label: string;
  format?: ChartNumberFormat;
}

interface AnalyticTableRow {
  id: string;
  key: string;
  cells: AnalyticTableCell[];
}

interface AnalyticTableCell {
  id: string;
  columnId: string;
  value: FormulaValue;
}
```

Column, row, and cell IDs survive sorting and rerendering. `key` is source
identity; `label` is presentation. A cell references a column ID rather than an
array position.

## Materialization

```ts
interface AnalyticMaterialization {
  state: "ready" | "stale" | "error";
  issueIds: string[];
  evaluatedAt?: number;
}
```

The editable definition and last complete component coexist intentionally.
Evaluation replaces the component atomically on success. An incomplete edit or
failure preserves the previous output and marks it stale/error with stable
issue IDs.

This makes embeds fast and prevents a temporary broken join from replacing a
client-facing slide chart with an empty box. The component remains a replaceable
projection; it is never independently edited as a second data definition.

## Spreadsheet placement

```ts
interface SpreadsheetAnalytic {
  id: string;
  analyticId: Id<"analyses">;
  anchor: { rowId: string; columnId: string };
  offset: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
}
```

A spreadsheet stores a live analytic reference plus placement, not a copied
chart. Moving or resizing the overlay changes this wrapper. Changing joins or
chart formatting changes the referenced analytic.

Documents and slides follow the same rule through their existing block/element
placement contracts.

## Output slot contract

The customization section is derived from the component kind:

| Display | Slots |
| --- | --- |
| table | Data |
| pie, funnel, treemap | Data, Labels |
| bar, line, area, waterfall, radar | X, optional Y, Data, optional Labels |
| scatter | X, Y, Data, optional Labels |
| bubble | X, Y, Data, Size, optional Labels |
| Mekko, heatmap | X, Y, Data, optional Labels |

Unsupported slots are absent. They are not persisted and ignored. The same
exhaustive function drives the authoring UI and validation boundary.

## Formula-shaped plan

The structured definition compiles one-way into a readable plan using the
project formula vocabulary:

```text
TABLE -> DIMENSION/COLUMN/ROW/APPLY -> EXTEND_DIMENSION/DIMENSION_JOIN/JOIN -> FILTER/GROUP/SORT/LIMIT/
AGGREGATE/APPLY -> CHART_COMPONENT or TABLE_COMPONENT
```

The structured model remains authoritative because a general formula cannot be
reliably edited back into dimension cards and join controls. There is still one
evaluation vocabulary rather than separate “chart query” semantics.

## Validation contract

Validation returns stable issues rather than repairing persisted data. It
checks:

- duplicate IDs and duplicate dimension slots;
- variable names and list selectors;
- missing/forward references;
- exact top-to-bottom dimension consumption;
- bridge side/key membership;
- data relation coverage for every dimension and raw list;
- operation ordering and positive limits;
- output-specific required/unsupported slots;
- chart-family invariants;
- table column, row, and cell identities;
- materialization state consistency.

Errors block a new materialization. Warnings permit incomplete authoring while
the last good component remains visible.

## Revision targets

The revision vocabulary distinguishes nested intent:

| Target | Meaning |
| --- | --- |
| `analytic` | ordered definition and saved analytic identity |
| `analyticComponent` | reusable materialized chart/table output |
| `chart` | chart declaration nested inside the component |
| `chartElement` | identified chart annotation such as a CAGR or reference line |

This permits conflict checks to distinguish changing a join from formatting a
chart or editing one annotation. Spreadsheet placement is addressed through the
owning `SpreadsheetAnalytic` entry.

## Related

[analytic system overview](analytic-system-overview.md) ·
[chart system overview](chart-system-overview.md) ·
[chart model](chart.md) ·
[name manager](name-manager.md) ·
[spreadsheet](../general-resources/spreadsheet.md) ·
[revision scheme](../revisions/README.md)
