---
title: "Work Packet — Ω-036 — Implement Spreadsheet XLSX import/export and PDF export"
notion_page_id: "3acb6410e50281778861da73b4250b99"
notion_url: "https://app.notion.com/3acb6410e50281778861da73b4250b99"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:47:54Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-036 — Implement Spreadsheet XLSX import/export and PDF export

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

