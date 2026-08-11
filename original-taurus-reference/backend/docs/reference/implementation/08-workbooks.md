# Stage 08 — Workbooks

## Outcome

Build the Workbook Resource family: ordered Worksheets, typed cells/ranges,
structured tables, names, formats, formulas, prompt/data bindings, dependency
calculation, chart specifications, family templates, extraction, and durable
multi-Cell editing.

## Non-goals

- treating one worksheet as a top-level Resource
- implementing Formula inside Workbooks
- XLSX translation or browser grid virtualization
- arbitrary code/macros
- silent Excel-compatibility claims

## Target tree and files

```text
internal/
  capabilities/resources/workbooks/
  cell/handlers/workbooks/
  cell/handlers/workbooks/{repository.go,mysql/}
  wiring/{testing,development,production}/workbooks.go
migrations/project/*_workbooks.sql
api/openapi/product-v1.yaml
test/{integration,recovery,golden}/workbooks/
```

## Versioned contracts and schemas

Register only the exact operations in
[Workbooks](../capabilities/workbooks.md#commands-and-queries). Schemas version
Workbook/Worksheet identity, stable axes, sparse typed cells, names, tables,
charts, bindings, history and Collaboration anchors. Transport range/page
bounds and revision grains are wire contracts; unknown value, formula, chart,
binding or representation versions fail closed. The seven Workbook Template
operations are registered from
[Translation and Templates](../capabilities/translation-and-templates.md#family-templates),
not from a generic Template API.

## Canonical model

- Workbook metadata, version, calculation policy, locale/timezone policy;
- ordered Worksheets with stable IDs, names, visibility, dimensions/freeze;
- stable rows/columns/cells and sparse typed cell records;
- literal, Formula, prompt/Resolution, and bound-data cell definitions;
- typed DataBindings with stable IDs, exact owner/projection references,
  mapping and refresh policy, last-good normalized value and revision;
- computed typed result/error and dependency/version metadata;
- ranges, merged regions, validation, conditional/static formatting;
- named ranges/values/formulas and structured tables with stable field IDs;
- chart specifications over exact ranges/tables/Project data assets;
- family-native Collaboration anchors/rebase semantics, source/provenance,
  templates, and change history. Collaboration owns comment and private Note
  records and operations in Stage 12.

The backend model is not tied to a particular grid component. Viewport data is
a projection of canonical Workbook state.

## Operations

- lifecycle/create from Workbook template and exact-version same-Project
  Workbook duplication into a new independent identity;
- add/rename/reorder/hide/delete Worksheet;
- read bounded grid/range/table projection at exact version;
- set/clear cells under expected versions; copy/move ranges only through the
  exact `workbooks.copy_range.v1`/`workbooks.move_range.v1` transfer plans with
  explicit overlap, reference-rewrite and derived-result invalidation policy;
- insert/delete/move rows/columns and update formats/validation;
- define/update names and structured tables; remove them only through the exact
  `workbooks.remove_name.v1`/`workbooks.remove_table.v1` tombstone operations
  after bounded reverse-reference validation;
- set Formula and recalculate affected dependency subgraph;
- create/update/remove typed data bindings and refresh them conditionally
  against exact source/dependency versions;
- create/update/remove chart specification;
- validate/rebase a Collaboration anchor without storing comment/Note content;
- extract typed/tabular/authored content with generated-value markers;
- run bounded read-only exact-revision table queries through
  `workbooks.query_table.v1` and deterministic CSV/JSON/Markdown/chart-scene
  renders through `workbooks.render.v1`;
- on an over-bound request, return `workbook_query_async_required` or
  `workbook_render_async_required` with no side effect; the exact durable paths
  are `workbooks.table_query_jobs.request.v1`/
  `workbooks.table_query_jobs.status.get.v1` and
  `workbooks.render_jobs.request.v1`/
  `workbooks.render_jobs.status.get.v1`.

## Capability ports

- Formula evaluator/name resolver in Workbook vocabulary;
- Resolution provider for prompt cells/grounded transformations;
- `WorkbookDataProvider`, which reads one exact typed Data/Source projection
  and returns normalized values plus dependency versions;
- authorized File/asset reader for embedded items;
- render provider only for family-specific deterministic chart/image output.

Adapters use registered operations. Workbooks imports no Formula, Resolution,
Files, or provider implementation.

## Persistence and concurrency

Workbooks chooses capability-specific revision grains. Initial correctness can
use an aggregate head plus immutable operation sets with cell/range/table
preconditions, while allowing short normalized row locks for unique names and
structural shifts. The specification must define overlap and transform rules
before adopting Change Core.

Disjoint cell writes can both settle. Structural edits that shift addressed
regions must transform stable IDs, not rely only on row numbers. Formula
recalculation uses a versioned fenced job and publishes results only if input
dependencies still match; otherwise it restarts from canonical state.

## Request, authority, failure, and recovery

The handler authorizes the exact Workbook/component, loads one consistent
view, adapts exact Formula/Resolution/Data/asset reads, calls the capability,
then consumes a fresh permit and commits state, idempotency, required Project
Audit and fenced recalculation/render jobs in one Project transaction.
Conflicts return current versions; stale jobs cannot publish. Recovery rebuilds
jobs and projections from canonical Workbook state, while canonical history
uses Project backup/restore. Collaboration content remains Stage 12-owned and
only Workbook-native anchors exist here.

The two interactive Queries never create a Job or vary their transaction
class. Each idempotent durable request freezes exact Workbook/table/range/chart
revisions, the typed query or render plan, bounds/options and policy version,
then commits its Job/work receipt/idempotency/Audit envelope. Status is a
separate read-only Query. Ready data is Workbook-owned typed result metadata;
publishing a File remains Translation/Files work. Ask cannot submit either
durable request.

## Production and test composition

Production requires durable persistence and real adapters for every advertised
binding/render feature. Missing Formula, Resolution, Data or renderer support
is explicit. Pure tests use deterministic ports; live database race/crash/
restore and headless golden evidence precede promotion. Browser grid work is
Stage 13.

## Stable failures

Invalid range/type/format; duplicate Worksheet/name/table; unknown reference;
dependency cycle; stale structural/cell precondition; incompatible overlap;
Formula error; unavailable Resolution; size/calculation budget; unsupported
chart/value; `workbook_query_async_required`;
`workbook_render_async_required`; stale authority; integrity/persistence
failure.

## Proof matrix

- sparse storage and bounded viewport/range reads;
- typed values, validation, formats, insert/delete/move transforms;
- disjoint and overlapping edits from independent Cells;
- stable references across structural changes;
- names/tables/cycles/dependency recalculation and stale-job fencing;
- pure Formula determinism and explicit unsupported rendering;
- prompt/generated outputs preserve last good and do not re-enter Knowledge as
  authored facts;
- template instantiation strips instance identity/history/output as policy;
- all seven Workbook Template publish/get/list/plan/instantiate/lifecycle
  surfaces obey the same stripping/lineage contract without a generic Template
  owner;
- DataBinding type/mapping/source-substitution, refresh fencing, removal and
  last-good preservation;
- Collaboration anchor validation/rebase fixtures; comment/private Note
  content and access are proved in Stage 12;
- headless JSON/CSV/Markdown golden reconstruction from live MySQL;
- bounded query/render side-effect proofs, over-bound zero-write proofs,
  durable-request idempotency/restart/status proofs and typed-result ownership;
  and
- crash/retry/idempotency/permit/Audit/backup/restore.

## Completion boundary

The Workbook works headlessly with Formula/Data. Browser grid editing and XLSX
fidelity are separate Stage 13 and Stage 11 concerns.

## Consequential decisions and source grounding

- **Stable axes carry identity, not screen coordinates.** Structural transforms
  and multi-Cell reconciliation cannot depend on a grid widget.
- **Workbook owns formula slots/results, not Formula semantics.** It decides
  persistence and last-good display from typed Formula output.
- **Collaboration owns comment/private Note content.** Workbook supplies anchor
  validation/rebase only.

Grounding: [Workbook capability](../capabilities/workbooks.md),
[Formula and Data](../capabilities/formula-and-data.md), and
[resource-mutation flow](../flows/resource-mutation.md).
