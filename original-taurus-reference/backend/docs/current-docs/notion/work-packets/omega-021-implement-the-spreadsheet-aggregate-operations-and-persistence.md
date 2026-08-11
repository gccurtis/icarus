---
title: "Work Packet — Ω-021 — Implement the Spreadsheet aggregate, operations, and persistence"
notion_page_id: "3acb6410e5028101ad28de36426d1403"
notion_url: "https://app.notion.com/3acb6410e5028101ad28de36426d1403"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:20Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-021 — Implement the Spreadsheet aggregate, operations, and persistence

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

