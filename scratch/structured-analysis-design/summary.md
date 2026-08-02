# Analytic Output — design summary

## Purpose

Analytic Output stores the instructions for producing the data behind one table
or graph. It is the backend equivalent of arranging a small set of Tableau
pills: choose named project data, join it, place fields on Rows and Columns,
filter it, aggregate it, sort it, and choose a graph kind.

```text
Structured Data bindings
  → ordered equality joins
  → filters
  → Rows and Columns
  → grouping and aggregation
  → sorts and optional limit
  → transient tabular data + selected graph kind
```

The capability does not render a graph. It returns structured data that the
frontend can render.

## The two runtime values

Only one value is persisted:

- `AnalyticOutput` is a mutable saved definition with a revision counter.

Running that definition returns one transient value:

- `AnalyticData` contains result fields and rows for the output revision that
  was read.

`AnalyticData` is not stored. There are no materializations, result history,
publication rules, digests, freeze/settle stages, idempotency keys, recovery,
or retention policy. Running an output is a read-only calculation.

## Authored definition

An `AnalyticDefinition` contains only:

- one or more project data inputs selected by stable Formula binding ID;
- an ordered list of simple `inner` or `left` equality joins;
- fields placed on Rows and Columns;
- filters;
- sorts;
- an optional row limit; and
- the selected graph kind.

Inputs have a small definition-local ID so two inputs can contain fields with
the same name and the same binding can be used twice in a self-join. Field
references are always qualified by that input ID.

The first version supports top-level fields. Calculated fields, nested-field
traversal, unions, pivots, windows, arbitrary join expressions, color/size
encodings, and renderer styling are intentionally absent. They can be added
from real product requirements without changing the basic saved-output model.

## Execution

One run reads all selected binding IDs from one `FormulaResolverSnapshot`. This
keeps the inputs internally consistent and preserves Structured Data's stable
binding identity across display-name changes.

The executor is a small pure function over Formula wire values. It performs
ordered joins, filters before aggregation, grouping/aggregation from the shelf
placements, sorts after aggregation, and then the optional limit. Exact Formula
rational numbers remain exact in the result.

The result records the output revision it used. If the definition is edited
while a run is executing, the run may still return the data for the revision it
started with; nothing is published back to the output.

## Boundaries

| Concern | Owner |
| --- | --- |
| Saved inputs, joins, shelves, filters, sorts, limit, graph kind | Analytic Output |
| Named project values and table contents | Structured Data |
| Stable binding resolution and exact value representation | Formula and the project resolver |
| Graph rendering, layout, color palettes, fonts, and interaction | Frontend |

Analytic Output does not import the Structured Data store. A narrow adapter in
startup composition reads all selected bindings through the existing Formula
resolver. It never resolves a saved input by display name.

## Storage and runtime

The capability has:

- one `AnalyticOutputRuntime`;
- one SQLite table for saved outputs;
- one pure executor;
- six endpoints for create, update, get, list, delete, and data; and
- no internal jobs or background work.

## Reading order

| File | Contents |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Saved definition and transient data types, joins, shelves, and execution rules |
| [store.md](store.md) | The single SQLite table and revision compare-and-swap |
| [operations.md](operations.md) | Runtime methods, endpoints, errors, and logging |
| [file-architecture.md](file-architecture.md) | Minimal code layout, composition, and tests |
