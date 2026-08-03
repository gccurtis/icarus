# Structured Analytic — design summary

## Purpose

Structured Data says how to represent **data**. Structured Analytic says how to
represent the **combinations of that data that show a relationship** — the thing
you actually put on a screen.

A saved analytic is the recipe for one table or chart. It is the backend
equivalent of arranging a small set of Tableau pills: choose named project data,
join it, place fields on Rows and Columns, filter it, aggregate it, sort it, and
say what kind of chart the result is meant to be.

```text
Structured Data inputs (by name)
  → ordered equality joins
  → filters
  → Rows and Columns placements
  → grouping and aggregation
  → sorts and optional limit
  → a pull: tabular data + the saved display + a source receipt
```

The capability does not draw anything. It returns data plus the authored
rendering intent, and the frontend renders it.

### Why "analytic" and not "analysis"

**Analysis is a different, later capability.** Research will run real analysis —
Python, arbitrary computation, retained code and inputs — and its output will
be a genuine analysis resource.

The point of this capability is that the *shape it returns is the common
display language*. When Research produces a result, it produces data in this
shape, and it is renderable for free. Reserving "analysis" for the thing that
computes, and "analytic" for the saved display recipe and its result, keeps that
boundary legible.

## The two runtime values

Only one is persisted:

- **`StructuredAnalytic`** — a saved, revisioned definition. The recipe.

Running one is a **pull**, and it returns:

- **`AnalyticPull`** — result fields and rows, the saved display, the analytic
  revision that produced it, and what every Structured Data input was when it
  was read.

`AnalyticPull` is never stored. There are no materializations, result history,
publication rules, freeze/settle stages, idempotency keys, recovery jobs, or
result retention. A pull is a read-only calculation.

## The saved definition

An `AnalyticDefinition` contains:

- one or more project data **inputs**, selected by Structured Data **name**;
- an ordered list of simple `inner` or `left` equality **joins**;
- **fields placed on Rows and Columns**, each with an aggregation;
- **filters**;
- **sorts**;
- an optional row **limit**; and
- the **display** — the intended rendering.

### Inputs are just names, and every kind works

An input is a name. `Orders` is the input, and a field on it is
`{ input: "Orders", field: "region" }`. There is no separate alias to invent or
remember; the author writes what they already call the data.

**Every wire-serializable Structured Data kind is a valid input**, because they
are all tables once you look at them right: a table is a table, a record is one
row, a list is one column, and a scalar is a one-by-one table. For a list or a
scalar the single field is named after the input itself, so a variable holding
`42` named `TargetMargin` is `{ input: "TargetMargin", field: "TargetMargin" }`.
An author never has to know how something was declared before putting it on a
shelf. Only `function` values are rejected — they cannot cross the wire.

The one case that needs more than a name is a self-join, where an optional `as`
supplies a second label. It is also the seam a future *computed* input would use
— an expression over other inputs, named by `as` rather than by a project name.

### Renames are survivable

Names are the selector, but the dependency runs one way and Structured Data
cannot notify anything when a name changes. So a definition also records, best
effort, which entry each name meant when it was saved.

A pull looks up by name first. If the name is gone but the recorded entry still
exists, the entry was renamed: the pull **succeeds** using it and reports
`renamed`. If the name resolves to a *different* entry than the one recorded,
the pull succeeds — the name is the authority — and reports `retargeted`. Both
are reported rather than silently absorbed, and neither writes back to the
definition; repairing the stored name is an ordinary update the author makes.

### The display belongs in the definition

The display is part of the recipe, not a flag the caller passes at pull time.
"Revenue by region as a bar" and "revenue by region as a line" are two different
saved analytics, and the shelf shape each needs differs.

It is called *display* rather than *graph* because a **table is a first-class
output**, not a fallback for "no chart". Producing a joined, filtered,
aggregated table is exactly the job this capability exists for.

It is stored as an **object**, not a bare string, so richer renderings —
side-by-side panels, overlaid series, dual axes — can be added as new fields or
variants without rewriting persisted definitions.

## Pulls carry a receipt

A pull reads project data that changes underneath it. So every pull reports
what it actually read:

- the **analytic revision** the calculation used; and
- for each input, the **entry that answered, its current name, and its
  revision**, plus whether it resolved normally, was renamed, or was retargeted.

**Revisions only — no digests.** A digest can say "this value differs from the
one you had", but it cannot say what the value was or why, and there is no
revision to go back and look at. A revision is an address; a digest is a boolean
nobody can act on. The known gap — a formula-backed entry's revision not moving
when its inputs move — is fixed properly by propagating revisions through the
dependency graph in Structured Data, tracked in
[`0-general-updates.md` item 17](../0-general-updates.md).

A pull is always fresh. **Staleness is a property of a pull someone is still
holding, not of the analytic**, so `analytic.check` re-reads metadata cheaply and
lets a client watching a live chart avoid re-pulling on a timer. There is no
sweep, no scheduler, and no active/inactive flag — see
[operations.md](operations.md#freshness).

## The definition is sugar for a formula

**A Formula expression is the semantics; the pills are the authoring surface.**

The recipe exists because it is *manipulable* — swapping a column or changing an
aggregation is a small structured edit, and doing the same by rewriting formula
text is not. But nothing about that structure defines what the numbers mean.
Meaning comes from one deterministic function, `compile: definition → formula`,
and a pull compiles and evaluates rather than interpreting.

```text
DISPLAY(LIMIT(SORT(GROUP(WHERE(JOIN(ASTABLE(Orders,"Orders"), ASTABLE(Reps,"Reps"), …),
        { all: [{ field: "Orders.status", op: "equals", value: "closed" }] }),
        { keys: ["Orders.region"],
          aggregates: [{ as: "Total", field: "Orders.amount", fn: "sum" }] }),
        [{ field: "Total", direction: "desc" }]), 10), "bar")
```

Eight new Formula builtins carry it — `ASTABLE`, `JOIN`, `WHERE`, `GROUP`,
`AGGREGATE`, `SORT`, `LIMIT`, `DISPLAY` — plus backtick-quoted names so a table
called `Q3 Orders` is referenceable at all. Each is independently useful to a
formula author. Options are records with per-key defaults. Full mapping, the
research that shaped it, and the builtin specs are in
[compilation.md](compilation.md).

Four things follow:

- **There is no second evaluator.** No parallel semantics to keep in sync, and
  exact rational arithmetic is Formula's, not a reimplementation.
- **Compilation is one-way.** The definition stays canonical; the expression is
  derived, never persisted, and re-derived whenever it is wanted. That is why a
  pull returns the definition alongside the data — a pill editor cannot recover
  it from the result.
- **A formula can return a chart.** `DISPLAY` yields a table carrying rendering
  intent, which is what makes "any display can be used as a table" true by
  construction rather than by a conversion rule.
- **Compiled columns are readable** — `Orders.region`, `Total` — which is what
  makes a compiled analytic worth saving into the project.

One pull evaluates against **one** `FormulaResolverSnapshot`, so a two-input
analytic can never combine data from two different project states. If the
definition is edited mid-pull, the pull still returns data for the revision it
captured.

## Boundaries

| Concern | Owner |
| --- | --- |
| Saved inputs, joins, shelves, filters, sorts, limit, display | Structured Analytic |
| Named project values and table contents | Structured Data |
| Name resolution and exact value representation | Formula and the project resolver |
| Real computation over data (Python, retained code) | Research / Analysis, later |
| Chart rendering, layout, palettes, fonts, interaction | Frontend |

Structured Analytic does not import `#structured-data`. It reaches project data
through one narrow `ProjectDataPort` — a resolver snapshot and cheap entry
metadata — satisfied in composition by an adapter over the existing Formula name
resolver. It does import `#formula` directly, which is an ordinary platform
dependency Document already has.

## Storage and runtime

The capability has:

- one `StructuredAnalyticCapability` runtime;
- one current-state SQLite table plus the shared resource-history table;
- one pure compiler;
- two endpoints — one command, one query;
- two ways to become project data — `save` (live, a formula-backed entry) and
  `copy` (frozen, a literal table); and
- no internal jobs, attempts, or background work of its own beyond the
  process-wide retention sweep every capability joins.

## Reading order

| File | Contents |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Saved definition and pull types, input normalization, joins, shelves, display, rename handling |
| [compilation.md](compilation.md) | The definition → Formula mapping, the eight new builtins, and a worked example |
| [store.md](store.md) | Current-state table, revision CAS, history, delete, purge, retention |
| [operations.md](operations.md) | Runtime methods, validation split, the two endpoints, freshness, errors, logging |
| [file-architecture.md](file-architecture.md) | Code layout, composition, adapter, and tests |
| [derived-tables.md](derived-tables.md) | `save` and `copy` — an analytic as a live or frozen Structured Data entry |

The implementation plan lives at
[`scratch/structured-analytic-implementation-plan.md`](../structured-analytic-implementation-plan.md).
