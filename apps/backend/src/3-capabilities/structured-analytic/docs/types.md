# Structured Analytic types

All in [`domain/model.ts`](../domain/model.ts) unless noted. Nothing here has
behaviour.

## The saved record

```ts
interface StructuredAnalytic {
  id: string;
  title: string;
  description?: string;
  definition: AnalyticDefinition;
  revision: number;          // CAS target. Starts at 1.
  createdBy: string;
  updatedBy: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}
```

**No `deletedAt`.** Delete archives the final snapshot into the shared
resource-history table and removes the current row, so every row in the current
table is live by construction rather than by a predicate.

## The definition

```ts
interface AnalyticDefinition {
  inputs: readonly AnalyticInput[];   // nonempty; inputs[0] roots the join chain
  joins: readonly AnalyticJoin[];     // exactly inputs.length - 1
  rows: readonly AnalyticFieldPlacement[];
  columns: readonly AnalyticFieldPlacement[];
  filters: readonly AnalyticFilter[];
  sorts: readonly AnalyticSort[];
  limit?: number;
  display: AnalyticDisplay;
}

interface AnalyticInput {
  name: string;      // Structured Data display name. The selector.
  as?: string;       // A second label. Needed only for a self-join.
  entryId?: string;  // Server-captured repair hint. Never the selector.
}

const inputKey = (input: AnalyticInput) => input.as ?? input.name;
```

`joins[i]` introduces `inputs[i+1]`, and its `left` must already be introduced.
That shape is what makes cycles and disconnected inputs **unrepresentable**
rather than something a planner has to detect.

```ts
interface AnalyticFieldPlacement {
  id: string;                 // unique across both shelves
  field: AnalyticFieldRef;    // { input: <inputKey>, field: <column> }
  aggregation: "none" | "sum" | "count" | "average" | "min" | "max";
  label?: string;
}

const placementName = (p: AnalyticFieldPlacement) => p.label ?? p.field.field;
```

`AnalyticScalar` is deliberately the scalar arm of `FormulaWireValue` verbatim —
`null`, an exact `{numerator, denominator}` pair, `text`, or `logic` — so filter
literals and result cells share one representation with no conversion layer.

Filters cover ten operators: the six comparisons, plus `in`, `contains`,
`isNull`, and `isNotNull`. Those are exactly `WHERE`'s operators, and a test
asserts the two lists are equal so a rename on either side fails a test rather
than producing analytics that save cleanly and fail at pull time forever.

## Commands and queries

```ts
type AnalyticCommand =
  | { type: "analytic.create"; input: CreateAnalyticInput }
  | { type: "analytic.update"; input: UpdateAnalyticInput }   // full replacement
  | { type: "analytic.delete"; input: DeleteAnalyticInput }
  | { type: "analytic.purge";  input: PurgeAnalyticInput }
  | { type: "analytic.save";   input: SaveAnalyticInput }
  | { type: "analytic.copy";   input: CopyAnalyticInput };

type AnalyticQuery =
  | { type: "analytic.get";   id: string }
  | { type: "analytic.list" }
  | { type: "analytic.pull";  id: string }
  | { type: "analytic.check"; id: string };
```

`update` is a complete replacement, not a patch — a definition is small and a
patch language for pills would be a second grammar to keep correct.

## What a pull returns

```ts
interface AnalyticPull {
  analyticId: string;
  analyticRevision: number;
  definition: AnalyticDefinition;   // the pills, because compilation is one-way
  display: AnalyticDisplay;
  fields: readonly AnalyticResultField[];
  rows: readonly (readonly AnalyticScalar[])[];
  sources: readonly AnalyticSourceRead[];   // the receipt
  pulledAt: IsoTimestamp;
}

interface AnalyticResultField {
  placementId: string;
  name: string;
  shelf: "row" | "column";
  kind: "number" | "text" | "logic" | "unknown" | "mixed";
  aggregation: AnalyticAggregation;
}
```

`fields` is **Rows placements first, then Columns**, preserving shelf order.
That is deliberately *not* the compiled column order — `GROUP` emits its keys
before its aggregates, so dimensions arrive first regardless of shelf. The
service permutes cells into this order rather than passing the compiled table
through.

A field's `kind` comes from the values actually present: `mixed` when a column
disagrees with itself, `unknown` when it is entirely null. A client drawing an
axis needs to know which of those two it has.

```ts
interface AnalyticSourceRead {
  input: string;     // the input key, so a self-join reports both sides
  name: string;      // the name that answered, current as of this pull
  entryId: string;
  revision: number;
  status: "ok" | "renamed" | "retargeted";
}
```

## Errors

In [`domain/errors.ts`](../domain/errors.ts). One class per distinguishable
failure; none of them mentions HTTP.

| Class | Means | Maps to |
| --- | --- | --- |
| `AnalyticWireError` | Malformed request | 400 `validation_error` |
| `AnalyticValidationError` | Structurally incoherent definition; carries `field` | 400 `validation_error` |
| `AnalyticCompilationError` | Valid but cannot be lowered | 400 `validation_error` |
| `AnalyticNotFoundError` | Absent or deleted | 404 `not_found` |
| `StaleAnalyticRevisionError` | CAS miss | 409 `revision_conflict` |
| `AnalyticNameConflictError` | `save`/`copy` target name taken | 409 `name_conflict` |
| `AnalyticPullError` | Data cannot satisfy a valid definition | 422 `analytic_pull_invalid` |
| `AnalyticConfigurationError` | Bad configured limits | **unmapped** — 500 |

Purge raises the **shared** `ResourceNotDeletedError` and
`ResourceHistoryNotFoundError`, not private twins, so it inherits the mapping
every other capability already has.

`AnalyticConfigurationError` is unmapped on purpose: reaching job wiring would
mean the process should not have booted, so dressing it as a client error would
blame the caller for a bad `configuration.yaml`.
