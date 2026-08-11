# Workbooks

## Purpose

Workbooks provides a backend-owned analytical grid Resource containing one or
more ordered Worksheets. It owns stable cell/range/table semantics, typed
values, formatting, names, Formula and prompt bindings, charts, deterministic
tabular extraction, and a concurrency protocol suited to sparse structured
data. A frontend grid is an interaction adapter, not canonical truth.

### Owns

- Workbook identity, name, lifecycle, representation version and ordered
  Worksheet identities.
- Stable row/column axes, cells, ranges, names, variables, lambdas, structured
  tables, charts, styles and workbook calculation settings.
- Authored literals and expressions plus exact typed/last-good computed or
  prompt results and dependency provenance.
- Workbook-, Worksheet-structure-, cell-, table-, name- and chart-grained
  revisions and reconciliation rules.
- Workbook-specific templates, extraction, render and CSV-shaped projections.

### Does not own

- Formula language/evaluator, model/provider calls, Knowledge, file bytes,
  comments, sessions, authority, SQL, jobs, required Audit or browser selection.
- A hidden generic Spreadsheet Resource. `Workbook` is the backend family and
  a `Worksheet` is a contained sheet; both have stable IDs.
- Provider SDK values or live recalculation clients in persisted state.

## Supported feature contract

| Feature | Required behavior | Canonical boundary |
| --- | --- | --- |
| Multi-Worksheet workbook | Add, rename, reorder, hide and delete Worksheets while retaining stable IDs and at least one visible Worksheet | Workbook order/metadata revision |
| Sparse typed grid | Blank, boolean, integer, decimal, text, date/time, duration, error and bounded structured values; types never silently stringify | Cell model keyed by stable RowID/ColumnID |
| Axis operations | Insert, remove, move, hide, size and label rows/columns; references follow stable IDs rather than display positions | Worksheet structure revision |
| Range editing | Read/write/clear/copy/move rectangular or explicit cell sets atomically with explicit overlap, reference-rewrite and derived-result policy | Addressed cell revisions and expected structure |
| Formatting | Number/date formats, alignment, typography, fill, borders, conditional-format rules and protected/read-only presentation metadata | Style dictionary and property revisions |
| Names and variables | Workbook/Worksheet-scoped names, ranges, constants, variables and typed lambdas with deterministic resolution and cycle detection | Name registry with stable NameID |
| Structured tables | Stable table/column IDs, headers, row membership, typed columns, filters/sorts and totals metadata | Table model; views do not reorder canonical rows silently |
| Formula cells | Store exact expression, expected type, typed result/error, dependency versions and calculation state | Formula binding; evaluator is an injected port |
| Prompt cells | Store prompt, normalized artifact/evidence, exact input versions, state and last-good typed/display result | Prompt binding; provider calls are external |
| Data bindings | Bind a stable cell/range/table target to one exact Data/Source projection contract; refresh conditionally preserves last good | Typed `DataBinding`; data access is an injected port |
| Charts | Charts bind to exact ranges/tables/Formula outputs and retain last-good scene data with stale/error state | Chart spec and binding versions |
| Analysis | Sort/filter/group/pivot/summary requests return bounded deterministic projections; materialization is explicit | Derived query or named persisted object |
| Sources/provenance | Cell/table/chart values distinguish authored, imported, Formula-derived and inferred origins | Server-stamped provenance and exact versions |
| Templates | Instantiate a Workbook version with declared parameters and target-Project name resolution | Workbook version plus family metadata |
| Import/export | Deterministic canonical JSON/CSV core; XLSX/CSV translators declare loss and type coercion | Translation around exact versions |

## Canonical domain model

| Type | Required content and invariant |
| --- | --- |
| `Workbook` | `WorkbookID`, name, lifecycle, representation version, ordered Worksheet IDs, default styles/calculation policy, metadata revision and trusted attribution |
| `Worksheet` | Stable `WorksheetID`, name unique under workbook comparison rules, visibility, tab color, frozen panes, structure revision, grid bounds and ordered Row/Column axes |
| `RowAxis` / `ColumnAxis` | Stable ID, canonical order position, visibility, size and optional label/default style; deleted IDs are never reused |
| `CellAddress` | `(WorksheetID, RowID, ColumnID)`; A1 notation is a derived presentation and parser, never canonical identity |
| `Cell` | Address, cell revision, closed content kind, style reference, validation/protection metadata and server provenance |
| `CellValue` | Versioned typed value with canonical decimal/time encoding and explicit blank/error/unsupported values |
| `FormulaBinding` | Source expression, expected type/render context, dependency references/versions, typed result/error, calculation state and last-good result |
| `PromptBinding` | Prompt/options, exact context/input versions, artifact/evidence references, typed result, state and last-good result |
| `DataBinding` | Stable BindingID, target cell/range/table, owner-kind and exact source/projection reference, typed mapping, refresh policy, dependency versions, last-good normalized value, state and revision; it stores no client/provider handle |
| `RangeTransferPlan` | Exact source/destination Worksheet structure revisions, bounded ordered address maps, expected source/destination cell revisions, move/copy mode, overlap rule, relative/absolute reference-rewrite policy and derived-result invalidation plan |
| `NamedItem` | Stable NameID, scope, validated name, kind, definition, expected type and revision; duplicate visible names in one scope are forbidden |
| `StructuredTable` | Stable TableID, Worksheet/range membership, stable columns, typed schema, filters/sorts/totals and revision; cells remain the underlying authored values |
| `Chart` | Stable ChartID, kind, layout/style, series/bindings, exact source revisions, last-good normalized scene and revision |
| `WorkbookProjection` | Exact canonical revisions plus bounded requested cells/objects and dependency status; never claims omitted cells are blank |
| `WorkbookTableQueryResult` | Immutable request/result IDs, exact Workbook/Table revision set, typed output schema, row/aggregate counts, digest, size, query-policy version and opaque family result reference; no mutable query cursor or delivery credential |
| `WorkbookRenderResult` | Immutable request/result IDs, exact revision/dependency set, closed range/CSV/scene kind, renderer/policy versions, digest, size, warnings and opaque family result reference; no File or delivery URL |

Decimal values use an explicit canonical decimal representation; times include
timezone/offset semantics rather than machine-local time. Formulas cannot
persist arbitrary Go values. Structured/array values have declared dimension,
element-type and byte/cell bounds.

References resolve stable IDs. User-facing `A1`, named and table syntax is
parsed into those IDs under an exact structure/name revision. Moving an axis
changes presentation coordinates but not the identity of cells or references.
Deleting an axis produces explicit broken-reference errors where policy does
not rewrite the definition.

## Commands and queries

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `workbooks.create.v1` | Idempotent command | Create bounded workbook and initial Worksheet, optionally from a validated template |
| `workbooks.duplicate.v1` | Idempotent command | Freeze one authorized exact Workbook revision and create an independent same-Project Workbook identity/content graph with bounded provenance; no grants, comments or private state are copied |
| `workbooks.rename.v1` | Command | Rename under expected metadata revision |
| `workbooks.set_lifecycle.v1` | Command | Archive/restore or tombstone under retention policy |
| `workbooks.add_worksheet.v1` | Idempotent command | Add a stable Worksheet at a declared order anchor |
| `workbooks.update_worksheets.v1` | Command | Rename/reorder/hide/delete Worksheets with expected workbook/structure revisions |
| `workbooks.edit_axes.v1` | Idempotent command | Insert/move/remove/resize/hide rows/columns as one typed structural operation |
| `workbooks.set_cells.v1` | Idempotent command | Atomically set/clear bounded cells with exact structure and per-cell expectations |
| `workbooks.copy_range.v1` | Idempotent command | Copy a bounded exact cell/range set to declared destinations, allocate new content revisions, rebase relative references/preserve absolute references, and invalidate copied derived results under one transfer plan |
| `workbooks.move_range.v1` | Idempotent command | Atomically transfer a bounded exact cell/range set, clear sources, apply the declared external-reference retarget/preserve policy, and reject ambiguous overlap/structured-object crossings |
| `workbooks.set_format.v1` | Idempotent command | Apply explicit style properties/rules to bounded targets without overwriting unrelated properties |
| `workbooks.upsert_name.v1` | Idempotent command | Define/rename/update a range, variable, constant or lambda under scope/name revision |
| `workbooks.remove_name.v1` | Idempotent command | Tombstone one exact NameID under expected registry/name revision only when no live Formula/table/chart/binding reference remains; IDs are never reused |
| `workbooks.upsert_table.v1` | Idempotent command | Create/update table schema/range/view settings with explicit expected revision |
| `workbooks.remove_table.v1` | Idempotent command | Tombstone one exact TableID under expected table/structure revision only when no live dependent reference remains; underlying authored cells are preserved |
| `workbooks.upsert_chart.v1` | Idempotent command | Create/update/delete chart spec and source binding under exact revisions |
| `workbooks.set_data_binding.v1` | Idempotent command | Create/update/remove one typed DataBinding under exact target, source and binding revisions |
| `workbooks.recalculate.v1` | Durable command | Evaluate a bounded dependency closure and conditionally store exact-version results |
| `workbooks.resolve_prompt.v1` | Durable command | Resolve a prompt cell and conditionally store normalized exact-version result/evidence |
| `workbooks.refresh_data_binding.v1` | Durable command | Read one exact bound projection outside the write transaction and conditionally store its normalized last-good result |
| `workbooks.get.v1` | Query | Return metadata and exact canonical revisions |
| `workbooks.get_range.v1` | Query | Return a bounded typed grid projection and requested style/formula provenance |
| `workbooks.query_table.v1` | Query | Return a bounded read-only filter/sort/group/aggregate projection of one exact table revision |
| `workbooks.table_query_jobs.request.v1` | Idempotent durable command | Freeze the exact Workbook/table revisions, typed query plan, limits and policy version and admit a durable table-query Job |
| `workbooks.table_query_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed table-query result metadata for that exact request |
| `workbooks.render.v1` | Query | Return bounded canonical JSON, typed CSV/range output or a normalized chart scene at exact revisions without creating an artifact |
| `workbooks.render_jobs.request.v1` | Idempotent durable command | Freeze the exact Workbook revision map, range/chart target, format/options and policy version and admit a durable render Job |
| `workbooks.render_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed Workbook-render result metadata for that exact request |
| `workbooks.extract.v1` | Query | Produce exact-version typed tables/names/authored text for Knowledge, excluding derived feedback by default |
| `workbooks.validate_anchor.v1` | Query | Validate or deterministically rebase a Collaboration/source anchor across exact Workbook revisions |

`workbooks.query_table.v1` and `workbooks.render.v1` have fixed, bounded,
read-only request classes. They never create a Job, WorkAuthority, persisted
query/render object, idempotency record or Audit mutation. A table projection
that exceeds its declared row/cell/byte/time bounds returns
`workbook_query_async_required` and names
`workbooks.table_query_jobs.request.v1`; an oversized render returns
`workbook_render_async_required` and names
`workbooks.render_jobs.request.v1`. Either rejection has no side effects.

Each durable request command freezes the exact Workbook/Worksheet/Table/Cell/
Chart revision set, normalized query or render plan, output format and policy
version before committing its request, Job, receipt and Audit envelope through
the ordinary durable-work protocol. The corresponding status query only
observes state. Ready table-query metadata identifies the typed schema,
row/aggregate counts, digest, size and exact input revisions; ready render
metadata identifies the typed range/CSV/scene kind, digest, size, renderer
version and exact revision lineage. Translation alone may turn an export into
a File. Ask may invoke either bounded query when admitted, but dispatch cannot
auto-upgrade it into its durable request command.

Bulk imports are translated into bounded batches of `edit_axes`, `set_cells`,
`upsert_name` and `upsert_table` commands or one durable import job that applies
the same invariants. XLSX export reads an exact revision set and records a loss
report and output File.

## Capability API and ports

Pure operations include model validation, axis/reference resolution, typed
cell mutation, table/name/chart operations, dependency-graph construction,
cycle detection, conditional result application, range projection, extraction
and rendering.

Consumer-owned ports use Workbook vocabulary:

```go
type WorkbookFormulaProvider interface {
    Evaluate(context.Context, WorkbookFormulaRequest) (WorkbookFormulaResult, error)
}

type WorkbookPromptProvider interface {
    Resolve(context.Context, WorkbookPromptRequest) (WorkbookPromptResult, error)
}

type WorkbookDataProvider interface {
    ReadExact(context.Context, WorkbookDataRequest) (WorkbookDataResult, error)
}

type WorkbookAssetProvider interface {
    ResolveExact(context.Context, WorkbookAssetRequest) (WorkbookAsset, error)
}
```

The Formula request supplies explicit typed cells/names/functions and a bounded
dependency budget. It does not give Formula a repository. Results return typed
values, normalized errors, dependencies and usage—not provider objects. The
data request names one exact owner/projection contract, typed mapping and
bounds; its result includes exact dependency versions and a normalized typed
value. Prompt, data and asset results follow the same exact-version rule.

Handler-owned contracts cover Project-bound consistent reads, sorted row locks
and conditional writes; idempotency; permit/Audit transactions; job submission;
and Translation adapters. They do not belong in the capability library.

## Persistence and concurrency

Workbooks does not use Document ChangeSets. Its initial protocol combines:

- a metadata/order revision for the Workbook;
- one structure revision per Worksheet;
- one revision per nonblank Cell and explicit tombstone where needed;
- one revision per Name, Table, Chart, DataBinding and style/rule object, with
  retained Name/Table tombstones and no stable-ID reuse; and
- immutable calculation/prompt/data-refresh evidence keyed by exact input digest, with a
  conditional pointer to the current result.

Commands carry every expected revision that can affect their meaning. Lock
ordering is deterministic: Workbook, Worksheets by ID, axes by ID, then cells
and named objects by stable ID. The handler locks only the bounded affected
set, revalidates existence/structure/name bindings, calls the pure operation,
then obtains and consumes a fresh permit in the same commit.

Rules:

- independent cell edits can commit concurrently;
- a multi-cell paste/import is atomic for its declared set;
- range copy/move locks the sorted union of source, destination, affected
  Formula/name/table/binding reverse references and both Worksheet structure
  revisions; overlap is resolved from the frozen source view or rejected by
  the declared policy, never by write order;
- copy leaves source cells unchanged, rebases relative Formula references,
  preserves absolute references, stamps copy provenance and invalidates
  Formula/prompt/data derived results for recomputation rather than copying
  them as fresh Evidence; move clears the exact sources and applies one closed
  external-reference policy (`retarget_moved_content` or
  `preserve_source_addresses`) atomically;
- a transfer that partially crosses a structured table, merged/validated
  region, protected target or unsupported named object is rejected and must
  use the corresponding typed owner operation;
- two writes to the same authored cell revision conflict—no silent
  last-write-wins;
- property-specific formatting may merge only when the properties are
  disjoint and the command declares their expected property revisions;
- structural changes serialize per Worksheet structure revision. Stable axis
  IDs let a stale cell edit be re-resolved; if a referenced axis was deleted or
  its semantic target changed, the edit conflicts;
- table/name/chart/DataBinding operations conditionally update their own
  revisions and validate all referenced cell/axis/name versions; Name/Table
  removal locks the bounded reverse-reference set and fails while any live
  dependency remains;
- Formula/prompt/data refresh computation runs outside the write transaction and records an
  exact dependency digest. A result commits only if those dependencies and the
  binding revision still match. Otherwise it is stale and last-good remains;
  and
- range/table queries use one consistent revision view. They return the exact
  revision set so the client can detect and refresh stale projections.

No Cell-local calculation cache establishes correctness. Cached values are
version-keyed and disposable. A durable recalculation/import job uses a lease
fence and commits in bounded transactions without presenting partial work as a
single atomic user command unless the command explicitly chose staged import.

Effectful durable recalculate/prompt/data-binding refresh preselects stable
work, `WorkAuthorityID` and `JobID` values. Control creates pending work under
the current session; one session-permitted Project transaction stores intent,
Job, non-authoritative receipt, idempotency, Audit/fact and `durable_job@1`, and
trusted exact-receipt acknowledgement activates it. Pending authority/bare
receipt cannot issue a permit; missing receipt expires and lost acknowledgement
reconciles only from trusted placement. Each canonical Workbook result commit
uses a fresh work-sourced permit. Current-family sign-out preserves admitted
work; broader authority/cancel/expiry revocation denies/fences it. The finalizer
can change only Job bookkeeping, never Workbook/result state or compute/import
effects.

## Security, failure and stable errors

Formula/prompt source, hidden Worksheets, protected ranges and connector data
are returned only by explicit actions. Spreadsheet formulas cannot address a
different Project or arbitrary files/network endpoints. CSV/XLSX handling
guards formula injection, zip expansion, macro/external-link policy and type
coercion; unsafe features fail or are reported, never executed.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `workbook_invalid_model` | `invalid_argument` | Invalid axis, span, type, name, table, chart or bound |
| `workbook_unknown_kind` | `unsupported_version` | Unknown representation/content/style/formula-result kind |
| `workbook_conflict` | `conflict` | One expected grain changed; response identifies bounded safe grain/revision |
| `workbook_broken_reference` | `precondition_failed` | Referenced axis/name/table/resource no longer resolves |
| `workbook_reference_in_use` | `precondition_failed` | Name/Table removal is blocked by bounded current dependents; no partial tombstone occurs |
| `workbook_range_transfer_invalid` | `precondition_failed` | Move/copy overlap, protected/structured crossing or reference policy cannot be applied atomically |
| `workbook_cycle` | `precondition_failed` | Formula/name dependency cycle with bounded cycle path |
| `workbook_stale_result` | `conflict` | Formula/prompt/chart output dependencies advanced; recompute |
| `workbook_type_mismatch` | `invalid_argument` | Typed value/result violates cell/table/Formula expectation |
| `workbook_too_large` | `invalid_argument` | Cell/range/dependency/result budget exceeded |
| `workbook_query_async_required` | `precondition_failed` | Exact table query exceeds interactive bounds; call `workbooks.table_query_jobs.request.v1`; no Job, work or artifact was created |
| `workbook_render_async_required` | `precondition_failed` | Exact render exceeds interactive bounds; call `workbooks.render_jobs.request.v1`; no Job, work or artifact was created |
| `workbook_integrity_failure` | `integrity_failure` | Revision/axis/reference/persisted model is internally inconsistent |
| `workbook_translation_loss` | `precondition_failed` | Strict import/export cannot preserve requested semantics; inspect loss report |

Every mutation follows current-authority, exact-scope, fresh-permit and atomic
Audit requirements. Error details never include unauthorized cells, expressions
from hidden targets, SQL, provider payloads or object URLs.

## Cross-capability relationships

- Formula evaluates Workbook-defined typed inputs and names. Workbooks remains
  authoritative for bindings, dependency versions and displayed results.
- Resolution/Knowledge/Intelligence satisfy prompt cells through the narrow
  prompt port. Inferred values are provenance-marked and excluded from source
  re-ingestion by default.
- Files supplies exact assets/import inputs and receives versioned exports.
- Knowledge acquires exact typed range/table/name projections through
  `workbooks.extract.v1`; it never reads Workbook tables directly.
- Decks/Boards can bind to an exact Workbook range/table/chart projection via
  their own consumer-owned ports; they do not import Workbooks.
- Collaboration validates stable cell/range/table/chart anchors. Translation
  handles CSV/XLSX/native packages. Agents use ordinary operations/proposals.
- Workbook Template publication and instantiation use the seven family-owned
  `workbooks.templates.*.v1` operations defined by
  [Translation and Templates](translation-and-templates.md#family-templates).

## Headless proofs and examples

```text
create workbook "Forecast" -> workbook r0, Sheet1 structure r0
set A1="Revenue", A2=decimal(100), B2=formula("A2 * 1.10")
  -> exact cell revisions and typed B2 result
concurrently set C2 and format A2 from the same projection
  -> both commit because grains/properties are independent
move row A2 by stable RowID
  -> Formula still resolves the same cell; A1 display notation may change
render range --typed-json
  -> byte-stable values, types, revisions and provenance
```

Required proofs include:

- canonical decimal/time/value encoding and typed round trips;
- sparse-grid, axis-order, name-scope, table-shape and chart-binding invariants;
- Formula/name cycles, broken references and dependency budget exhaustion;
- concurrent independent/same-cell/property/structure/table/name operations;
- copy/move overlap, relative/absolute Formula rewriting, external-reference
  policy, protected/structured crossings, derived-result invalidation,
  concurrent source/destination edits and exact replay;
- Name/Table removal under live-reference, concurrent-reference-create,
  exact-replay and stable-tombstone/no-ID-reuse cases;
- sorted-lock deadlock resistance and multi-cell atomicity under `-race` and a
  live Project Database;
- exact idempotency, crash boundaries, permit revocation and effect/Audit
  atomicity;
- stale Formula/prompt results preserve last-good data;
- typed DataBinding source substitution, stale-result fencing, removal and
  last-good preservation across source advancement;
- exact anchor validation/rebase across axis movement, deletion and
  incompatible structural change;
- malicious CSV/XLSX fixtures, zip bombs, external links and formula injection;
- deterministic JSON/CSV/extraction/chart-scene goldens;
- bounded table/render queries prove zero Job/work/artifact/idempotency writes
  and exact async-required routing; durable table-query/render request/status
  proves frozen revisions, exact replay, typed metadata, lease loss and stale
  result fencing; and
- browser-independent create/edit/query/import/export journeys through
  `taurus-lab`.

## Source grounding

- [SOL X 27 — Workbooks](https://app.notion.com/p/39ab6410e502819a9db4da4a76cd1adb)
- The original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
  defines typed cells, formulas, ranges, tables, charts, prompt cells,
  variables/lambdas, analysis and import/export. It did not provide a verified
  Spreadsheet construction.
- Omega's accepted [repository map](../architecture/repository-map.md) resolves
  the old “one Spreadsheet grid” ambiguity: the family is `workbooks`, and a
  Workbook contains Worksheets. Stable contained Worksheet identity preserves
  the useful grid semantics without a generic sheets service.
- The current [capability model](../architecture/capability-model.md),
  [persistence contract](../architecture/persistence-and-concurrency.md) and
  [D006](../decisions/README.md) require the non-Document revision protocol
  specified here.

### Nova evidence (pinned)

- Nova's
  [`internal/formula`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/formula)
  implementation and generated Product-contract discipline are reusable
  evidence for typed evaluation and versioned transport boundaries.
  The audited Nova tree at
  [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
  has no canonical Workbook/Worksheet backend; its
  [`resource` registry](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/resource)
  composes only a legacy Document family reference. Workbooks is therefore a
  new Omega contract, not a claim of Nova compatibility or completed behavior.
