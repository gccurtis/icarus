# Analytic Output — canonical model

## Saved output

```ts
interface AnalyticOutput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;

  /** Compare-and-swap target for update and delete. Starts at 1. */
  readonly revision: number;

  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}
```

The row contains the current definition. `revision` prevents a stale editor
from overwriting a newer edit; it is not a history model. An update replaces
the supplied definition wholesale rather than merging individual shelves or
filters.

## Definition

```ts
interface AnalyticDefinition {
  /** Nonempty. The first input is the root of the join sequence. */
  readonly inputs: readonly AnalyticInput[];
  readonly joins: readonly AnalyticJoin[];

  readonly rows: readonly AnalyticFieldPlacement[];
  readonly columns: readonly AnalyticFieldPlacement[];
  readonly filters: readonly AnalyticFilter[];
  readonly sorts: readonly AnalyticSort[];
  readonly limit?: number;

  readonly graph: AnalyticGraphKind;
}

interface AnalyticInput {
  /** Definition-local identity used to qualify fields. */
  readonly id: string;
  /** Stable project Formula binding ID supplied by Structured Data. */
  readonly bindingId: string;
}
```

`AnalyticInput.id` is not a second project name. It exists only inside one
definition, which permits self-joins and prevents field-name collisions.
`bindingId` is the external identity and is never replaced by a display-name
lookup.

Every input must resolve to a table, record, or list Formula wire value:

- a table keeps its fields and rows;
- a record becomes a one-row table; and
- a list becomes a one-field table named `value`.

Scalar and function bindings are not valid inputs in the first version. A
variable is valid when its resolved value is table-like.

## Field references and shelf placements

```ts
interface AnalyticFieldRef {
  readonly inputId: string;
  /** Exact, case-sensitive top-level field name. */
  readonly field: string;
}

type AnalyticAggregation =
  | "none"
  | "sum"
  | "count"
  | "average"
  | "min"
  | "max";

interface AnalyticFieldPlacement {
  /** Unique across Rows and Columns in one definition. */
  readonly id: string;
  readonly field: AnalyticFieldRef;
  readonly aggregation: AnalyticAggregation;
  readonly label?: string;
}
```

Rows and Columns are the only shelves. A placement is the equivalent of one
pill. Its ID lets a sort refer to that exact placement even when the same source
field appears more than once with different aggregations.

The first version addresses top-level fields only. A nested value may exist in
an unused source field, but a selected, filtered, sorted, aggregated, or join
field must resolve to a scalar number, text, logic, or null value. Data that
needs deeper projection should first be shaped as a named Structured Data or
Formula table.

## Joins

```ts
type AnalyticJoinKind = "inner" | "left";

interface AnalyticJoinKey {
  readonly leftField: string;
  readonly rightField: string;
}

interface AnalyticJoin {
  readonly kind: AnalyticJoinKind;
  readonly leftInputId: string;
  readonly rightInputId: string;
  /** Nonempty equality-key list. Multiple keys are ANDed. */
  readonly on: readonly AnalyticJoinKey[];
}
```

Joins are an ordered, left-deep sequence rather than a plan graph:

1. `inputs[0]` is the root.
2. `joins[i]` adds `inputs[i + 1]` as its `rightInputId`.
3. `leftInputId` must already have been introduced.
4. Every later input is added exactly once.

This supports ordinary chained joins while making cycles and disconnected
inputs impossible. Right joins are expressed by ordering the inputs
differently. Full, cross, and non-equality joins are outside the first version.

Join keys use exact scalar equality. Exact equal rationals match; text and
logic match only the same kind and value; null never matches null. A left join
with no right match supplies null for every field from that right input. Normal
many-to-many matches produce all matching row pairs while preserving left row
order and source right-row order.

## Filters

```ts
type AnalyticScalar =
  | { readonly kind: "null" }
  | {
      readonly kind: "number";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean };

type AnalyticFilter =
  | {
      readonly field: AnalyticFieldRef;
      readonly operator:
        | "equals"
        | "notEquals"
        | "greaterThan"
        | "greaterThanOrEqual"
        | "lessThan"
        | "lessThanOrEqual";
      readonly value: AnalyticScalar;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "in";
      readonly values: readonly AnalyticScalar[];
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "contains";
      readonly value: string;
      readonly caseSensitive: boolean;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "isNull" | "isNotNull";
    };
```

All filters are ANDed and run after joins but before aggregation. Comparisons do
not coerce between text, number, and logic. Ordering comparisons accept number
or text. `contains` accepts text and performs literal substring matching. An
`in` filter must contain at least one value. Null participates in equality and
`in`, but does not pass ordering or `contains` comparisons.

Numeric filter literals are parsed and reduced with Formula's rational helpers
before persistence, so equivalent fractions have one equality identity.

## Aggregation, sorting, and limit

If no placement aggregates, the executor projects one result row for each
joined and filtered input row.

If any placement aggregates, every `aggregation: "none"` placement across
Rows and Columns becomes a grouping key. Aggregate behavior is deliberately
small:

| Aggregation | Accepted values | Null behavior | Result |
| --- | --- | --- | --- |
| `count` | any scalar | ignored | exact integer number |
| `sum`, `average` | number | ignored | exact number; null when empty |
| `min`, `max` | number or text | ignored | same kind; null when empty |

Formula rational helpers perform numeric comparison and arithmetic, so an
average does not become a floating-point approximation.

```ts
interface AnalyticSort {
  /** ID of a Rows or Columns placement. */
  readonly placementId: string;
  readonly direction: "asc" | "desc";
}
```

Sorts run over the projected result, in authored order, after aggregation.
Equal values retain their prior order and null sorts last. Number, text, and
logic values sort only against the same kind. The optional positive integer
`limit` applies after all sorts.

## Graph kinds

```ts
type AnalyticGraphKind =
  | "table"
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie";
```

The graph kind is saved metadata. The backend still returns a table; the
frontend owns rendering. The first version keeps the data expectations small:

| Graph | Shelf expectation |
| --- | --- |
| `table` | at least one Rows or Columns placement |
| `bar`, `line`, `area`, `pie` | one non-aggregated Columns dimension and one aggregated numeric Rows measure |
| `scatter` | one non-aggregated numeric Columns value and one non-aggregated numeric Rows value |

Non-table graphs therefore produce one series. Color, size, tooltip, facets,
formatting, orientation, stacking, and other presentation options are not part
of this first contract.

## Transient result

```ts
type AnalyticResultKind =
  | "number"
  | "text"
  | "logic"
  | "unknown"
  | "mixed";
type AnalyticShelf = "row" | "column";

interface AnalyticResultField {
  readonly placementId: string;
  readonly name: string;
  readonly shelf: AnalyticShelf;
  readonly kind: AnalyticResultKind;
  readonly aggregation: AnalyticAggregation;
}

interface AnalyticData {
  readonly outputId: string;
  /** The saved definition revision used by this calculation. */
  readonly outputRevision: number;
  readonly graph: AnalyticGraphKind;
  /** Rows placements first, then Columns placements, preserving shelf order. */
  readonly fields: readonly AnalyticResultField[];
  readonly rows: readonly (readonly AnalyticScalar[])[];
}
```

`name` is the placement label when present, otherwise the source field name.
Duplicate names are allowed because placement ID and array position identify a
result column. `unknown` means no non-null value was available to infer a kind;
it does not by itself make an empty graph result invalid.

`AnalyticData` is returned by a run and then discarded by the capability. It
has no ID, status, lifecycle, digest, or persistence row.

## Data-reader seam

```ts
interface AnalyticDataReader {
  readAll(
    bindingIds: readonly string[]
  ): Promise<ReadonlyMap<string, FormulaWireValue>>;
}
```

The composition adapter builds one Formula resolver snapshot, indexes its
bindings by stable binding ID, and returns the requested wire-serializable
values. One snapshot per run is important; calling the resolver separately for
each input could combine different project states.

## Execution order

```text
1. validate the saved definition
2. resolve all bindings from one Formula snapshot
3. normalize table, record, and list inputs
4. apply the ordered joins
5. apply all filters
6. project Rows and Columns
7. group and aggregate when any placement aggregates
8. apply stable sorts
9. apply the optional limit
10. validate the selected graph's small shelf contract
11. return AnalyticData
```

An invalid/missing binding, field, join, aggregation, or graph shape is a normal
typed run error. It is not persisted as a separate result object.

## Invariants

1. Binding IDs, not display names, select project inputs.
2. One run resolves every input from one Formula snapshot.
3. Inputs are combined only by the saved ordered join list.
4. Field references are qualified by definition-local input ID.
5. Joins and filters run before grouping and aggregation.
6. Sorts and limit run after grouping and aggregation.
7. Exact Formula numbers remain exact in result rows.
8. Rows and Columns are the only placement authorities.
9. Running an output never changes the saved output or Structured Data.
10. A result identifies the output revision it used and is not persisted.
