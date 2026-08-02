# Structured Analysis — design summary

## Purpose

Structured Analysis stores the **recipe for one table or chart**, and runs that
recipe on demand. It is the backend equivalent of arranging a small set of
Tableau pills: choose named project data, join it, place fields on Rows and
Columns, filter it, aggregate it, sort it, and say what kind of chart the result
is meant to be.

```text
Structured Data inputs (by display name)
  → ordered equality joins
  → filters
  → Rows and Columns placements
  → grouping and aggregation
  → sorts and optional limit
  → transient tabular data + the saved graph
```

The capability does not draw anything. It returns structured data plus the
authored rendering intent, and the frontend renders it.

## The two runtime values

Only one value is persisted:

- **`StructuredAnalysis`** — a saved, revisioned definition. The recipe.

Running that definition returns one transient value:

- **`AnalysisData`** — result fields and rows for the analysis revision that was
  read, carrying the saved graph so the caller renders what the author intended.

`AnalysisData` is never stored. There are no materializations, result history,
publication rules, freeze/settle stages, idempotency keys, recovery jobs, or
result retention. Running an analysis is a read-only calculation.

## The saved definition

An `AnalysisDefinition` contains:

- one or more project data **inputs**, selected by Structured Data **display
  name**;
- an ordered list of simple `inner` or `left` equality **joins**;
- **fields placed on Rows and Columns**, each with an aggregation;
- **filters**;
- **sorts**;
- an optional row **limit**; and
- the **graph** — the intended rendering.

Inputs carry a definition-local alias so two inputs can hold fields with the
same name and the same table can be used twice in a self-join. Field references
are always qualified by that alias.

### The graph belongs in the definition

The graph is part of the recipe, not a presentation flag the caller passes at
run time. "Revenue by region as a bar chart" and "revenue by region as a line"
are two different saved analyses, and the shelf shape a definition needs
depends on which one it is.

It is stored as an **object**, not a bare string, specifically so richer
renderings — side-by-side panels, overlaid series, dual axes — can be added as
new fields or variants without rewriting persisted definitions.

### Inputs are selected by display name

Structured Data enforces a live, case-insensitive unique index on display name,
and the Formula resolver snapshot is already keyed by normalized display name.
Names are the project's naming authority, so an analysis names what it wants
the same way a formula does.

The consequence is explicit and accepted: **renaming a Structured Data entry
breaks every saved analysis that named it.** The analysis stays editable and
its run fails with a typed error naming the missing input, rather than silently
retargeting to a different entry.

## Execution

One run resolves every input from **one** `FormulaResolverSnapshot`. This keeps
the inputs internally consistent — a two-input analysis can never combine data
from two different project states — and it means formula-backed cells are
already evaluated before the analysis sees them.

The executor is a small pure function over Formula wire values. It joins,
filters before aggregation, groups and aggregates from the shelf placements,
sorts after aggregation, then applies the limit. Exact Formula rational numbers
stay exact through arithmetic and comparison.

The result records the analysis revision it used. If the definition is edited
while a run is executing, the run still returns data for the revision it
started with; nothing is written back.

## Boundaries

| Concern | Owner |
| --- | --- |
| Saved inputs, joins, shelves, filters, sorts, limit, graph | Structured Analysis |
| Named project values and table contents | Structured Data |
| Name resolution and exact value representation | Formula and the project resolver |
| Chart rendering, layout, palettes, fonts, interaction | Frontend |

Structured Analysis does not import `#structured-data`. Project data reaches it
through one narrow `StructuredDataReader` port, satisfied in composition by an
adapter over the existing Formula name resolver.

## Storage and runtime

The capability has:

- one `StructuredAnalysisCapability` runtime;
- one current-state SQLite table plus the shared resource-history table;
- one pure executor;
- two endpoints — one command, one query; and
- no internal jobs, attempts, or background work of its own beyond the
  process-wide retention sweep every capability joins.

## Reading order

| File | Contents |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Saved definition and transient data types, joins, shelves, graph, execution rules |
| [store.md](store.md) | Current-state table, revision CAS, history, delete, purge, retention |
| [operations.md](operations.md) | Runtime methods, the two endpoints, errors, and logging |
| [file-architecture.md](file-architecture.md) | Code layout, composition, adapter, and tests |
