# Connector resource kind (Slice A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `connector` resource kind — a persisted, project-scoped resource carrying a provider *subkind* (first: `local-folder`) and a provider config (a folder path) — that appears in the unified resource catalog and is fully CRUD-able, without yet syncing anything into the lattice.

**Architecture:** A new `core/capability/connector` capability (domain + `Store` port + in-memory and SQLite stores) owns connector records. A `connectorResourceFamily` adapter in `core/wiring` plugs it into the existing `resource.Resources` catalog (mirroring `documentResourceFamily`). `KindConnector` joins the closed resource vocabulary. Connector-specific create/configure/read routes live in a new `core/handlers/connector` handler, because the generic `POST /resources {kind,name}` cannot carry a subkind or folder path.

**Tech Stack:** Go, Echo transport, pure-Go SQLite (`modernc.org/sqlite`), ports-and-adapters. Everything project-scoped.

## Global Constraints

- Capabilities never import each other; cross-capability composition lives only in `core/handlers/*` and `core/wiring`.
- Every non-test `core/**/*.go` file gets a verbatim companion `FILE.go.md` (concatenated ```go blocks reproduce the source exactly, tabs preserved), committed in the same change.
- Run `gofmt` on new/changed Go **before** regenerating companions.
- One `docs/records/NNNN-*.md` change record for the increment (next free number).
- TDD: a failing test precedes every piece of production code.
- No secrets; no external network. The `local-folder` provider is a local filesystem path only.

---

## File structure

- `core/capability/resource/resource.go` (modify) — add `KindConnector` to the `Kind` consts and `knownKinds`.
- `core/capability/connector/connector.go` (create) — domain: `Connector`, `SubKind`, validation, errors, the `Connectors` service, and the `Store` port.
- `core/capability/connector/memory.go` (create) — in-memory `Store` for tests and non-persistent runs.
- `core/capability/connector/connector_test.go` (create) — service + validation unit tests over the memory store.
- `core/platform/storage/sqlite/sqlite.go` (modify) — `connectors` table migration + `Store` methods.
- `core/platform/storage/sqlite/sqlite_test.go` (modify) — persistence + restart test.
- `core/wiring/resource_connector.go` (create) — `connectorResourceFamily` adapter.
- `core/wiring/wiring.go` (modify) — build `connector.New(store)`, register the family, pass to transport `Options`.
- `core/handlers/connector/connector.go` (create) — connector-specific create/configure/get handlers.
- `core/transport/transport.go` (modify) — `Options.Connectors` + route registration (project-scoped).
- `dev-test/connectors/run.sh` + `dev-test/connectors/manual.md` (create) — end-to-end suite (no model; always runs).
- `docs/records/0088-connector-resource-kind.md` (create) — the change record.

Each `*.go` above (except `_test.go`) needs its paired `*.go.md`.

---

## Task A1: Add `KindConnector` to the resource vocabulary

**Files:**
- Modify: `core/capability/resource/resource.go:39-50`
- Test: `core/capability/resource/resource_test.go`

**Interfaces:**
- Produces: `resource.KindConnector Kind = "connector"`, admitted by `ParseKind` and registrable via `NewWithAttributes`.

- [ ] **Step 1: Write the failing test**

Add to `core/capability/resource/resource_test.go`:

```go
func TestParseKindAcceptsConnector(t *testing.T) {
	kind, err := ParseKind("connector")
	if err != nil {
		t.Fatalf("ParseKind(connector): %v", err)
	}
	if kind != KindConnector {
		t.Fatalf("got %q, want %q", kind, KindConnector)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/resource/ -run TestParseKindAcceptsConnector`
Expected: FAIL — `undefined: KindConnector`.

- [ ] **Step 3: Add the kind**

In `core/capability/resource/resource.go`, extend the const block and `knownKinds`:

```go
const (
	KindDocument    Kind = "document"
	KindSpreadsheet Kind = "spreadsheet"
	KindSlides      Kind = "slides"
	KindChat        Kind = "chat"
	KindGeneral     Kind = "general"
	KindConnector   Kind = "connector"
)

var knownKinds = map[Kind]bool{
	KindDocument: true, KindSpreadsheet: true, KindSlides: true,
	KindChat: true, KindGeneral: true, KindConnector: true,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/resource/`
Expected: PASS (all resource tests green).

- [ ] **Step 5: Update the companion**

Update `core/capability/resource/resource.go.md` so the modified const/`knownKinds` blocks reproduce the new source verbatim.

- [ ] **Step 6: Commit**

```bash
git add core/capability/resource/resource.go core/capability/resource/resource.go.md core/capability/resource/resource_test.go
git commit -m "Add connector to the resource kind vocabulary"
```

---

## Task A2: Connector domain, validation, and the Store port

**Files:**
- Create: `core/capability/connector/connector.go`
- Test: `core/capability/connector/connector_test.go`

**Interfaces:**
- Consumes: nothing from other capabilities.
- Produces:
  - `type SubKind string`; `const SubKindLocalFolder SubKind = "local-folder"`.
  - `type Connector struct { ID, ProjectID, Name string; SubKind SubKind; Path string; CreatorID string; CreatedAt, UpdatedAt time.Time }`.
  - `type Actor struct { ID, Name string }`.
  - Errors: `ErrNotFound`, `ErrInvalidName`, `ErrInvalidSubKind`, `ErrInvalidPath`.
  - `type Store interface` (see Step 3).
  - `type Connectors struct{}` with `func New(store Store) *Connectors`.

- [ ] **Step 1: Write the failing test**

Create `core/capability/connector/connector_test.go`:

```go
package connector

import (
	"testing"
	"time"
)

func newTestConnectors() *Connectors { return New(NewMemoryStore(func() time.Time { return time.Unix(0, 0).UTC() })) }

func TestCreateAssignsIDAndDefaults(t *testing.T) {
	c := newTestConnectors()
	got, err := c.Create("proj1", Actor{ID: "u1", Name: "Ada"}, "Sales drive", SubKindLocalFolder)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.ID == "" {
		t.Fatal("expected an assigned ID")
	}
	if got.Name != "Sales drive" || got.SubKind != SubKindLocalFolder || got.CreatorID != "u1" {
		t.Fatalf("unexpected connector: %+v", got)
	}
	if got.Path != "" {
		t.Fatalf("expected empty path before configure, got %q", got.Path)
	}
}

func TestCreateRejectsBadInput(t *testing.T) {
	c := newTestConnectors()
	if _, err := c.Create("proj1", Actor{ID: "u1"}, "   ", SubKindLocalFolder); err != ErrInvalidName {
		t.Fatalf("blank name: got %v, want ErrInvalidName", err)
	}
	if _, err := c.Create("proj1", Actor{ID: "u1"}, "ok", SubKind("dropbox")); err != ErrInvalidSubKind {
		t.Fatalf("bad subkind: got %v, want ErrInvalidSubKind", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/connector/`
Expected: FAIL — package/types undefined.

- [ ] **Step 3: Write minimal implementation**

Create `core/capability/connector/connector.go`:

```go
// Package connector owns external-source connector resources. A connector is a
// project-scoped resource of a provider subkind (the first is local-folder) that
// names where external content lives; a later slice syncs that content into the
// knowledge lattice. This capability owns only the connector record and its
// config; it does not read the filesystem or talk to any provider.
package connector

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const maxName = 200

// SubKind names a connector's provider. The vocabulary is closed; new providers
// (google-drive, …) are added here as they ship.
type SubKind string

const SubKindLocalFolder SubKind = "local-folder"

func validSubKind(s SubKind) bool { return s == SubKindLocalFolder }

var (
	ErrNotFound       = errors.New("connector not found")
	ErrInvalidName    = errors.New("connector name must not be empty")
	ErrInvalidSubKind = errors.New("connector subkind is not supported")
	ErrInvalidPath    = errors.New("connector path is invalid")
)

// Actor is trusted request identity.
type Actor struct {
	ID   string
	Name string
}

// Connector is a project-scoped external-source binding. Path is provider config
// (for local-folder, an absolute local directory); empty until configured.
type Connector struct {
	ID        string
	ProjectID string
	Name      string
	SubKind   SubKind
	Path      string
	CreatorID string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Store persists connector records within a project.
type Store interface {
	InsertConnector(c Connector) error
	ConnectorByID(projectID, id string) (Connector, error)
	ConnectorSummaries(projectID string) ([]Connector, error)
	UpdateConnector(c Connector) error
	DeleteConnector(projectID, id string) error
}

// Connectors is the connector service over an injected Store.
type Connectors struct {
	store Store
	now   func() time.Time
}

// New constructs the service. now defaults to time.Now when nil.
func New(store Store) *Connectors { return &Connectors{store: store, now: time.Now} }

// Create makes a new connector of the given subkind with no path yet.
func (c *Connectors) Create(projectID string, actor Actor, name string, sub SubKind) (Connector, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Connector{}, ErrInvalidName
	}
	if !validSubKind(sub) {
		return Connector{}, ErrInvalidSubKind
	}
	at := c.clock()
	rec := Connector{
		ID: newID(), ProjectID: projectID, Name: name, SubKind: sub,
		CreatorID: actor.ID, CreatedAt: at, UpdatedAt: at,
	}
	if err := c.store.InsertConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

func (c *Connectors) clock() time.Time {
	if c.now == nil {
		return time.Now().UTC()
	}
	return c.now().UTC()
}

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/connector/`
Expected: FAIL still — `NewMemoryStore` undefined. That is Task A3; proceed there, then re-run. (If you want A2 green in isolation, temporarily stub the store in the test; A3 replaces it.)

- [ ] **Step 5: Commit** (defer to end of A3 so the package compiles)

---

## Task A3: In-memory Store

**Files:**
- Create: `core/capability/connector/memory.go`
- Test: `core/capability/connector/connector_test.go` (add Get/List/Rename/Delete/Configure cases)

**Interfaces:**
- Consumes: `Store`, `Connector` from A2.
- Produces: `func NewMemoryStore(now func() time.Time) *MemoryStore` implementing `Store`; service methods `Get`, `Summaries`, `Rename`, `Delete`, `Configure` (below).

- [ ] **Step 1: Write the failing test**

Append to `connector_test.go`:

```go
func TestConfigureSetsPathAndRejectsRelative(t *testing.T) {
	c := newTestConnectors()
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	got, err := c.Configure("p", made.ID, "/data/sales")
	if err != nil {
		t.Fatalf("Configure: %v", err)
	}
	if got.Path != "/data/sales" {
		t.Fatalf("path = %q", got.Path)
	}
	if _, err := c.Configure("p", made.ID, "relative/dir"); err != ErrInvalidPath {
		t.Fatalf("relative path: got %v, want ErrInvalidPath", err)
	}
}

func TestGetRenameDeleteAndProjectIsolation(t *testing.T) {
	c := newTestConnectors()
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	if _, err := c.Get("other", made.ID); err != ErrNotFound {
		t.Fatalf("cross-project Get: got %v, want ErrNotFound", err)
	}
	renamed, err := c.Rename("p", Actor{ID: "u1"}, made.ID, "Renamed")
	if err != nil || renamed.Name != "Renamed" {
		t.Fatalf("Rename: %v %+v", err, renamed)
	}
	if err := c.Delete("p", Actor{ID: "u1"}, made.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := c.Get("p", made.ID); err != ErrNotFound {
		t.Fatalf("after delete: got %v, want ErrNotFound", err)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/capability/connector/`
Expected: FAIL — `NewMemoryStore`, `Get`, `Configure`, `Rename`, `Delete` undefined.

- [ ] **Step 3: Implement memory store + remaining service methods**

Create `core/capability/connector/memory.go`:

```go
package connector

import (
	"sync"
	"time"
)

// MemoryStore is an in-memory Store for tests and non-persistent runs.
type MemoryStore struct {
	mu    sync.Mutex
	byKey map[string]Connector // key = projectID + "\x00" + id
	now   func() time.Time
}

// NewMemoryStore returns an empty store. now is unused today but kept for parity
// with persisted stores that stamp times.
func NewMemoryStore(now func() time.Time) *MemoryStore {
	return &MemoryStore{byKey: map[string]Connector{}, now: now}
}

func key(projectID, id string) string { return projectID + "\x00" + id }

func (m *MemoryStore) InsertConnector(c Connector) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.byKey[key(c.ProjectID, c.ID)] = c
	return nil
}

func (m *MemoryStore) ConnectorByID(projectID, id string) (Connector, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.byKey[key(projectID, id)]
	if !ok {
		return Connector{}, ErrNotFound
	}
	return c, nil
}

func (m *MemoryStore) ConnectorSummaries(projectID string) ([]Connector, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Connector
	for _, c := range m.byKey {
		if c.ProjectID == projectID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *MemoryStore) UpdateConnector(c Connector) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[key(c.ProjectID, c.ID)]; !ok {
		return ErrNotFound
	}
	m.byKey[key(c.ProjectID, c.ID)] = c
	return nil
}

func (m *MemoryStore) DeleteConnector(projectID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[key(projectID, id)]; !ok {
		return ErrNotFound
	}
	delete(m.byKey, key(projectID, id))
	return nil
}
```

Append the remaining service methods to `connector.go`:

```go
// Get returns one connector scoped to its project.
func (c *Connectors) Get(projectID, id string) (Connector, error) {
	return c.store.ConnectorByID(projectID, id)
}

// Summaries lists a project's connectors (unordered; the catalog sorts).
func (c *Connectors) Summaries(projectID string) ([]Connector, error) {
	return c.store.ConnectorSummaries(projectID)
}

// Configure sets a connector's provider path. For local-folder the path must be
// absolute; the capability does not touch the filesystem.
func (c *Connectors) Configure(projectID, id, path string) (Connector, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return Connector{}, err
	}
	path = strings.TrimSpace(path)
	if rec.SubKind == SubKindLocalFolder && !strings.HasPrefix(path, "/") {
		return Connector{}, ErrInvalidPath
	}
	rec.Path = path
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

// Rename changes a connector's display name.
func (c *Connectors) Rename(projectID string, actor Actor, id, name string) (Connector, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Connector{}, ErrInvalidName
	}
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return Connector{}, err
	}
	rec.Name = name
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateConnector(rec); err != nil {
		return Connector{}, err
	}
	return rec, nil
}

// Delete removes a connector.
func (c *Connectors) Delete(projectID string, actor Actor, id string) error {
	return c.store.DeleteConnector(projectID, id)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `go test ./core/capability/connector/`
Expected: PASS.

- [ ] **Step 5: Companions + commit**

Write `connector.go.md` and `memory.go.md` (verbatim). Then:

```bash
git add core/capability/connector/
git commit -m "Add connector capability: domain, service, in-memory store"
```

---

## Task A4: SQLite Store + restart durability

**Files:**
- Modify: `core/platform/storage/sqlite/sqlite.go` (add `connectors` table to the migration list; implement the five `Store` methods)
- Test: `core/platform/storage/sqlite/sqlite_test.go`

**Interfaces:**
- Consumes: `connector.Connector`, `connector.Store` (the sqlite `*Store` must satisfy it).
- Produces: persisted connector rows surviving reopen.

- [ ] **Step 1: Write the failing test**

Add to `sqlite_test.go` (mirror an existing open/reopen test in that file):

```go
func TestConnectorPersistsAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	dsn := filepath.Join(dir, "t.db")
	s, err := Open(dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	rec := connector.Connector{
		ID: "c1", ProjectID: "p1", Name: "Drive", SubKind: connector.SubKindLocalFolder,
		Path: "/data/x", CreatorID: "u1", CreatedAt: time.Unix(1, 0).UTC(), UpdatedAt: time.Unix(2, 0).UTC(),
	}
	if err := s.InsertConnector(rec); err != nil {
		t.Fatalf("insert: %v", err)
	}
	_ = s.Close()

	s2, err := Open(dsn)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	got, err := s2.ConnectorByID("p1", "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Drive" || got.Path != "/data/x" || got.SubKind != connector.SubKindLocalFolder {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}
```

(Import `connector`, `path/filepath`, `time` as needed, matching the file's existing imports/helpers.)

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/platform/storage/sqlite/ -run TestConnectorPersistsAcrossReopen`
Expected: FAIL — `InsertConnector` undefined.

- [ ] **Step 3: Implement schema + methods**

Add the table DDL to the existing migration statements in `sqlite.go` (follow the surrounding `CREATE TABLE IF NOT EXISTS` list):

```sql
CREATE TABLE IF NOT EXISTS connectors (
    project_id TEXT NOT NULL,
    id         TEXT NOT NULL,
    name       TEXT NOT NULL,
    subkind    TEXT NOT NULL,
    path       TEXT NOT NULL DEFAULT '',
    creator_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, id)
);
```

Add the methods (mirror the RFC3339Nano time encoding used elsewhere in the file):

```go
func (s *Store) InsertConnector(c connector.Connector) error {
	_, err := s.db.Exec(
		`INSERT INTO connectors(project_id,id,name,subkind,path,creator_id,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?)`,
		c.ProjectID, c.ID, c.Name, string(c.SubKind), c.Path, c.CreatorID,
		c.CreatedAt.UTC().Format(time.RFC3339Nano), c.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) ConnectorByID(projectID, id string) (connector.Connector, error) {
	row := s.db.QueryRow(
		`SELECT project_id,id,name,subkind,path,creator_id,created_at,updated_at
		 FROM connectors WHERE project_id=? AND id=?`, projectID, id)
	return scanConnector(row)
}

func (s *Store) ConnectorSummaries(projectID string) ([]connector.Connector, error) {
	rows, err := s.db.Query(
		`SELECT project_id,id,name,subkind,path,creator_id,created_at,updated_at
		 FROM connectors WHERE project_id=?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []connector.Connector
	for rows.Next() {
		c, err := scanConnector(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpdateConnector(c connector.Connector) error {
	res, err := s.db.Exec(
		`UPDATE connectors SET name=?,path=?,updated_at=? WHERE project_id=? AND id=?`,
		c.Name, c.Path, c.UpdatedAt.UTC().Format(time.RFC3339Nano), c.ProjectID, c.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteConnector(projectID, id string) error {
	res, err := s.db.Exec(`DELETE FROM connectors WHERE project_id=? AND id=?`, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return connector.ErrNotFound
	}
	return nil
}

// scanConnector reads one row (from *sql.Row or *sql.Rows via the rowScanner used
// elsewhere in this file).
func scanConnector(row rowScanner) (connector.Connector, error) {
	var c connector.Connector
	var sub, createdAt, updatedAt string
	if err := row.Scan(&c.ProjectID, &c.ID, &c.Name, &sub, &c.Path, &c.CreatorID, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return connector.Connector{}, connector.ErrNotFound
		}
		return connector.Connector{}, err
	}
	c.SubKind = connector.SubKind(sub)
	c.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	c.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updatedAt)
	return c, nil
}
```

(If the file has no `rowScanner` helper, use the same row-scan idiom already present; the goal is one shared scan for `QueryRow` and `Query`.)

- [ ] **Step 4: Run to verify it passes**

Run: `go test ./core/platform/storage/sqlite/ -run TestConnectorPersistsAcrossReopen` then the full `go test ./core/platform/storage/sqlite/`.
Expected: PASS.

- [ ] **Step 5: Companion + commit**

Update `core/platform/storage/sqlite/sqlite.go.md` (verbatim; this is a **multi-section** companion — hand-edit only the changed/added ```go blocks, never regen the whole file).

```bash
git add core/platform/storage/sqlite/sqlite.go core/platform/storage/sqlite/sqlite.go.md core/platform/storage/sqlite/sqlite_test.go
git commit -m "Persist connectors in SQLite with restart durability"
```

---

## Task A5: Catalog family adapter + registration

**Files:**
- Create: `core/wiring/resource_connector.go`
- Modify: `core/wiring/wiring.go:232-240`
- Test: `core/transport/transport_test.go` (or a wiring-level test mirroring the existing document-family catalog test)

**Interfaces:**
- Consumes: `connector.Connectors`, `resource.Family`, `resource.Summary`.
- Produces: `connectorResourceFamily` (satisfies `resource.Family`, `Kind()==resource.KindConnector`); `connector` present in `AvailableKinds()`.

- [ ] **Step 1: Write the failing test**

Add a test asserting a created connector appears in `GET /resources` and that `availableKinds` includes `connector`. Mirror the existing resources catalog test in `transport_test.go`; the new assertion:

```go
// after selecting a project and creating a connector via POST /connectors:
// GET /resources -> availableKinds contains "connector" and the connector is listed.
```

(Write it as a concrete transport test following the file's existing request helpers; expected initial failure is that `connector` is neither available nor listed.)

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/transport/ -run Resources`
Expected: FAIL — connector kind not registered.

- [ ] **Step 3: Implement the family adapter**

Create `core/wiring/resource_connector.go` (mirrors `resource_document.go`):

```go
package wiring

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// connectorResourceFamily adapts the canonical connector owner to the unified
// Resource catalog without either capability importing the other.
type connectorResourceFamily struct{ connectors *connector.Connectors }

func (f connectorResourceFamily) Kind() resource.Kind { return resource.KindConnector }

func (f connectorResourceFamily) List(projectID string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	items, err := f.connectors.Summaries(projectID)
	if err != nil {
		return nil, err
	}
	out := make([]resource.Summary, 0, len(items))
	for _, c := range items {
		out = append(out, connectorSummary(c))
	}
	return out, nil
}

func (f connectorResourceFamily) Get(projectID, id string) (resource.Summary, error) {
	c, err := f.connectors.Get(projectID, id)
	if err != nil {
		return resource.Summary{}, mapConnectorResourceError(err)
	}
	return connectorSummary(c), nil
}

func (f connectorResourceFamily) Create(projectID string, actor resource.Actor, name string) (resource.Summary, error) {
	c, err := f.connectors.Create(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, name, connector.SubKindLocalFolder)
	return connectorSummary(c), mapConnectorResourceError(err)
}

func (f connectorResourceFamily) Rename(projectID string, actor resource.Actor, id, name string) (resource.Summary, error) {
	c, err := f.connectors.Rename(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, id, name)
	return connectorSummary(c), mapConnectorResourceError(err)
}

func (f connectorResourceFamily) Delete(projectID string, actor resource.Actor, id string) error {
	return mapConnectorResourceError(f.connectors.Delete(projectID, connector.Actor{ID: actor.ID, Name: actor.Name}, id))
}

func connectorSummary(c connector.Connector) resource.Summary {
	return resource.Summary{
		ID: c.ID, Kind: resource.KindConnector, Name: c.Name,
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, CreatorID: c.CreatorID,
	}
}

func mapConnectorResourceError(err error) error {
	switch {
	case errors.Is(err, connector.ErrNotFound):
		return resource.ErrNotFound
	case errors.Is(err, connector.ErrInvalidName):
		return resource.ErrInvalidName
	default:
		return err
	}
}
```

Note: generic `POST /resources {kind:"connector"}` creates a bare `local-folder` connector; subkind/path are set through the connector handler (Task A6).

- [ ] **Step 4: Register it in wiring**

In `core/wiring/wiring.go`, build the service near the other capability constructors (after `workspaces := workspace.New(store)` at line 232) and add the family:

```go
connectors := connector.New(store)
```

```go
resources, err := resource.NewWithAttributes(store,
	documentResourceFamily{documents: docs},
	connectorResourceFamily{connectors: connectors},
)
```

- [ ] **Step 5: Run to verify it passes**

Run: `go test ./core/transport/ -run Resources && go build ./...`
Expected: PASS.

- [ ] **Step 6: Companions + commit**

Write `core/wiring/resource_connector.go.md`; update `core/wiring/wiring.go.md` (multi-section — hand-edit the changed blocks).

```bash
git add core/wiring/ core/transport/transport_test.go
git commit -m "Register connector family in the resource catalog"
```

---

## Task A6: Connector handler + routes (subkind + configure)

**Files:**
- Create: `core/handlers/connector/connector.go`
- Modify: `core/transport/transport.go` (`Options.Connectors`, project-scoped routes)
- Modify: `core/wiring/wiring.go` (pass `Connectors: connectors` into `transport.Options`)
- Test: `core/transport/transport_test.go`

**Interfaces:**
- Consumes: `connector.Connectors`, `access.Context`, `endpoint.Request/Response`.
- Produces routes (project-scoped):
  - `POST /connectors` `{name, subkind}` → `201` `{id,kind:"connector",subkind,name,path,createdAt,updatedAt}`.
  - `GET /connectors/:id` → `200` same shape.
  - `PUT /connectors/:id/config` `{path}` → `200` same shape (`400` on bad path).
  - (Rename/delete/list go through the generic `/resources` surface.)

- [ ] **Step 1: Write the failing test**

Add a transport test: select a project, `POST /connectors {name:"Drive",subkind:"local-folder"}` → 201 with an id; `PUT /connectors/:id/config {path:"/data/x"}` → 200 path set; `PUT .../config {path:"rel"}` → 400. Follow the file's request helpers.

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/transport/ -run Connector`
Expected: FAIL — routes/handler absent.

- [ ] **Step 3: Implement the handler**

Create `core/handlers/connector/connector.go`:

```go
// Package connector serves connector-specific creation and configuration that the
// generic resource catalog cannot express (provider subkind + provider config).
package connector

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	connectorcap "github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct{ connectors *connectorcap.Connectors }

func NewHandlers(c *connectorcap.Connectors) Handlers { return Handlers{connectors: c} }

type connectorJSON struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	SubKind   string `json:"subkind"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func view(c connectorcap.Connector) connectorJSON {
	return connectorJSON{
		ID: c.ID, Kind: "connector", SubKind: string(c.SubKind), Name: c.Name, Path: c.Path,
		CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: c.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name    string `json:"name"`
		SubKind string `json:"subkind"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.connectors.Create(ctx.Project.ID, connectorcap.Actor{ID: ctx.User.ID, Name: ctx.User.Name}, in.Name, connectorcap.SubKind(in.SubKind))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: view(c)}
}

func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	c, err := h.connectors.Get(ctx.Project.ID, req.Param("connectorID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func (h Handlers) Configure(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Path string `json:"path"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.connectors.Configure(ctx.Project.ID, req.Param("connectorID"), in.Path)
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func mapErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, connectorcap.ErrNotFound):
		return errResp(http.StatusNotFound, "connector not found")
	case errors.Is(err, connectorcap.ErrInvalidName):
		return errResp(http.StatusBadRequest, "connector name must not be empty")
	case errors.Is(err, connectorcap.ErrInvalidSubKind):
		return errResp(http.StatusBadRequest, "connector subkind is not supported")
	case errors.Is(err, connectorcap.ErrInvalidPath):
		return errResp(http.StatusBadRequest, "connector path is invalid")
	default:
		return errResp(http.StatusInternalServerError, "connector error")
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

- [ ] **Step 4: Add `Options.Connectors` + routes in transport**

In `core/transport/transport.go`: add `Connectors *connector.Connectors` to `Options`; when non-nil, register on the project-scoped group:

```go
if opts.Connectors != nil {
	ch := connectorapp.NewHandlers(opts.Connectors)
	scoped.POST("/connectors", s.adaptScoped(ch.Create))
	scoped.GET("/connectors/:connectorID", s.adaptScoped(ch.Get))
	scoped.PUT("/connectors/:connectorID/config", s.adaptScoped(ch.Configure))
}
```

Wire it in `wiring.go` by adding `Connectors: connectors,` to the `transport.Options{...}` literal.

- [ ] **Step 5: Run to verify it passes**

Run: `go test ./core/transport/ && go build ./...`
Expected: PASS.

- [ ] **Step 6: Companions + commit**

Write `core/handlers/connector/connector.go.md`; update `transport.go.md` and `wiring.go.md` (multi-section — hand-edit changed blocks).

```bash
git add core/handlers/connector/ core/transport/ core/wiring/
git commit -m "Add connector create/configure routes"
```

---

## Task A7: End-to-end dev-test

**Files:**
- Create: `dev-test/connectors/run.sh` (executable), `dev-test/connectors/manual.md`

**Interfaces:**
- Consumes: the running server (auto-started by the suite harness).

- [ ] **Step 1: Write the suite**

Create `dev-test/connectors/run.sh` (mirror `dev-test/identities/run.sh` structure; no model, so it always runs):

```bash
#!/usr/bin/env bash
# Connector resource kind: create a local-folder connector, configure its path,
# read it back, and confirm it joins the resource catalog + availableKinds.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh
trap stop_service EXIT
start_service

info "Register + login + create/select a project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Connectors"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200

info "Create a local-folder connector"
request POST /connectors '{"name":"Sales drive","subkind":"local-folder"}'; expect_status 201
CID="$(json_field id)"
[[ "$(json_field subkind)" == "local-folder" ]] && pass "subkind set" || { fail "subkind"; FAILURES=$((FAILURES+1)); }

info "Configure its path (absolute required)"
request PUT "/connectors/$CID/config" '{"path":"relative"}'; expect_status 400
request PUT "/connectors/$CID/config" '{"path":"/data/sales"}'; expect_status 200
[[ "$(json_field path)" == "/data/sales" ]] && pass "path set" || { fail "path"; FAILURES=$((FAILURES+1)); }

info "It appears in the catalog and availableKinds"
request GET /resources; expect_status 200
echo "$LAST_BODY" | jq -e '.availableKinds | index("connector")' >/dev/null && pass "connector available" || { fail "availableKinds"; FAILURES=$((FAILURES+1)); }
echo "$LAST_BODY" | jq -e --arg id "$CID" '.resources[] | select(.id==$id and .kind=="connector")' >/dev/null && pass "listed in catalog" || { fail "not in catalog"; FAILURES=$((FAILURES+1)); }

finish
```

Write `manual.md` with the equivalent `curl` walkthrough and expected responses.

- [ ] **Step 2: Run it**

Run: `./dev-test/connectors/run.sh`
Expected: all `pass`, `FAILURES=0`.

- [ ] **Step 3: Run the whole suite + vet**

Run: `go vet ./... && ./dev-test/run.sh`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add dev-test/connectors/
git commit -m "Add connectors dev-test suite"
```

---

## Task A8: Change record

**Files:**
- Create: `docs/records/0088-connector-resource-kind.md` (use the next free number if 0088 is taken)

- [ ] **Step 1: Write the record**

Capture *why*: connector is one resource kind with a provider subkind (first `local-folder`); it is a full, persisted resource (create/configure/get + generic rename/delete/list) with no lattice sync yet (that is Slice B); the family adapter keeps `connector` and `resource` independent; subkind + provider path are connector-specific and served outside the generic catalog. Note it satisfies acceptance criterion 1 of the design spec.

- [ ] **Step 2: Verify companions have zero drift**

Run the scratchpad companion-drift check across all changed `core/**` files; fix any mismatch.

- [ ] **Step 3: Commit**

```bash
git add docs/records/0088-connector-resource-kind.md
git commit -m "Record 0088: connector resource kind"
```

---

## Self-review

- **Spec coverage:** satisfies acceptance criterion 1 ("a `connector` of subkind `local-folder` can be created, points at a local folder, and appears in `availableKinds`"). Change detection + sync (criterion 2) is Slice B — intentionally out of scope here.
- **Type consistency:** `connector.Actor`, `connector.SubKind`, `connector.Connector`, `Store` (5 methods) are used identically across the capability, sqlite store, family adapter, and handler. `connectorResourceFamily` implements the exact `resource.Family` six-method contract.
- **No placeholders:** every step carries real code. The only deferred concretes are the `transport_test.go` request-helper calls (Tasks A5/A6 Step 1), which must follow that file's existing helper names — noted explicitly rather than invented.
- **Boundary check:** the connector capability never imports `resource`; composition is in `core/wiring`. ✓
