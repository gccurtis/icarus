# Analytic Output capability — design summary

## Purpose

Analytic Output is a small project-scoped capability under
`3-capabilities/analytic-output/`. It owns saved definitions that turn one
project Formula binding into one table, metric, or chart-ready result, and the
immutable materializations produced from them.

It is named for what it does rather than for the screen it serves. It describes
and materializes **one output**. It is not an analysis process, a notebook, a
scenario engine, a dashboard, or a renderer. The product screen may still be
called Analyze.

```text
project Formula binding
  → frozen exact Formula value
  → fields placed on Rows / Columns / encodings
  → filters, grouping, exact aggregation
  → ordered sorts, optional limit
  → immutable result rows + resolved view
  → frontend renders it
```

## Two objects, two different natures

The whole design turns on one observation: a saved chart is **two things with
opposite lifecycles**, and conflating them is what makes this capability look
bigger than it is.

| | Definition | Materialization |
| --- | --- | --- |
| Nature | a small mutable record | an immutable computed result |
| Edited | constantly, by one person at a time | never |
| Needs | last-write-wins with a stale-write guard | freeze, digests, reproducibility |
| Closest sibling | a Question or a Finding | a Derived Output revision |

So the definition gets the **small flat capability** treatment that Questions,
Hypotheses, and Findings already use — one row, a `revision` counter for
compare-and-swap, soft delete, concurrent endpoints. The materialization gets
the **freeze-and-settle** treatment Derived Outputs already uses — frozen
inputs, digests, compare-and-publish, immutable history.

### Why not Base plus ChangeSet

A saved chart definition does not need the Document/Slide machinery: no
ChangeSets, no inverse operations, no rebase, no compaction, no history
retention policy, no stage-receipt table.

That machinery exists because Documents and Slides are **collaboratively edited
structured content with meaningful undo**. A chart definition is a short config
record — a binding id, two shelf lists, some filters, a sort order, a view
enum. Reversible authored operations over that are ceremony: the inverse of
"change the view from bar to line" is "change it back", which the previous row
value already tells you.

The cost of getting this wrong is not just code. Every ChangeSet capability
needs history retention rules, compaction, rebase semantics, and a settlement
protocol — and each of those is a place for a bug in a capability whose entire
job is "remember which fields go on which shelf".

If undo becomes genuinely necessary, the honest addition is
[Activity](../activity-design.md)-mediated undo over the ordinary update
command, not a private ChangeSet log here.

## Rows and Columns are the only authored placement

Kept from the shape the older draft proposed, because it is right: **Rows and
Columns are the sole authored positional shelves.** X and Y are not stored.

Persisting both shelves and axes would create two authorities for one
placement, and they would drift the moment someone flips a bar chart to
horizontal. Instead, the selected view resolves shelves into explicit render
channels at materialization time, and the immutable result carries a
`ResolvedAnalyticView` with explicit X/Y/category/value bindings so the frontend
never reconstructs the rule.

## Boundaries

| Concern | Authority |
| --- | --- |
| Definition identity, shelves, filters, sorts, view, materializations | Analytic Output |
| Named tables, records, lists, variables and their values | Structured Data |
| Binding identity, exact value algebra, rational arithmetic, wire values | Formula and the project resolver |
| Pixels, SVG, canvas, chart libraries, responsive layout, thumbnails | Frontend |
| Placement inside a Document, Slide, or Spreadsheet | The destination capability |
| Questions, hypotheses, grounded claims | Questions, Hypotheses, Findings |
| Prompt-generated prose and its provenance | Derived Outputs |

Analytic Output reads project data through one narrow `AnalyticInputReader`
implemented in composition over the current `FormulaNameResolver`. It has no
Structured Data store dependency and never resolves an input by display name
after a binding has been chosen.

**Materialization never mutates Structured Data.** It is a read.

## Exactness

Formula produces exact rational values. Those stay exact through filtering,
grouping, aggregation, sorting, and into the materialized result rows. The
conversion to a chart library's floating-point number is a frontend
presentation decision made at the last possible moment.

This matters because an aggregate over exact rationals and an aggregate over
their float projections disagree, and the disagreement shows up as a total that
does not match its parts.

## Freezing the input value, not the revision

Structured Data has no historical value read. A materialization that recorded
only an entry revision would be unable to reproduce itself the moment the
underlying data changed.

So the serial freeze stage persists **the exact `FormulaWireValue`**, not a
pointer to it. Concurrent computation then runs against those frozen bytes even
if project data moves underneath. This is the same reasoning that makes a
Derived Output refresh freeze its scope manifest rather than re-resolving it
per query.

## Reading order

| File | Covers |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Definition, placements, filters, views, materializations, executor order, invariants |
| [operations.md](operations.md) | Endpoints, jobs, queue placement, errors, logging |
| [store.md](store.md) | SQLite schema, freeze/publish transactions, retention |
| [file-architecture.md](file-architecture.md) | Module layout and composition |

## Relationship to the superseded draft

An earlier draft of this capability exists on branch
`agent/analytic-output-research-designs` (PR #3). This directory replaces it.
The substantive departures:

| Earlier draft | Here | Why |
| --- | --- | --- |
| Base + ChangeSet authored history with inverse operations, rebase, compaction | One mutable definition row with revision CAS | See above. A config record is not collaborative content. |
| Stage-receipt table for materialization idempotency | Attempt row plus compare-and-publish | Matches what Derived Outputs actually does today. One mechanism, not two. |
| Command/query envelope pair | Flat endpoints | Matches the sibling small capabilities (Questions, Hypotheses, Findings). The command/query pair earns its keep on Document and Slide, where the operation union is large. |
| `latestMaterializationId` pointer advanced by settlement | Same | Kept. This part was right. |
| Rows/Columns canonical, X/Y resolved | Same | Kept. This part was right. |
| Exact `FormulaWireValue` frozen, not a revision | Same | Kept. This part was right. |

## Open decisions

**A1 · One binding per output.** *Structural.* An output reads exactly one
project Formula binding. Multi-source joins belong in Structured Data or
Formula before visualisation, or this becomes a second data-modelling runtime.
A Structured Data variable can already resolve to a table derived from other
declarations, so the escape hatch exists.

**A2 · The definition is mutable with revision CAS, not ChangeSet-versioned.**
*Structural.* The central departure from the earlier draft. Reversing it means
adopting the Document machinery here.

**A3 · Which views ship first.** *Behavioural.* Proposed: `table`, `metric`,
`bar`, `line`, `area`, `scatter`, `pie`. Histogram, heatmap, box plot, map, and
faceting extend the closed union later, once each has an explicit data
contract.

**A4 · No local calculated fields.** *Behavioural.* Reusable calculations get
promoted into Structured Data. Adding row-local Formula expressions later needs
a stable local-binding admission contract, not an opaque source string.

**A5 · Embedded outputs pin a materialization; they do not follow head.**
*Behavioural.* A Document or Slide storing an analytic output stores an
immutable materialization id plus digest and adopts a newer one through its own
explicit refresh. Following head automatically would make a slide change
underneath a presenter.

**A6 · Semantic view options only.** *Behavioural.* Orientation, stacking,
axes, legend, labels. No colour palettes or renderer-specific JSON yet; a typed
palette contract can be added without changing the model.

**A7 · Retention of materialized data.** *Behavioural.* Configured limits on
frozen-input bytes, result rows, result cells, and retained terminal
materializations. Any materialization referenced by another capability must
remain reachable, which means retention cannot be purely age-based.

**A8 · Schema drift produces diagnostics, not silent repair.** *Behavioural.*
Structured Data fields have no stable column ids, so a definition addresses
nested fields by a path of field names. A rename or incompatible type change
produces a typed materialization diagnostic until the definition is updated. The
alternative — guessing at a rename — is how a chart silently starts showing a
different number.
