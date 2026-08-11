---
title: "Execute Ω-036 — Implement Spreadsheet XLSX import/export and PDF export"
packet_id: "Ω-036"
status: "ready-for-execution"
wave: "Wave 4 — Complete conversion"
depends_on: "Ω-021, Ω-022, Ω-034"
source_mirror: "docs/current-docs/notion/work-packets/omega-036-implement-spreadsheet-xlsx-import-export-and-pdf-export.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-036 — Implement Spreadsheet XLSX import/export and PDF export

## Mission

Omega imports each supported visible XLSX worksheet as an independent Taurus Spreadsheet, exports one exact Spreadsheet revision as one-sheet XLSX, and exports that revision as a deterministic paginated PDF. The implementation preserves the single-grid Spreadsheet model, formula safety, stable IDs, overlays, atomic publication, and explicit loss diagnostics.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-021, Ω-022, Ω-034**.

Source dependency statement: Ω-021, Ω-022, Ω-034, Formula, File/Object, and Ω-042 production
storage

Later integration or re-certification references in that source section: **Ω-042**. These are not start blockers; implement the packet against its declared ports and leave the production adapter or downstream certification to those later packets.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-036-implement-spreadsheet-xlsx-import-export-and-pdf-export.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/design-multi-lattice-ingestion-architecture--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-spreadsheet-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-spreadsheet-to-xlsx--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-xlsx-to-spreadsheet--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-spreadsheet-capability-and-runtime-contract--3abb6410e502.md`

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-036-implement-spreadsheet-xlsx-import-export-and-pdf-export.md`

### Outcome
Omega imports each supported visible XLSX worksheet as an independent Taurus
Spreadsheet, exports one exact Spreadsheet revision as one-sheet XLSX, and
exports that revision as a deterministic paginated PDF. The implementation
preserves the single-grid Spreadsheet model, formula safety, stable IDs,
overlays, atomic publication, and explicit loss diagnostics.
### Reviewed evidence and library decision
The authorities are
[Import - XLSX to Spreadsheet](https://app.notion.com/p/3acb6410e5028182b958fcd202736a6c),
[Export - Spreadsheet to XLSX](https://app.notion.com/p/3acb6410e50281bf9ebed3037d6cb114),
[Export - Spreadsheet to PDF](https://app.notion.com/p/3acb6410e50281ffb153c8565943f650),
and [Model — Spreadsheet Capability & Runtime Contract](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe).
- XLSX import: Excelize 2.11.0, BSD-3-Clause, in an isolated Go worker.
- XLSX export: XlsxWriter 3.2.9, BSD-2-Clause, in an isolated Python worker;
	validate the package with Excelize and shared OOXML policy.
- PDF export: WeasyPrint 69.0 plus qpdf 12.3.x in the shared Python PDF worker.
No commercial fallback, Microsoft Excel process, legacy `.xls`, macro-enabled
format, or hosted converter is allowed.
### Scope and non-goals
Import accepts `.xlsx` only. Each visible ordinary worksheet becomes one new
Spreadsheet. Hidden/very-hidden, chart, and dialog sheets are skipped with
diagnostics. Supported literals, safe same-sheet formulas, formatting, row/
column geometry, names that can be represented locally, validations/rules,
frozen panes, and pictures are mapped best effort. Pictures become overlays.
Charts, comments, table semantics, protection, print layout, unsupported
merges, and cross-sheet behavior are dropped or materialized.
Export emits one visible worksheet because Taurus Spreadsheet is not a
Workbook. It writes values, supported formulas with accepted cached results,
styles, row/column geometry, names, validations/rules where honest, frozen
axes, and supported image/chart overlays. PDF is a static print artifact using
Omega’s deterministic row/column tiling, repeated frozen axes, margins,
headers/footers, scale policy, and explicit page breaks.
There is no merge into an existing Spreadsheet, formula or macro execution,
workbook-tab model, legacy XLS, VBA, external link refresh, live data-source
query in a worker, or perfect Excel round-trip.
### Invariants
1. One Spreadsheet is one sparse grid. Source worksheet identity is provenance,
	not a nested `SheetID`.
2. Every imported resource receives fresh stable Row/Column/Cell/Overlay IDs;
	source A1 coordinates are locators only.
3. Each worksheet commits independently and atomically. A multi-sheet import
	may have a bounded partial-success receipt, but no worksheet is partially
	visible.
4. Formula text is parsed through Taurus Formula. Supported same-sheet formulas
	remain formulas. Unsupported/cross-sheet formulas materialize the safe cached
	value or fail that cell with a diagnostic; they are never executed.
5. The worker cannot assign canonical IDs, use NaN/Inf geometry, or create a
	range outside declared limits.
6. Export resolves accepted computed/display state at an exact revision.
	Failed-current/last-good output is explicit in diagnostics.
7. PDF page planning belongs to Omega. WeasyPrint paints fixed tiles and may
	not choose different row/column membership.
### Target paths, protocol, and routes
```plain text
core/capability/spreadsheet/interchange/
  import.go xlsx_snapshot.go pdf_snapshot.go diagnostics.go
core/integration/office/xlsx/import/
core/integration/office/xlsx/export/
core/integration/pdf/spreadsheet/
workers/office-xlsx-go/import/
workers/office-xlsx-py/export/
workers/office-py/pdf/
tests/fixtures/office/xlsx-import/
tests/fixtures/office/xlsx-export/
tests/fixtures/pdf/spreadsheet/
```
The import worker writes `result.json`, bounded worksheet metadata JSON,
row-major NDJSON cell chunks, and declared image assets. `result.json` is last.
```go
type WorksheetDraftRef struct {
    SourceName      string
    SourceOrdinal   int
    Visibility      string
    MetadataURI     string
    CellChunkURIs   []string
    AssetURIs       []string
    Counts          WorksheetCounts
}

type SpreadsheetImportReceipt struct {
    SourceFileID string
    SourceHash   string
    Worksheets  []WorksheetImportStatus
    Diagnostics []Diagnostic
}

type SpreadsheetSnapshotReader interface {
    ResolveXLSX(ctx context.Context, actor Actor, id string, rev uint64) (XLSXSnapshotV1, error)
    ResolvePDF(ctx context.Context, actor Actor, id string, rev uint64) (SpreadsheetPDFSnapshotV1, error)
}
```
```plain text
POST /projects/{projectID}/spreadsheet-imports
GET  /projects/{projectID}/spreadsheet-imports/{receiptID}
POST /projects/{projectID}/spreadsheets/{spreadsheetID}/exports
GET  /projects/{projectID}/exports/{receiptID}
GET  /projects/{projectID}/exports/{receiptID}/artifact
```
The parent validates every NDJSON record, manifest count, coordinate, lexeme,
formula, style, merge, dimension, and asset before proposing a Base. Stable IDs
derive deterministically from source hash, worksheet identity, coordinate, and
kind for replay within the same receipt; they are not supplied by the worker.
### Mapping rules
Use Excelize raw-cell access and row iteration under limits. Preserve exact
strings and numerics where Taurus’ value algebra permits. Dates carry source
serial/system provenance and become typed values only under a deterministic
policy. A merged range contributes its top-left value once; unsupported merge
layout is diagnosed. Centralize width/height conversion so approximation is
consistent and testable.
XLSX export maps stable axes to one worksheet, uses accepted display/cached
formula values, and emits formulas only through the canonical translator.
Images use bounded media; charts use supported static data already resolved by
Spreadsheet and never ask a provider from the worker.
`SpreadsheetPDFSnapshotV1` declares page size, margins, scale, row/column tiles,
repeated frozen axes, ordered cells, resolved styles, overlay paint objects,
headers/footers, and page labels. Wide/tall data produces deterministic tiles;
no content is silently shrunk below a configured legibility floor.
### Sequential tasks
1. Freeze XLSX import draft/NDJSON, export snapshot, PDF tile snapshot, mapping
	versions, diagnostics, and hard limits.
2. Implement XLSX package validation and isolated Excelize parsing.
3. Implement per-worksheet planning, sparse traversal, values, formula
	translation/materialization, geometry, styles, rules, names, pictures, and
	bounded diagnostics.
4. Commit each accepted worksheet as one Spreadsheet Base plus Resource,
	provenance, Activity, and receipt records.
5. Implement exact-revision XLSX snapshot and XlsxWriter emission; add Excelize
	package reopening and Taurus policy validation.
6. Implement deterministic PDF page planning, WeasyPrint paint output, qpdf
	validation, and visual fixtures.
7. Add API/status/download, retention, cancellation, and reaping.
8. Profile maximum rows/cells/styles/assets and publish the fidelity/loss matrix.
### Security, concurrency, idempotency, and observability
Apply Ω-034. Reject `.xls`, `.xlsm`, `.xlam`, `.xltm`, encryption, macros,
external active content, traversal, duplicate package parts, DTD/entity
behavior, ZIP expansion, excessive shared strings/styles/formulas/rows/cells/
media, and invalid dimensions. Excelize runs out of process even though it is
Go; isolation exists for hostile parsing and bounded cancellation.
The import fingerprint includes source hash, worksheet-selection policy,
Excelize/contract/mapping versions, actor, Project, and client key. Concurrent
replays return the same per-sheet statuses and IDs. Export uses exact revision,
normalized options, formula registry version, and mapping versions. Commit
uses a per-receipt transaction for shared metadata and one atomic resource
transaction per worksheet, producing explicit partial batch status.
Metrics include worksheets planned/imported/skipped/failed, rows/cells/
formulas/styles/names/rules/images, cross-sheet materializations, chart/merge
drops, NDJSON bytes, page tiles, output size, validation time, and worker
resource peaks. Values and formula bodies never enter logs.
### Tests and failure drills
- Visible/hidden/chart/dialog worksheet split and no Workbook aggregate.
- Exact lexical value, date-system, sparse-cell, large shared-string, geometry,
	frozen-axis, validation, style, name, picture-overlay, and merge fixtures.
- Supported same-sheet formula translation and cached materialization for
	cross-sheet/unsupported formulas; no worker formula execution.
- XLSX output reopens with Excelize and office-compatible QA; one visible
	worksheet, correct cached values, supported overlays, and no active/external
	content.
- PDF tiles preserve page plan, repeated frozen axes, ordering, styles,
	overlays, and legibility constraints.
- ZIP bomb, allocation, malformed XML, huge dimensions/style explosion,
	corrupted image, worker crash, truncated chunk, count/digest mismatch,
	duplicate import, partial worksheet failure, object outage, cancellation,
	revocation, and restart drills.
- Store/race tests prove no partial worksheet and no duplicate Resource under
	at-least-once delivery.
### Migration, rollback, and completion evidence
No existing Spreadsheet is transformed. Routes launch behind format gates.
Legacy XLS is rejected with a typed unsupported-format response. Rollback
disables registrations and drains jobs; completed independent Spreadsheets and
artifacts remain canonical/readable. Mapping upgrades change the fingerprint
and do not reinterpret old receipts.
Completion evidence includes backend-only import/export/PDF demonstrations,
golden and hostile corpora, bounded scale profile, per-feature fidelity matrix,
license/SBOM/no-egress proof, exact-replay proof, and restore of a multi-sheet
receipt with its created Resources and object artifacts.
### Dependencies
Depends on Ω-021, Ω-022, Ω-034, Formula, File/Object, and Ω-042 production
storage. Blocks the Spreadsheet interchange portion of Ω-044.
### Linked sources
- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)

