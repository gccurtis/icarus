---
title: "Execute Ω-022 — Complete Spreadsheet computation, overlays, templates, and API integration"
packet_id: "Ω-022"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-014, Ω-015, Ω-020, Ω-021"
source_mirror: "docs/current-docs/notion/work-packets/omega-022-complete-spreadsheet-computation-overlays-templates-and-api-integration.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-022 — Complete Spreadsheet computation, overlays, templates, and API integration

## Mission

Spreadsheet becomes a complete Project editor backend: deterministic formula calculation, dependency tracking, named values/tables/functions, chart and image overlays, template capture/materialization, bounded projections, agent operations, and all public endpoints required by Alpha.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-014, Ω-015, Ω-020, Ω-021**.

Source dependency statement: Ω-020, Ω-021, Ω-014, Ω-015.

No later-packet integration gate was detected in the source dependency statement.

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
- `docs/current-docs/notion/work-packets/omega-022-complete-spreadsheet-computation-overlays-templates-and-api-integration.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/file` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/formula` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/job` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-022-complete-spreadsheet-computation-overlays-templates-and-api-integration.md`

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

