# Analytic system overview

This is the review guide for the Icarus analytic system. It starts from the way
the product should be explained to a person, then maps that explanation to the
persisted model and reusable component boundaries.

Read this before the field-level [analysis model](analysis.md) and the visual
subcomponent [chart model](chart.md).

## Present it this way

Imagine presenting one analytic to a client:

1. **Name the answer.** The top of the page says what the analytic is about.
2. **Show the answer.** The center is the actual table or chart, fully
   interactive rather than flattened into an image.
3. **Explain how it was made.** The section beneath it shows the meaningful
   channels for that output—X, Y, Data, Labels, and Size where applicable.
4. **Trace every value.** Each channel can be followed back through a visible,
   ordered sequence of list selections, extends, joins, filters, groups, sorts,
   limits, aggregations, and formulas.

The important product promise is that the answer shown in step two is the same
component used in a slide, a document block, or above a spreadsheet. It is not
copied into four formats and it is not translated through a second chart
schema.

## The shortest useful mental model

An analytic is an ordered table program that materializes one reusable output.

```text
project variables
      |
      v
normalize every value to a table
      |
      v
select lists for X / Y / Labels / Size
      |
      v
extend or join lists within each dimension, top to bottom
      |
      v
bridge independently built dimensions into one explicit data relation
      |
      v
ordered operations: filter / group / aggregate / sort / limit / formula
      |
      v
AnalyticComponentModel
      |
      +---- analysis page
      +---- document block
      +---- slide element
      +---- spreadsheet overlay
```

There is no hidden root table and no assumption that all fields came from one
dataframe. The persisted definition says exactly which relation feeds the data
pipeline.

## Names and boundaries

Four similar names refer to four distinct things:

| Name | Meaning |
| --- | --- |
| **Analysis page** | The full-screen authoring experience: title, central output, and bottom customization section. |
| **AnalyticModel** | The saved object: editable data definition, reusable output, and materialization state. |
| **AnalyticComponent** | The surface-neutral Svelte component that renders an `AnalyticModel` as a chart or table. |
| **ChartModel** | The visual declaration nested inside a chart analytic component. It does not own joins, grouping, or placement. |

The `AnalyticComponent` is not the analysis page. It is the center object the
page presents. The page owns authoring controls; a slide or spreadsheet owns
placement; the component owns output interaction.

## Page anatomy

The analysis page is a vertical stack:

```text
┌────────────────────────────────────────────────────────────┐
│ Analytic title                                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                 AnalyticComponent                          │
│              interactive table or chart                    │
│                                                            │
├──────────┬─────────────────────────────────────────────────┤
│ X        │                                                 │
│ Y        │     active channel's compact customization      │
│ Data     │     grid: inputs, selection, composition,        │
│ Labels   │     status, and simple operations                │
│ Size     │                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

The left buttons are a type-specific set, not five permanently visible
placeholders. A pie exposes Data and Labels; it does not show meaningless X and
Y buttons. The inspector can expose a more complete editor for the active item,
but this system does not require a separate persisted shape for compact and
detailed editing.

## One component, many surfaces

The surface hierarchy is deliberately asymmetric:

```text
Analysis page                     Document / Slide / Spreadsheet
┌───────────────────────┐         ┌─────────────────────────────┐
│ title                 │         │ surface placement wrapper   │
│ ┌───────────────────┐ │         │ ┌─────────────────────────┐ │
│ │ AnalyticComponent │ │         │ │ AnalyticComponent       │ │
│ └───────────────────┘ │         │ └─────────────────────────┘ │
│ customization         │         │ drag / resize / anchor      │
└───────────────────────┘         └─────────────────────────────┘
```

The component receives the same `AnalyticModel` and uses the same semantic
selection targets on every surface. A selected bar is the same datum in an
analysis page and on a slide. The host can route that target into the same
inspector sections.

Placement never enters `AnalyticModel`:

- a document block owns its block placement;
- a slide element owns its frame and rotation;
- a spreadsheet owns anchor, offset, size, and z-index;
- the analysis page simply gives the component the center space.

This makes an analytic embeddable without making it draggable by itself.

## The table algebra

### 1. Normalize every value to a table

Project variables can resolve to any `FormulaValue`, but the analytic evaluator
uses one algebra. Before authoring operations run, resolved values normalize as
follows:

| Input value | Normalized table |
| --- | --- |
| table | its columns and body rows |
| record | one row; field names become columns |
| list | one column named `value`; one row per item |
| scalar, empty, date, logic, text, number | one row and one column named `value` |
| range | resolve the range, then normalize the returned value |
| function | apply it explicitly, then normalize its result |

This is not serialization into arbitrary JSON. It is a consistent relational
view over the existing formula value system.

### 2. A dimension needs a list

X, Y, Labels, and Size are all aligned lists. Dropping a list or scalar is
already sufficient after normalization. Dropping a multi-field object requires
one explicit conversion:

- choose any body **column**;
- choose any **data row**; or
- choose **Function**, then author a lambda that returns a list from the table.

Headers describe columns and are not included in column values. A compact
control uses the warning:

> Needs a list, not a table

The detailed editor explains the three recovery paths without discarding the
dropped input. The choice is persisted as an `AnalyticListSelector`, so a
column, row, and function can never be confused by display text.

### 3. Compose inputs inside one dimension

The first selected list starts the dimension. Every later input has exactly one
step, displayed and executed top to bottom:

- **Extend** stacks the new list below the accumulated values.
- **Join** matches a key from the accumulated relation to a key from the new
  input, then chooses left, right, or coalesced values as the displayed list.

An outer join is the default null-preserving join. Inner, left, and right joins
remain explicit options. The model does not ban unusual but well-defined joins,
including keys derived from the same source; validation checks references and
order rather than imposing a Tableau workflow.

An extend answers “show these values after those values.” A join answers “make
these records correspond.” They are not interchangeable commands.

### 4. Bridge dimensions before computing data

X and Y can each be built from independent table sets. Selecting both lists
does not establish how their records correspond. The Data channel therefore
starts from one explicit relation reference:

```ts
type AnalyticRelationReference =
  | { kind: "input"; inputId: string }
  | { kind: "dimension"; dimensionId: string }
  | { kind: "bridge"; bridgeId: string };
```

A bridge joins two relations. Its left or right side may be an input, a
dimension, or an earlier bridge. This supports more than two independently
built sets without inventing one privileged root table.

The final `data.from` reference must contain every supplied dimension and every
raw list used by data operations. If it does not, the analytic remains editable
but receives a stable `missing-bridge` issue.

### 5. Execute data operations in authored order

The data pipeline is an array because order changes meaning:

```text
filter -> sort -> limit -> average
```

does not necessarily equal:

```text
average -> sort -> limit -> filter
```

Current operation declarations are:

- filter with a formula predicate;
- group by one or more selected lists;
- aggregate as sum, count, average, minimum, maximum, first, or last;
- sort ascending or descending by a list, formula, or earlier operation;
- limit to a positive row count;
- apply a custom formula over the current relation.

An operation may reference only an operation above it. The readable compiler
therefore chains every line through the previous result instead of collecting
filters, sorts, and aggregations into unordered shelves.

## Walkthrough A: extend, then bridge

Goal: show revenue by a combined territory list.

1. Drop `CurrentTerritories` into X and choose its `territory` column.
2. Drop `PlannedTerritories` beneath it and choose the same column.
3. Choose **Extend**. X now displays one stacked list.
4. Drop `Orders` into Y and choose `orderType`.
5. Data reports that X and Y are disconnected.
6. Add an outer bridge from the extended territory relation to `Orders`, using
   territory ID on both sides.
7. Group by territory and order type.
8. Sum `Orders.revenue`.

Formula-shaped plan:

```text
$x = EXTEND_DIMENSION(
  DIMENSION($CurrentTerritories, $CurrentTerritories["territory"]),
  $PlannedTerritories,
  $PlannedTerritories["territory"]
)
$y = $Orders["orderType"]
$xy = OUTER_JOIN($x, $y, territoryId = territoryId)
$groups = GROUP($xy, territory, orderType)
$revenue = AGGREGATE($groups, SUM($Orders["revenue"]) AS "Revenue")
```

Extending X first means only the combined X relation needs to be bridged to Y.

## Walkthrough B: compose both axes, then bridge

Goal: compare two independently assembled dimensions.

1. X joins Tables 1 and 2 by customer ID and chooses a coalesced customer list.
2. Y joins Tables 3 and 4 by product ID and chooses a coalesced product list.
3. Both axes render valid lists, but there is still no customer–product
   relationship.
4. Data bridges the X relation to the Y relation using the transaction key
   available on each side.
5. The pipeline filters active rows, groups by customer and product, sorts by
   value, limits to the top three in each group through a formula if necessary,
   and aggregates the requested measure.

The bridge is not a UI workaround. It is the missing relational statement that
makes an X/Y value pair meaningful.

## Output-specific customization

The bottom section reads one exhaustive contract:

| Output | Required channels | Optional channels |
| --- | --- | --- |
| table | Data | — |
| bar, line, area, waterfall, radar | X, Data | Y, Labels |
| pie/doughnut, funnel, treemap | Data, Labels | — |
| scatter | X, Y, Data | Labels |
| bubble | X, Y, Data, Size | Labels |
| Mekko, heatmap | X, Y, Data | Labels |

This controls which channel buttons exist. The nested chart union separately
controls which visual elements can be added or selected:

- bars permit bars/segments, axes, reference lines, CAGR lines, and text;
- pie permits slices and text, but no axes or CAGR line;
- point charts permit points/bubbles, axes, trend lines, and text;
- every other family has its own explicit capability boundary.

Labels are their own data channel. Choosing custom labels materializes a
`ChartDatum.label`; choosing value, percent, category, or total remains a visual
formatting choice where the chart type supports it.

## Authoring state and materialized state

An analytic deliberately carries both:

```text
editable AnalyticDataDefinition
              +
last materialized AnalyticComponentModel
              +
materialization state and issue IDs
```

The definition is authoritative for the next evaluation. The component is the
last complete output and allows all surfaces to render without synchronously
replaying joins. This is controlled materialization, not a second authoring
model.

When an edit is temporarily incomplete or evaluation fails:

- preserve the authored definition;
- preserve the last good component;
- mark materialization `stale` or `error`;
- carry stable issue IDs;
- show a concise “last materialized result” status rather than an empty chart.

Successful evaluation atomically replaces the component and returns the state
to `ready`.

## Identity and interaction

Every selectable fact has stable model identity:

- analytic, component, chart, categories, series, datums, axes, and added chart
  elements;
- table, columns, rows, and cells.

Selection targets these IDs rather than SVG paths, DOM nodes, row positions, or
pixel coordinates. Sorting can move a row without changing what the inspector
is showing. Resizing can regenerate every chart path without losing the
selected bar.

The revision vocabulary mirrors the nesting:

- `analytic` for the ordered computation;
- `analyticComponent` for the reusable output;
- `chart` for the nested visual declaration;
- `chartElement` for an identified annotation such as a CAGR or reference line.

Surface placement remains a revision of the owning block/slide element or the
spreadsheet's analytic reference, not of the chart facts.

## System principles

### One algebra, not one hidden table

Normalize values to tables, but persist every composition and bridge. “All data
is tabular” must never become “all data came from one root table.”

### One output component, not four integrations

Analysis, document, slide, and spreadsheet render the same component and share
selection semantics. Hosts add placement; they do not translate the analytic.

### Persist intent; materialize the last complete answer

Joins and operations are authored intent. Chart paths are disposable geometry.
The last good chart/table is a replaceable materialization that keeps embeds
fast and resilient.

### Order is data

Arrays of inputs, composition steps, bridges, and operations are execution
order. Reordering is a semantic edit, not cosmetic organization.

### Type controls the available product

Pie does not receive disabled axis controls. The output discriminant owns both
renderer choice and customization availability.

### Lists are explicit projections

A table cannot silently become “its first column.” The user chooses a column,
row, or function, and that choice survives relabeling and inspection.

### Relations are explicit references

`data.from` names the relation the pipeline consumes. Evaluation never infers a
root from array position or whichever bridge was added last.

### Invalid work remains inspectable

Incomplete joins and unresolved variables stay in the definition with stable
issues. The system explains what is missing without erasing the work that led
there.

### Semantic identity outlives geometry

All interactions address model IDs. DOM identity is an implementation detail.

### Surface placement is not analytic meaning

Moving an analytic on a slide does not modify its joins, chart declaration, or
materialized facts.

## Current implementation boundary

This change establishes:

- persisted TypeScript contracts for analytic definitions, relation roots,
  bridges, ordered operations, chart/table components, materialization, and
  spreadsheet references;
- normalization and list-requirement helpers;
- validation with stable issue IDs;
- a readable formula-shaped execution plan;
- one reusable chart/table `AnalyticComponent`;
- chart-specific customization contracts;
- hand-built, semantic chart renderers for twelve chart types;
- stable chart and table selection targets;
- a surface-owned draggable wrapper used by the spreadsheet workspace.

The production formula evaluator still needs adapters that resolve project
variables and ranges, execute the plan, and atomically write a new
materialization. The model does not embed a second query engine to get ahead of
that evaluator.

## Review order

1. This document: confirm the presentation and mental models.
2. [Analysis model](analysis.md): confirm persisted fields and order semantics.
3. [Chart system overview](chart-system-overview.md): confirm the nested visual
   system and interaction boundaries.
4. `app/src/lib/json-store/types/data/analytic.ts`: confirm the shipping type
   contract.
5. `app/src/lib/unique-components/analytic/analytic-model.ts`: confirm
   validation, normalization, and planning.
6. `analytic-component.svelte` and `analytic-table-renderer.svelte`: confirm the
   reusable output boundary.
7. Chart layouts and plot components: confirm native selectable marks.
8. Analytic and chart unit tests: exercise relation, identity, order, and type
   boundaries.

## File map

- Persisted analytic types:
  `app/src/lib/json-store/types/data/analytic.ts`
- Validation, normalization, and plan compiler:
  `app/src/lib/unique-components/analytic/analytic-model.ts`
- Reusable output:
  `app/src/lib/unique-components/analytic/analytic-component.svelte`
- Interactive table output:
  `app/src/lib/unique-components/analytic/analytic-table-renderer.svelte`
- Optional placement wrapper:
  `app/src/lib/unique-components/analytic/analytic-element.svelte`
- Nested chart types:
  `app/src/lib/json-store/types/data/chart.ts`
- Chart construction and validation:
  `app/src/lib/unique-components/chart/chart-model.ts`
- Chart renderer:
  `app/src/lib/unique-components/chart/chart-renderer.svelte`
