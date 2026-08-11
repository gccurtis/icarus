---
title: "Work Packet — Ω-022 — Complete Spreadsheet computation, overlays, templates, and API integration"
notion_page_id: "3acb6410e50281edb7f7d5bd3c7d90a8"
notion_url: "https://app.notion.com/3acb6410e50281edb7f7d5bd3c7d90a8"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:20Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-022 — Complete Spreadsheet computation, overlays, templates, and API integration

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-020, Ω-021, Ω-014, Ω-015  
**Unblocks:** Ω-027, Ω-029, Ω-031, Ω-036
## Outcome
Spreadsheet becomes a complete Project editor backend: deterministic formula
calculation, dependency tracking, named values/tables/functions, chart and image
overlays, template capture/materialization, bounded projections, agent
operations, and all public endpoints required by Alpha.
## Current evidence
Omega already has a Formula capability and Project-scoped name manager, but no
cell dependency graph or Spreadsheet integration. Files can hold immutable
bytes, but images have no grid overlay model. No Spreadsheet family/routes
exist at the reviewed baseline.
## Before and after
```plain text
Spreadsheet aggregate from Ω-021
  + core/capability/spreadsheet/calc/
  + overlays.go and chart.go
  + template_family.go
  + projection tiles/ranges
  + recalc job + live events
  + complete transport/resource/agent integration
```
## Scope
- Formula parse/bind/evaluate and dependency graph.
- Cached calculation generation and typed errors.
- Range names and existing Formula name-manager integration through ports.
- Images, charts, shapes, and text overlays anchored to stable ranges or sheet
	coordinates.
- Whole-Spreadsheet and single-sheet templates.
- Complete HTTP, Resource, History, Agent, Activity, and live-delivery paths.
## Non-goals
- Excel compatibility beyond the Taurus formula contract.
- VBA/macros, external workbook links, arbitrary code, or volatile network
	functions.
- Spreadsheet interchange/PDF; Ω-036.
- Collaborative cursor UI.
## Governing invariants
1. Calculation is a derived generation for one committed content revision.
2. Formula references bind to stable row/column/name identities.
3. Dependency cycles and evaluation failures are values with typed diagnostics,
	not panics or partial writes.
4. A stale calculation generation never presents as current.
5. Overlays have stable IDs and explicit z-order.
6. Overlay anchors survive row/column insertion through stable IDs.
7. Image bytes remain in File/object storage; the aggregate holds authorized
	immutable references.
8. Chart data references exact stable ranges and chart rendering never executes
	user code.
9. Template insertion remaps all object and reference IDs atomically.
## Computation contract
```go
type CalculationState struct {
    SpreadsheetID   string
    ContentRevision int64
    Generation      int64
    Status          string // pending | running | complete | failed
    Values          map[CellRef]ComputedValue
    Errors          map[CellRef]CalculationError
    DependencyHash  string
    CompletedAt     time.Time
}

type Calculator interface {
    Plan(snapshot Spreadsheet, changed []StableRef) (CalculationPlan, error)
    Evaluate(ctx context.Context, snapshot Spreadsheet, plan CalculationPlan) (CalculationState, error)
}
```
On commit, enqueue a coalesced `spreadsheet.recalculate` job keyed by
Spreadsheet ID. A newer revision supersedes an older pending target. Publishing
uses CAS on `(spreadsheet_id, content_revision)`; an old job cannot overwrite a
new result.
Functions that depend on time or randomness are absent in V1 unless their
inputs are explicitly captured in the ChangeSet so replay remains deterministic.
## Overlay model
```go
type Overlay struct {
    ID       string
    SheetID  string
    Kind     string // image | chart | shape | text
    Anchor   OverlayAnchor
    Geometry Geometry
    ZIndex   int
    Content  json.RawMessage
    Style    StyleRef
}

type OverlayAnchor struct {
    Mode       string // range | sheet
    StableRange *StableRange
    OffsetX    float64
    OffsetY    float64
}

type ChartSpec struct {
    ChartType string
    Series    []ChartSeries
    Title     string
    Legend    LegendSpec
    Axes      []AxisSpec
}
```
Charts are overlays rather than cells. They remain visually familiar while
preserving a clean grid model.
## Persistence additions
```sql
CREATE TABLE spreadsheet_calculations (
  spreadsheet_id TEXT NOT NULL,
  content_revision INTEGER NOT NULL,
  generation INTEGER NOT NULL,
  status TEXT NOT NULL,
  result_blob BLOB,
  dependency_blob BLOB,
  error_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(spreadsheet_id, content_revision)
);
```
Overlays may live in the canonical snapshot initially. If bounded reads require
decomposition, use a table keyed by Project/Spreadsheet/Sheet/Overlay and keep
the aggregate revision as publication boundary.
## HTTP additions
```javascript
GET  /spreadsheets/:id/calculation
POST /spreadsheets/:id/recalculate
GET  /spreadsheets/:id/sheets/:sheetID/tiles
GET  /spreadsheets/:id/sheets/:sheetID/overlays
POST /spreadsheets/:id/templates
POST /templates/:templateID/materializations
GET  /spreadsheets/:id/events?after=:sequence
```
The existing `/changes` operation union adds overlay operations. Range/tile
responses include `contentRevision`, `calculationGeneration`, and
`calculationStatus`.
## Ordered implementation tasks
1. Bind Formula values/references to stable Spreadsheet identities through
	ports; add a deterministic calculation oracle.
2. Implement dependency graph, cycle reporting, incremental planning, and
	calculation storage.
3. Add coalesced recalc jobs, stale-job rejection, retries, and event emission.
4. Add overlay model/operations, File authorization, chart schema, and SVG-safe
	render-neutral scene output.
5. Implement Template-family capture/materialize for whole Spreadsheet and one
	sheet inserted as a new sheet.
6. Complete bounded tile/range/overlay projections and locate endpoints.
7. Register every route/operation, Resource/Activity/History/Agent adapters, and
	access guard.
8. Build full Alpha-request contract fixtures without implementing Alpha.
9. Add load/live suites, companions, and dependency/license record.
## Security, concurrency, jobs, and observability
- Formula evaluator has no filesystem, network, process, clock, or reflection
	access.
- Reject external links and unsupported functions with typed errors.
- Verify File and range access when reading overlays and when materializing.
- Recalculation jobs are Project-scoped, coalesced, retry-bounded, and
	idempotently published.
- Live events contain object IDs/status/revisions, not restricted cell contents
	unless the subscriber is authorized for the resource.
- Emit formula/cell counts, dependency edges, invalidations, cycles, job lag,
	duration, cache hit, overlay count, tile bytes, and stale publish rejection.
## Verification
- Golden formula semantics, exact decimals/dates, names, ranges, errors, cycles.
- Incremental calculation equals full recalculation.
- Concurrent edit/recalc cannot publish stale values.
- Overlay anchor survival across structural edits and template remapping.
- Malicious formulas, chart specs, SVG text, and inaccessible File references
	fail closed.
- Load: large sparse grid, deep dependency chain, wide fan-out, many overlays,
	bounded tiles.
- Backend E2E: create model, calculate, chart, attach image, save/apply template,
	reload, conflict, undo/redo, stream status.
## Migration and rollback
Add calculation tables/jobs and overlay schema version behind capability
compatibility. Old snapshots read with empty overlays and pending calculation.
Rollback ignores derived calculation rows and rejects newer snapshot schema
unless a down-converter is proven; take a pre-upgrade backup.
## Completion evidence
- Spreadsheet capability conformance matrix is entirely green.
- Alpha backend-request fixtures pass.
- Full calculation/overlay/template E2E and restart/recovery proof are attached.
- Dependency SBOM/license entry contains only approved FOSS components.
## Sources
- Taurus Yesod Model — Spreadsheet capability
- Spreadsheet Context/Inspector Panel pages
- Taurus Yesod template contract
- `core/capability/formula`
- `core/capability/file`
- `core/platform/job`
---

