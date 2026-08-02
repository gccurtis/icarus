# Analytic Output — canonical model

## The two objects

```text
AnalyticOutput            mutable, revisioned by counter, soft-deletable
  └─ AnalyticDefinition   the authored config
       ├─ input           one project Formula binding
       ├─ rows[]          field placements
       ├─ columns[]       field placements
       ├─ encodings       colour / size / label / detail / tooltip
       ├─ filters[]
       ├─ sorts[]
       ├─ limit?
       └─ view            table | metric | bar | line | area | scatter | pie

AnalyticMaterialization   immutable, never edited, referenced by digest
  ├─ input manifest       binding id, owner revision, value digest, snapshot digest
  ├─ frozen value         the exact FormulaWireValue computed against
  ├─ result schema        field name + kind per result column
  ├─ result rows          exact values
  ├─ resolvedView         explicit X / Y / category / value channel bindings
  └─ digests              definition, input, executor, result
```

## Output record

```ts
interface AnalyticOutput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;

  /** Monotone counter. Compare-and-swap target for update and delete. */
  readonly revision: number;
  readonly definitionDigest: string;

  /** Newest materialization built from the current definition, if any. */
  readonly latestMaterializationId?: string;

  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly deletedAt?: IsoTimestamp;
}
```

`revision` exists for stale-write rejection, not for history. There is no
version table and no ChangeSet log: the row holds the current definition, and
the immutable materializations hold whatever past definitions actually produced
a result. That is the history that turns out to matter — nobody asks "what did
this chart's filter list look like on Tuesday", they ask "what number did we
show on Tuesday, and from what".

`IsoTimestamp` and `ActorId` are the same named primitive aliases used by
Questions and Hypotheses.

## Input binding

```ts
interface AnalyticInput {
  /** Stable Formula binding identity. Survives a display-name rename. */
  readonly bindingId: string;
  /** Denormalised for display only. Never used for resolution. */
  readonly displayNameAtAuthoring: string;
}

/** Resolved at freeze time, in composition code over FormulaNameResolver. */
interface AnalyticInputReader {
  read(bindingId: string): Promise<AnalyticInputResolution>;
}

interface AnalyticInputResolution {
  readonly bindingId: string;
  readonly displayName: string;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
  readonly snapshotDigest: string;
  readonly value: FormulaWireValue;
}
```

Two facts about the current `FormulaResolverSnapshot` shape the reader:

1. **`bindings` is keyed by `normalizedLookupKey`** — a lowercased display name
   — not by binding id. Resolving a stored `bindingId` therefore scans the
   snapshot's bindings for a matching `reference.bindingId`. That scan is over a
   project-sized map and is fine, but it is a scan, not a lookup.
2. **Storing the binding id rather than the name is what survives a rename.**
   The name is the key; the id is the identity. A definition that stored the
   display name would silently retarget when someone renamed a declaration, and
   the recent Structured Data work went out of its way to make exactly that
   impossible for Formula references.

`isWireSerializable` rejects function values. A binding whose value is a
function is not a valid analytic input and produces a typed diagnostic at
freeze, not a crash at aggregation.

## Normalising the input to a table

`FormulaWireValue` has four shapes that matter here. Each becomes one tabular
input:

| Wire kind | Normalised to |
| --- | --- |
| `table` | its own `fields` and `rows`, unchanged |
| `record` | one row, fields as authored |
| `list` | one field named `value`, one row per element |
| `number` / `text` / `logic` / `null` | one field named `value`, one row |

Nested record and table cells are addressed by a **field path** — an ordered
list of field names — because Structured Data fields have no stable column ids.
A definition cannot claim an identity the data model does not provide, so it
addresses by path and accepts that a rename breaks the path loudly.

```ts
type FieldPath = readonly string[];
```

## Placements

```ts
type AnalyticAggregation =
  | "none" | "sum" | "count" | "countDistinct"
  | "min" | "max" | "mean" | "median";

interface FieldPlacement {
  readonly path: FieldPath;
  /** Presentation label. Never used for resolution. */
  readonly label?: string;
  readonly aggregation: AnalyticAggregation;
}

interface AnalyticEncodings {
  readonly color?: FieldPlacement;
  readonly size?: FieldPlacement;
  readonly label?: FieldPlacement;
  readonly detail?: FieldPlacement;
  readonly tooltip?: readonly FieldPlacement[];
}
```

Aggregations compute over Formula's exact rational values, not over float
projections. `mean` and `median` therefore return exact rationals too — `mean`
of `1/3` and `2/3` is exactly `1/2`, and the frontend decides how to display
that.

`countDistinct` compares canonical wire values, which for numbers means the
reduced coprime `{numerator, denominator}` pair. `0.5` and `1/2` are the same
value and count once.

## Filters

```ts
type AnalyticFilter =
  | { kind: "equals";     path: FieldPath; value: FormulaWireValue }
  | { kind: "notEquals";  path: FieldPath; value: FormulaWireValue }
  | { kind: "in";         path: FieldPath; values: readonly FormulaWireValue[] }
  | { kind: "range";      path: FieldPath;
      min?: FormulaWireValue; max?: FormulaWireValue;
      minInclusive: boolean; maxInclusive: boolean }
  | { kind: "contains";   path: FieldPath; text: string; caseSensitive: boolean }
  | { kind: "isNull";     path: FieldPath }
  | { kind: "isNotNull";  path: FieldPath };
```

Filters are a closed union of typed predicates, not an expression string. An
opaque predicate string would need a parser, a binder, and a safety story — all
of which Formula already owns, and none of which should be re-implemented here.
If a filter needs to be computed, it belongs in the Structured Data declaration
that produces the binding.

**Filters run before aggregation.** This is part of the executor contract, not
a per-view behaviour, so a filtered sum is the sum of the filtered rows in every
view.

## Sorts and limit

```ts
interface AnalyticSort {
  readonly path: FieldPath;
  readonly direction: "asc" | "desc";
  /** Sorting a placement that aggregates sorts the aggregated value. */
  readonly aggregation: AnalyticAggregation;
}
```

Sorts and the optional `limit` apply to the **result**, after grouping. A limit
of 10 on a grouped bar chart means ten bars, not ten input rows.

## Views

```ts
type AnalyticViewKind =
  | "table" | "metric" | "bar" | "line" | "area" | "scatter" | "pie";

interface AnalyticView {
  readonly kind: AnalyticViewKind;
  readonly orientation?: "vertical" | "horizontal";  // bar only
  readonly stacked?: boolean;                         // bar, area
  readonly showLegend?: boolean;
  readonly showAxisLabels?: boolean;
  readonly valueFormat?: "raw" | "integer" | "decimal" | "percent" | "currency";
}
```

Semantic options only. No colours, no fonts, no pixel dimensions, no
renderer-specific JSON. A typed palette contract can be added later without
changing the model; a `Record<string, unknown>` style bag could not be removed
later at all.

### View validation

Each view has bounded placement rules, validated at materialization against the
**resolved runtime kinds** of the placements — not against the authored
definition, because a field's kind is a property of the data:

| View | Requires |
| --- | --- |
| `table` | any placements; shelves are row and column groupings |
| `metric` | exactly one aggregated placement, no grouping placement |
| `bar`, `line`, `area` | one categorical or temporal shelf, one numeric shelf |
| `scatter` | numeric placements on both shelves |
| `pie` | one categorical placement, one numeric aggregated placement |

A definition that violates its view's rule is **saveable but not
materializable**. Blocking the save would make a chart un-editable at exactly
the moment someone is mid-way through fixing it. The materialization returns a
typed diagnostic instead.

## Materialization

```ts
interface AnalyticMaterialization {
  readonly id: string;
  readonly outputId: string;

  /** The definition this was computed from. */
  readonly definitionRevision: number;
  readonly definitionDigest: string;

  /** Exactly what was read, and what it was. */
  readonly input: AnalyticInputManifest;

  /** Which executor produced it. Part of reproducibility. */
  readonly executorVersion: number;

  readonly resultSchema: readonly AnalyticResultField[];
  readonly resultRows: readonly (readonly FormulaWireValue[])[];
  readonly resolvedView: ResolvedAnalyticView;
  readonly resultDigest: string;

  readonly diagnostics: readonly AnalyticDiagnostic[];
  readonly status: "complete" | "diagnostic";
  readonly createdAt: IsoTimestamp;
}

interface AnalyticInputManifest {
  readonly bindingId: string;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
  readonly snapshotDigest: string;
  readonly frozenValue: FormulaWireValue;   // the exact bytes computed against
  readonly frozenAt: IsoTimestamp;
}

interface AnalyticResultField {
  readonly name: string;
  readonly kind: "number" | "text" | "logic" | "null" | "mixed";
  readonly sourcePath?: FieldPath;
  readonly aggregation: AnalyticAggregation;
}

interface ResolvedAnalyticView {
  readonly kind: AnalyticViewKind;
  readonly x?: string;              // result field name
  readonly y?: string;
  readonly category?: string;
  readonly value?: string;
  readonly series?: string;
  readonly orientation?: "vertical" | "horizontal";
  readonly stacked?: boolean;
  readonly showLegend?: boolean;
  readonly showAxisLabels?: boolean;
  readonly valueFormat?: string;
}
```

`frozenValue` is the design's one deliberate piece of data duplication.
Structured Data offers no historical value read, so a manifest that recorded
only `ownerRevision` and `valueDigest` could verify that data had changed but
could never reproduce the result. Storing the exact wire value is what makes a
materialization genuinely immutable rather than merely un-edited.

`status: "diagnostic"` is a real outcome, not a failure. A materialization whose
view rule was violated, or whose field path no longer resolves, still records
what it found and why it stopped — which is what a person needs in order to fix
the definition.

## Executor order

One deterministic order, versioned as `executorVersion`, never varying by view
or frontend:

```text
1. normalise the frozen input to a table
2. resolve every referenced field path; infer runtime kinds
3. apply filters to input rows
4. project every placement used by rows, columns, or encodings
5. if any placement aggregates, group by every non-aggregated placement
   and compute aggregated placements over exact values
6. apply the ordered sort list
7. apply the optional limit
8. validate the selected view against resolved field kinds
9. emit exact result rows and the resolved view
```

Steps 3 and 6–7 are the ones people get wrong from opposite directions: filters
before aggregation, sorts and limits after. Both are fixed here so a chart never
means something different depending on which surface asked for it.

## Invariants

1. `bindingId` is the resolution authority; `displayNameAtAuthoring` is never
   used to resolve.
2. A materialization's `frozenValue` is the exact value its result was computed
   from, not a re-read.
3. Exact rational values stay exact from input through result rows.
4. Filters apply before grouping; sorts and limits apply after.
5. Aggregations are computed over exact values, never over float projections.
6. A materialization is immutable. Recomputation creates a new one.
7. `latestMaterializationId` only ever advances to a materialization whose
   `definitionRevision` equals the output's current `revision`. A completed
   result for a superseded definition is retained but can never become current.
8. Publishing a materialization does not change the definition or its
   `revision`.
9. Materialization never writes to Structured Data.
10. A definition that fails view validation is saveable and not materializable.
11. Soft-deleted outputs are absent from lists; their materializations remain
    reachable by id so an embedding resource does not break.
