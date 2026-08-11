---
title: "Execute Ω-021 — Implement the Spreadsheet aggregate, operations, and persistence"
packet_id: "Ω-021"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-001, Ω-010, Ω-011, Ω-015, Ω-020"
source_mirror: "docs/current-docs/notion/work-packets/omega-021-implement-the-spreadsheet-aggregate-operations-and-persistence.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-021 — Implement the Spreadsheet aggregate, operations, and persistence

## Mission

`spreadsheet` becomes a first-class Taurus Resource backed by a revisioned, sparse, stable-ID aggregate. The resource is called Spreadsheet, not Workbook. It may contain ordered sheets. Rows and columns have stable IDs; cells are addressed by their stable row/column pair; positional A1 notation is a view and input syntax, never canonical identity. Every mutation is a typed operation in an idempotent ChangeSet committed with base-revision compare-and-swap. The implementation supports collaborative edits, history, bounded grid reads, and later formula, overlay, template, ingestion, and export adapters.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-010, Ω-011, Ω-015, Ω-020**.

Source dependency statement: Ω-001, Ω-010, Ω-011, Ω-015, Ω-020.

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
- `docs/current-docs/notion/work-packets/omega-021-implement-the-spreadsheet-aggregate-operations-and-persistence.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/formula` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/dispatch.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-021-implement-the-spreadsheet-aggregate-operations-and-persistence.md`

<callout icon="📖" color="blue_bg">
	**Exact-read family requirement.** Register Spreadsheet with Ω-015's readable-family contract. Stable Resource ID remains canonical; named text representations such as `spreadsheet-grid-tsv/v1` and `spreadsheet-formula-source/v1` are version/revision-bound, bounded, and map returned rows/cells/ranges back to stable cell addresses. Resource reading must not require a Structured-lattice descriptor or Knowledge admission.
</callout>
**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-001, Ω-010, Ω-011, Ω-015, Ω-020  
**Unblocks:** Ω-022, Ω-027, Ω-029, Ω-031, Ω-036
## Outcome
`spreadsheet` becomes a first-class Taurus Resource backed by a revisioned,
sparse, stable-ID aggregate. The resource is called Spreadsheet, not Workbook.
It may contain ordered sheets. Rows and columns have stable IDs; cells are
addressed by their stable row/column pair; positional A1 notation is a view and
input syntax, never canonical identity.
Every mutation is a typed operation in an idempotent ChangeSet committed with
base-revision compare-and-swap. The implementation supports collaborative edits,
history, bounded grid reads, and later formula, overlay, template, ingestion,
and export adapters.
## Current evidence
- `resource.KindSpreadsheet` exists, but wiring registers only Document and
	Connector families.
- There is no Spreadsheet capability, table family, route, Resource adapter,
	history adapter, or editor operation surface.
- The existing Document ChangeSet/idempotency/revision model is the proven Omega
	concurrency pattern and should be adapted, not imported across capabilities.
- Formula and named-value capabilities exist, but no Spreadsheet binds cells to
	them.
## Before and after
```plain text
Before
resource.KindSpreadsheet (enum only)

After
core/capability/spreadsheet/
  model.go operations.go apply.go validate.go
  service.go store.go history.go projection.go ports.go errors.go
core/handlers/spreadsheet/
core/platform/storage/sqlite/sqlite_spreadsheet.go
core/wiring/spreadsheet_*.go
dev-test/spreadsheets/
```
## Scope
- Aggregate, stable identity, operations, validation, persistence, history.
- Sparse cell storage in the canonical snapshot.
- Sheet, row, column, cell, merge, and basic style mutations.
- Descriptor/manifests and bounded rectangular reads.
- Resource family and transport integration.
- Agent-safe internal operation port.
## Non-goals
- Formula execution, charts/images/overlays, and templates are Ω-022.
- XLSX/PDF interchange is Ω-036.
- Structured-data descriptor ingestion is Ω-029.
- No macro/executable content, legacy XLS, or external grid engine.
- No frontend implementation.
## Governing invariants
1. Spreadsheet, Sheet, Row, and Column IDs are stable.
2. Sheet position, row position, column position, and A1 coordinates are derived.
3. A cell's canonical key is `(sheet_id, row_id, column_id)`.
4. The grid is sparse: an absent cell means the defined blank/default state.
5. One ChangeSet moves the aggregate from exactly revision N to N+1.
6. Reusing an idempotency key with a different payload is a conflict.
7. Operations either apply completely or leave the aggregate unchanged.
8. Merges cannot overlap; deleting their anchors follows a documented,
	deterministic rule.
9. Limits are typed and checked before unbounded allocation.
10. Store correctness is revision CAS, not the in-process serial lock.
## Core model
```go
type Spreadsheet struct {
    ID            string
    ProjectID     string
    Name          string
    Revision      int64
    SchemaVersion int
    Sheets        []Sheet
    Settings      SpreadsheetSettings
    CreatedAt     time.Time
    UpdatedAt     time.Time
}

type Sheet struct {
    ID        string
    Name      string
    Rows      []Row
    Columns   []Column
    Cells     map[CellKey]Cell
    Merges    []Merge
    Frozen    FrozenPanes
    Hidden    bool
}

type CellKey struct {
    RowID    string
    ColumnID string
}

type Cell struct {
    Input  CellInput
    Style  StyleRef
    Note   string
    Locked bool
}

type CellInput struct {
    Kind    string // blank | text | number | decimal | boolean | date | formula
    Lexeme  string // exact entered representation
    Formula string // formula source when kind=formula
}
```
Decimal and date values must preserve exact lexical/source meaning. Do not
coerce all numbers to `float64`.
Representative operations:
```go
type Operation interface{ spreadsheetOperation() }

type AddSheet struct{ SheetID, Name string; Position int }
type MoveSheet struct{ SheetID string; Position int }
type RenameSheet struct{ SheetID, Name string }
type DeleteSheet struct{ SheetID string }
type InsertRows struct{ SheetID string; BeforeRowID string; Rows []RowSpec }
type DeleteRows struct{ SheetID string; RowIDs []string }
type InsertColumns struct{ SheetID string; BeforeColumnID string; Columns []ColumnSpec }
type DeleteColumns struct{ SheetID string; ColumnIDs []string }
type SetCells struct{ SheetID string; Values []CellWrite }
type ClearCells struct{ SheetID string; Range StableRange }
type SetMerge struct{ SheetID string; Range StableRange }
type RemoveMerge struct{ SheetID, MergeID string }
type SetSheetProperties struct{ SheetID string; Patch SheetPatch }

type ChangeSet struct {
    ID             string
    SpreadsheetID  string
    BaseRevision   int64
    Operations     []Operation
    Actor          Actor
    IdempotencyKey string
    CreatedAt      time.Time
}
```
## Persistence
Keep canonical state and append-only changes/history separate:
```sql
CREATE TABLE spreadsheets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_spreadsheets_project ON spreadsheets(project_id, updated_at);

CREATE TABLE spreadsheet_changesets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  base_revision INTEGER NOT NULL,
  applied_revision INTEGER NOT NULL,
  actor_json TEXT NOT NULL,
  operations_json TEXT NOT NULL,
  inverse_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
);

CREATE TABLE spreadsheet_submissions (
  project_id TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  changeset_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  PRIMARY KEY(project_id, spreadsheet_id, idempotency_key)
);
```
Snapshots may later be decomposed for performance, but the store contract must
make that a persistence choice. Canonical JSON has explicit schema versions,
stable ordering, and bounded size.
## HTTP surface
```javascript
POST   /spreadsheets
GET    /spreadsheets
GET    /spreadsheets/:spreadsheetID
PATCH  /spreadsheets/:spreadsheetID
DELETE /spreadsheets/:spreadsheetID
POST   /spreadsheets/:spreadsheetID/changes
GET    /spreadsheets/:spreadsheetID/history
GET    /spreadsheets/:spreadsheetID/history/:changeSetID
POST   /spreadsheets/:spreadsheetID/changes/:changeSetID/undo
POST   /spreadsheets/:spreadsheetID/changes/:changeSetID/redo
GET    /spreadsheets/:spreadsheetID/descriptor
GET    /spreadsheets/:spreadsheetID/sheets
GET    /spreadsheets/:spreadsheetID/sheets/:sheetID/range
```
Range reads accept bounded positional selectors and return stable row/column IDs
plus the aggregate revision.
## Ordered implementation tasks
1. Freeze model, limits, canonical JSON, operation union, and error codes.
2. Implement pure validation/apply/inverse logic with property tests.
3. Implement SQLite CAS, idempotency, history, and store-contract suite.
4. Implement lifecycle, duplicate, and Resource-family adapter.
5. Add descriptor, sheet manifest, and bounded range projections.
6. Add routes, centralized Spreadsheet access guard, operation-mode entries,
	body/page limits, and wire contracts.
7. Add history/undo/redo adapter for Ω-027.
8. Add an agent operation port that accepts typed operations, never arbitrary
	SQL/A1 mutation strings.
9. Add live backend suites and architecture companions.
## Security, concurrency, jobs, and observability
- Apply per-resource access to every direct and indirect path.
- Classify append/undo/redo as serial per Spreadsheet ID while retaining CAS as
	the correctness boundary.
- Validate operation count, range area, inserted rows/columns, cell lexeme,
	formula length, style count, snapshot size, and response page size.
- Reject user-supplied IDs that collide with existing aggregate objects.
- Activity/History records actor, operation types, object count, and revision,
	not cell contents.
- Emit CAS conflicts, idempotent replays, changed-cell counts, apply/store
	duration, snapshot bytes, sparse occupancy, and projection latency.
## Verification
- Pure apply/inverse and randomized operation-sequence properties.
- Stable IDs across insert/delete/move and A1 reprojection.
- Merge overlap/deletion edge cases and exact decimal/date round trips.
- Store CAS, idempotency, crash rollback, migration, and corruption tests.
- Transport authorization, body/range limits, undisclosing not-found behavior.
- Race tests for same-resource writes and independent-resource parallelism.
- Load tests for sparse large grids and bounded range reads.
- Backend E2E without Alpha: create, edit, conflict/retry, history, undo/redo,
	reload, and catalog listing.
## Migration and rollback
New tables and routes are additive. Keep the Resource kind unavailable until its
store and conformance suite are green, then register the family in wiring.
Rollback unregisters the family and parks tables; no Document data changes.
## Completion evidence
- Resource-family conformance, store, race, load, transport, and live suites
	pass.
- OpenAPI/reference payloads and operation schemas are published.
- A clean database and restart preserve the full aggregate and history.
- No non-FOSS library is introduced.
## Sources
- Taurus Yesod Model — Spreadsheet capability
- Spreadsheet Context/Inspector Panel pages
- `core/capability/document` ChangeSet and history patterns
- `core/capability/resource`
- `core/capability/formula`
- `core/transport/dispatch.go`
---

