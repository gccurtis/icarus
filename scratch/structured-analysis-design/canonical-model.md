# Structured Analysis — canonical model

## Saved record

```ts
interface StructuredAnalysis {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalysisDefinition;

  /** Compare-and-swap target for update and delete. Starts at 1. */
  readonly revision: number;

  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

There is no `deletedAt`. Delete archives the final snapshot into the shared
resource-history table and removes the current row, matching the model every
other revisioned capability now uses — see [store.md](store.md).

`revision` prevents a stale editor from overwriting a newer edit. It is also the
history key: each accepted update archives the *previous* revision before
writing the new one.

An update replaces title, description, and definition wholesale. There is no
patch language for individual shelves or filters.

## Definition

```ts
interface AnalysisDefinition {
  /** Nonempty. The first input is the root of the join sequence. */
  readonly inputs: readonly AnalysisInput[];
  readonly joins: readonly AnalysisJoin[];

  readonly rows: readonly AnalysisFieldPlacement[];
  readonly columns: readonly AnalysisFieldPlacement[];
  readonly filters: readonly AnalysisFilter[];
  readonly sorts: readonly AnalysisSort[];
  readonly limit?: number;

  readonly graph: AnalysisGraph;
}

interface AnalysisInput {
  /** Definition-local alias used to qualify field references. */
  readonly alias: string;
  /** Structured Data display name, stored as authored. */
  readonly name: string;
}
```

`alias` is not a second project name. It exists only inside one definition,
which permits self-joins and prevents field-name collisions between inputs.

`name` is the external identity. It is stored as the author typed it and matched
case-insensitively, exactly as Structured Data and the Formula resolver match
names (`normalizeKey` is lowercase, and Structured Data holds a
`UNIQUE INDEX … (display_name COLLATE NOCASE) WHERE deleted_at IS NULL`). Two
inputs in one definition may not resolve to the same normalized name unless
they are a deliberate self-join, which is expressed by two aliases over the same
name.

Every input must resolve to a table, record, or list Formula wire value:

- a **table** keeps its fields and rows;
- a **record** becomes a one-row table; and
- a **list** is already a one-field table whose field is named `value`
  (`makeList` builds exactly that), so no conversion is needed.

Scalar and function bindings are not valid inputs. A variable is valid when its
resolved value is table-like.

## Field references and shelf placements

```ts
interface AnalysisFieldRef {
  readonly alias: string;
  /** Exact, case-sensitive top-level field name. */
  readonly field: string;
}

type AnalysisAggregation =
  | "none"
  | "sum"
  | "count"
  | "average"
  | "min"
  | "max";

interface AnalysisFieldPlacement {
  /** Unique across Rows and Columns in one definition. */
  readonly id: string;
  readonly field: AnalysisFieldRef;
  readonly aggregation: AnalysisAggregation;
  readonly label?: string;
}
```

Rows and Columns are the only shelves. One placement is one pill. Its ID lets a
sort target that exact placement even when the same source field appears twice
with different aggregations.

Field names are matched **case-sensitively** — they come from inside a table
value, not from the project name space, and Formula does not normalize them.

The first version addresses top-level fields only. A nested value may sit in an
unused source field, but any field that is selected, filtered, sorted,
aggregated, or joined on must resolve to a scalar number, text, logic, or null.
Data needing deeper projection should be shaped first as a named Structured Data
or Formula table.

## Graph

```ts
type AnalysisGraphKind =
  | "table"
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie";

interface AnalysisGraph {
  readonly kind: AnalysisGraphKind;
}
```

The graph is saved authoring intent and travels back out with every run. The
backend still returns tabular data; the frontend owns rendering.

**It is an object rather than a bare enum on purpose.** The renderings this will
plausibly grow into — two panels side by side, a bar series with a line overlaid,
a secondary axis — are all *additive* to this shape: a new optional field, or a
new `kind` variant carrying its own layer list. A bare string would force a
migration of every persisted definition on the first such change.

Each kind states a small **structural** shelf contract, checked when the
definition is saved because it depends only on the definition:

| Graph | Structural shelf contract |
| --- | --- |
| `table` | at least one Rows or Columns placement |
| `bar`, `line`, `area`, `pie` | exactly one non-aggregated Columns placement and exactly one aggregated Rows placement |
| `scatter` | exactly one non-aggregated Columns placement and exactly one non-aggregated Rows placement |

The part that cannot be known until data exists — whether a measure actually
resolved to numbers — is checked during the run and reported as a data error.
Non-table graphs therefore produce one series in this version. Color, size,
tooltip, facets, formatting, orientation, and stacking are not part of this
contract.

## Joins

```ts
type AnalysisJoinKind = "inner" | "left";

interface AnalysisJoinKey {
  readonly leftField: string;
  readonly rightField: string;
}

interface AnalysisJoin {
  readonly kind: AnalysisJoinKind;
  readonly leftAlias: string;
  readonly rightAlias: string;
  /** Nonempty equality-key list. Multiple keys are ANDed. */
  readonly on: readonly AnalysisJoinKey[];
}
```

Joins are an ordered, left-deep sequence rather than a plan graph:

1. `inputs[0]` is the root.
2. `joins[i]` adds `inputs[i + 1]` as its `rightAlias`.
3. `leftAlias` must already have been introduced.
4. Every later input is added exactly once.

This supports ordinary chained joins while making cycles and disconnected inputs
structurally impossible — the shape is validated, not planned around. Right
joins are expressed by ordering the inputs differently. Full, cross, and
non-equality joins are outside this version.

Join keys use exact scalar equality: equal rationals match, text and logic match
only the same kind and value, and **null never matches null**. A left join with
no right match supplies null for every field of that right input. Many-to-many
matches produce all matching row pairs, preserving left row order and then
source right-row order.

## Filters

```ts
type AnalysisScalar =
  | { readonly kind: "null" }
  | {
      readonly kind: "number";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean };

type AnalysisFilter =
  | {
      readonly field: AnalysisFieldRef;
      readonly operator:
        | "equals"
        | "notEquals"
        | "greaterThan"
        | "greaterThanOrEqual"
        | "lessThan"
        | "lessThanOrEqual";
      readonly value: AnalysisScalar;
    }
  | {
      readonly field: AnalysisFieldRef;
      readonly operator: "in";
      readonly values: readonly AnalysisScalar[];
    }
  | {
      readonly field: AnalysisFieldRef;
      readonly operator: "contains";
      readonly value: string;
      readonly caseSensitive: boolean;
    }
  | {
      readonly field: AnalysisFieldRef;
      readonly operator: "isNull" | "isNotNull";
    };
```

`AnalysisScalar` is deliberately the scalar arm of `FormulaWireValue` verbatim,
including numbers as a numerator/denominator string pair, so filter literals and
result cells share one representation and no conversion layer exists.

All filters are ANDed and run after joins but before aggregation. Comparisons do
not coerce between text, number, and logic. Ordering comparisons accept number
or text. `contains` accepts text and performs literal substring matching. An
`in` filter must carry at least one value. Null participates in equality and
`in`, but fails ordering and `contains`.

Numeric filter literals are reduced through Formula's rational helpers before
persistence, so `2/4` and `1/2` have one equality identity.

## Aggregation, sorting, and limit

If no placement aggregates, the executor projects one result row per joined and
filtered input row.

If any placement aggregates, every `aggregation: "none"` placement across Rows
and Columns becomes a grouping key. Aggregate behaviour is deliberately small:

| Aggregation | Accepted values | Null behaviour | Result |
| --- | --- | --- | --- |
| `count` | any scalar | ignored | exact integer |
| `sum`, `average` | number | ignored | exact number; null when empty |
| `min`, `max` | number or text | ignored | same kind; null when empty |

Formula rational helpers perform the arithmetic and comparison, so an average is
an exact rational rather than a floating-point approximation.

```ts
interface AnalysisSort {
  /** ID of a Rows or Columns placement. */
  readonly placementId: string;
  readonly direction: "asc" | "desc";
}
```

Sorts run over the projected result, in authored order, after aggregation. They
are stable: equal values keep their prior order. Null sorts last. Number, text,
and logic sort only against the same kind. The optional positive integer `limit`
applies after all sorts.

## Transient result

```ts
type AnalysisResultKind =
  | "number"
  | "text"
  | "logic"
  | "unknown"
  | "mixed";

type AnalysisShelf = "row" | "column";

interface AnalysisResultField {
  readonly placementId: string;
  readonly name: string;
  readonly shelf: AnalysisShelf;
  readonly kind: AnalysisResultKind;
  readonly aggregation: AnalysisAggregation;
}

interface AnalysisData {
  readonly analysisId: string;
  /** The saved definition revision this calculation used. */
  readonly analysisRevision: number;
  readonly graph: AnalysisGraph;
  /** Rows placements first, then Columns placements, preserving shelf order. */
  readonly fields: readonly AnalysisResultField[];
  readonly rows: readonly (readonly AnalysisScalar[])[];
}
```

`name` is the placement label when present, otherwise the source field name.
Duplicate names are allowed because placement ID and array position identify a
result column. `unknown` means no non-null value was available to infer a kind;
it does not by itself make an empty result invalid.

`AnalysisData` is returned by a run and then discarded. It has no ID, status,
lifecycle, digest, or persistence row.

## Data-reader seam

```ts
type AnalysisInputResolution =
  | { readonly kind: "value"; readonly value: FormulaWireValue }
  | { readonly kind: "unresolved"; readonly code: string; readonly detail?: string }
  | { readonly kind: "missing" };

interface StructuredDataReader {
  /** Keys are normalized (lowercased) names. One project snapshot per call. */
  readAll(
    names: readonly string[]
  ): Promise<ReadonlyMap<string, AnalysisInputResolution>>;
}
```

The composition adapter builds one Formula resolver snapshot and reads it by
normalized name. Because the snapshot's `bindings` map is *already* keyed that
way, no scan or secondary index is needed.

Three outcomes are distinguished on purpose, because they mean different things
to an author: the name resolved to a value; the name exists but its entry failed
to resolve (a broken formula somewhere upstream); or the name is not in the
project at all (likely renamed or deleted).

The port carries the capability's own diagnostic vocabulary rather than
Formula's `FormulaResolutionIssue`, because that type is defined in `1-init` and
a capability cannot import upward.

## Execution order

```text
1. load the saved analysis (revision captured here)
2. resolve every input name from ONE Formula snapshot
3. normalize table, record, and list inputs into aliased tables
4. apply the ordered joins
5. apply all filters
6. project the Rows and Columns placements
7. group and aggregate when any placement aggregates
8. apply the stable sorts
9. apply the optional limit
10. check the graph's data-dependent expectations
11. return AnalysisData tagged with the captured revision and the saved graph
```

A missing name, unresolved entry, non-tabular input, missing field, incompatible
join/filter/aggregate, or exceeded limit is a normal typed run error. Nothing is
persisted as a diagnostic record.

## Invariants

1. Display names, matched case-insensitively, select project inputs.
2. One run resolves every input from one Formula snapshot.
3. Inputs are combined only by the saved ordered join list.
4. Field references are qualified by the definition-local alias.
5. Joins and filters run before grouping and aggregation.
6. Sorts and limit run after grouping and aggregation.
7. Exact Formula numbers stay exact in result rows.
8. Rows and Columns are the only placement authorities.
9. The graph is saved authoring intent and is returned with every run.
10. Running an analysis never changes the analysis or Structured Data.
11. A result names the analysis revision it used and is never persisted.
