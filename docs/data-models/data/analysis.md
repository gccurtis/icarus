# Analysis

A saved chart or table definition — inputs, joins, shelves, filters, sorts, and
how to display the result. The Tableau-shaped surface: drag fields onto rows and
columns, pick a chart type, save it.

```ts
interface Analysis {
  projectId: Id<"projects">;
  title: string;
  description?: string;
  definition: AnalysisDefinition;
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
}

interface AnalysisDefinition {
  inputs: AnalysisInput[];         // nonempty; the first is the join root
  joins: AnalysisJoin[];
  rows: FieldPlacement[];
  columns: FieldPlacement[];
  filters: AnalysisFilter[];
  sorts: AnalysisSort[];
  limit?: number;
  display: AnalysisDisplay;
}

interface AnalysisInput {
  name: string;                    // a name-manager variable
  as?: string;                     // a second label, for self-joins
}

interface FieldRef {
  input: string;                   // an input key: `as ?? name`
  field: string;                   // case-sensitive field in that table
}

interface FieldPlacement {
  id: string;                      // unique across rows and columns
  field: FieldRef;
  aggregation: "none" | "sum" | "count" | "average" | "min" | "max";
  label?: string;
}

interface AnalysisJoin {
  left: FieldRef;
  right: FieldRef;
  kind: "inner" | "left" | "right" | "outer";
}

interface AnalysisFilter {
  field: FieldRef;
  op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in" | "contains" | "between" | "isEmpty";
  value?: unknown;
}

interface AnalysisSort {
  placementId: string;             // targets a placement, not a field
  direction: "asc" | "desc";
}

interface AnalysisDisplay {
  kind:
    | "table"
    | "bar"
    | "line"
    | "area"
    | "scatter"
    | "bubble"
    | "pie"
    | "waterfall"
    | "mekko"
    | "funnel"
    | "radar"
    | "heatmap"
    | "treemap";
  settings?: DisplaySettings;
}

interface DisplaySettings {
  title?: string;
  stacked?: boolean;
  legend?: "none" | "start" | "end" | "top" | "bottom";
  xLabel?: string;
  yLabel?: string;
  yStartsAtZero?: boolean;
  colors?: string[];
}
```

## Inputs are names, not ids

An input names a [name-manager](name-manager.md) variable. Since every variable
normalizes to a table, any of them can be an input — a table, a record, a list,
even a scalar.

The name is the selector rather than an id because the author thinks in names,
and because a definition should read the way they wrote it:
`{ input: "Orders", field: "region" }`.

An input's **key** is `as ?? name`, and everything referring to an input uses
that key. Qualifying by key is what keeps `Orders.region` and `Regions.region`
distinct without extra machinery, and `as` is what lets one variable appear twice
in a self-join.

## Sorts target placements, not fields

`AnalysisSort.placementId` points at a `FieldPlacement`, not a `FieldRef`.

The same source field can sit on the shelves twice with different aggregations —
`sum(amount)` and `average(amount)` — and a sort naming the field would be
ambiguous between them. Naming the placement is exact.

## It compiles to one formula

A definition is convertible to a single inline
[formula](../content/content-block.md#formula-blocks) expression. Inputs become
table references, joins become `JOIN`, filters `WHERE`, shelves `GROUP` and
`AGGREGATE`, sorts `SORT`, and the limit `LIMIT`.

This is the reason the definition is shaped the way it is, and it is worth
protecting. It means:

- an analysis can be dropped into a spreadsheet cell as a formula and spill
- the analysis builder is a *editor over an expression*, not a parallel query
  engine with its own semantics
- there is exactly one evaluator, so a chart and a formula returning the same
  table cannot disagree

The definition is stored rather than the compiled expression because the
expression cannot be edited back into shelves. Compilation is one-directional,
so the structured form is the one that has to be authoritative.

## Display is an object, not a bare kind

`display` is a record with a `kind` rather than a bare enum string, because every
plausible growth — a bar series with a line overlaid, a secondary axis, two
panels side by side — is *additive* to a record and a migration for a string.

`table` is a first-class kind and not a fallback for "no chart". A joined,
filtered, aggregated table is exactly what this capability exists to produce.

## Results are shaped for the display

Evaluating an analysis does not have to return the whole table. What it returns
depends on `display.kind`:

- `table` returns rows and columns, since that is the output
- `bar`, `line`, `area`, `waterfall`, `mekko`, and `radar` return
  identified categories, series, and values
- `pie`, `funnel`, and `treemap` return one identified non-negative series
- `scatter` returns x/y points; `bubble` adds size
- `heatmap` returns the category–series matrix whose value becomes intensity

For a bar chart the client needs categories and magnitudes, not the ten thousand
underlying rows that were aggregated into them. Aggregation happens where the
data is, and the wire carries the answer rather than the input.

This is why `display` sits inside the definition rather than being a rendering
option applied afterward. It is not decoration — it determines what work the
evaluator does and what comes back.

Results are not stored. An analysis is a definition; its output is computed on
demand from the current values of its inputs, which is what makes a saved chart
stay current without a refresh mechanism.

## Where an analysis appears

A [spreadsheet chart](../general-resources/spreadsheet.md#spills-occupy-cells-charts-do-not)
holds its own inline range and kind for the simple case. An `Analysis` is the
saved, reusable, joinable version — referenced from a chart, embedded in a
document, or evaluated on its own page.

## Related

[name manager](name-manager.md) ·
[content block](../content/content-block.md#formula-blocks) ·
[spreadsheet](../general-resources/spreadsheet.md)
